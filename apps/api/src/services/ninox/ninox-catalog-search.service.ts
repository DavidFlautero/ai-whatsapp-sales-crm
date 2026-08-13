import {
  ensureRuntimeAccess,
} from "../runtime/core-state.service.js";

import {
  readNinoxCatalogCache,
  type CachedNinoxCatalogItem,
} from "./ninox-catalog-cache.repository.js";


export type NinoxCatalogSearchInput = {
  query?: string;

  code?: string;
  color?: string;
  size?: string;
  barcode?: string;

  onlyWithStock?: boolean;

  limit?: number;
};


export type NinoxCatalogSearchResult = {
  technicalKey: string;

  code: string;
  name: string;
  description: string;

  color:
    string | null;

  size:
    string | null;

  barcode:
    string | null;

  price: number;

  externalUnits: number;
  locallyReserved: number;
  available: number;

  active: boolean;

  source:
    "ninox";
};


function normalize(
  value:
    unknown,
) {
  return String(
    value
    ?? "",
  )
    .trim()
    .toLowerCase()
    .normalize(
      "NFD",
    )
    .replace(
      /\p{Diacritic}/gu,
      "",
    )
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}


const IGNORED_SEARCH_WORDS =
  new Set([
    "a",
    "al",
    "algo",
    "busca",
    "buscar",
    "buscando",
    "busco",
    "con",
    "cuanto",
    "cuesta",
    "cuestan",
    "de",
    "del",
    "el",
    "en",
    "ese",
    "esa",
    "esta",
    "este",
    "hay",
    "la",
    "las",
    "lo",
    "los",
    "me",
    "necesito",
    "necesita",
    "necesitamos",
    "mostrar",
    "mostrame",
    "precio",
    "producto",
    "productos",
    "que",
    "queria",
    "quiero",
    "sale",
    "si",
    "stock",
    "talle",
    "tenes",
    "tiene",
    "tienes",
    "tenemos",
    "tienen",
    "un",
    "una",
    "ver",
    "y",
      "cantidad",
    "cantidades",
    "color",
    "colores",
    "talles",
    "unidad",
    "unidades",
]);


function removeExplicitQuantity(
  value:
    string,
) {
  return value
    .replace(
      /\b(?:quiero|dame|agregame|agrega|sumame|suma|necesito|llevo|pedime|armame)\s+\d+\s*(?:unidades?|u)?\b/g,
      " ",
    )
    .replace(
      /\b\d+\s+(?:unidades?|u)\b/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}


function singularSearchToken(
  token:
    string,
) {
  if (
    token.length > 4
    && token.endsWith(
      "s",
    )
  ) {
    return token.slice(
      0,
      -1,
    );
  }

  return token;
}


function tokens(
  value:
    string,
) {
  return removeExplicitQuantity(
    normalize(
      value,
    ),
  )
    .split(
      " ",
    )
    .filter(Boolean)
    .filter(
      (token) =>
        !IGNORED_SEARCH_WORDS.has(
          token,
        ),
    )
    .map(
      singularSearchToken,
    )
    .filter(Boolean);
}


function searchableText(
  item:
    CachedNinoxCatalogItem,
) {
  return normalize(
    [
      item.externalCode,
      item.name,
      item.description,
      item.webDescription,
      item.colorName,
      item.colorCode,
      item.sizeName,
      item.sizeCode,
      item.barcode,
    ]
      .filter(Boolean)
      .join(
        " ",
      ),
  );
}


function commercialPrice(
  item:
    CachedNinoxCatalogItem,
) {
  /*
   * El canal Ninox está configurado con listaPrecioId = 4.
   * Por eso la integración usa price4 como precio principal.
   */
  return item.prices.price4
    || item.prices.price1
    || item.prices.price2
    || item.prices.price3
    || item.prices.price5
    || 0;
}


function scoreItem(
  item:
    CachedNinoxCatalogItem,

  input:
    NinoxCatalogSearchInput,
) {
  let score =
    0;

  const query =
    normalize(
      input.query,
    );

  const code =
    normalize(
      input.code,
    );

  const color =
    normalize(
      input.color,
    );

  const size =
    normalize(
      input.size,
    );

  const barcode =
    normalize(
      input.barcode,
    );

  const itemCode =
    normalize(
      item.externalCode,
    );

  const itemColor =
    normalize(
      item.colorName,
    );

  const itemSize =
    normalize(
      item.sizeName,
    );

  const itemSizeCode =
    normalize(
      item.sizeCode,
    );

  const itemBarcode =
    normalize(
      item.barcode,
    );

  const haystack =
    searchableText(
      item,
    );

  if (
    code
  ) {
    if (
      itemCode === code
    ) {
      score +=
        1000;
    } else if (
      itemCode.includes(
        code,
      )
    ) {
      score +=
        500;
    } else {
      return -1;
    }
  }

  if (
    color
  ) {
    if (
      itemColor === color
    ) {
      score +=
        250;
    } else if (
      itemColor.includes(
        color,
      )
    ) {
      score +=
        120;
    } else {
      return -1;
    }
  }

  if (
    size
  ) {
    if (
      itemSize === size
      || itemSizeCode
        === size
    ) {
      score +=
        250;
    } else {
      return -1;
    }
  }

  if (
    barcode
  ) {
    if (
      itemBarcode === barcode
    ) {
      score +=
        1000;
    } else {
      return -1;
    }
  }

  if (
    query
  ) {
    const queryTokens =
      tokens(
        query,
      );

    for (
      const token
      of queryTokens
    ) {
      if (
        itemCode === token
      ) {
        score +=
          500;

        continue;
      }

      if (
        itemCode.includes(
          token,
        )
      ) {
        score +=
          250;

        continue;
      }

      if (
        haystack.includes(
          token,
        )
      ) {
        score +=
          50;

        continue;
      }

      return -1;
    }
  }

  if (
    item.availableToBot > 0
  ) {
    score +=
      25;
  }

  if (
    item.active
  ) {
    score +=
      5;
  }

  return score;
}


function publicResult(
  item:
    CachedNinoxCatalogItem,
): NinoxCatalogSearchResult {
  return {
    technicalKey:
      item.technicalKey,

    code:
      item.externalCode,

    name:
      item.name,

    description:
      item.description,

    color:
      item.colorName,

    size:
      item.sizeName,

    barcode:
      item.barcode,

    price:
      commercialPrice(
        item,
      ),

    externalUnits:
      item.externalUnits,

    locallyReserved:
      item.locallyReserved,

    available:
      item.availableToBot,

    active:
      item.active,

    source:
      "ninox",
  };
}


export async function searchNinoxCatalog(
  input:
    NinoxCatalogSearchInput,
): Promise<NinoxCatalogSearchResult[]> {

  /* RUNTIME_CHECK_A6 */
  ensureRuntimeAccess("catalog");

  const catalog =
    await readNinoxCatalogCache();

  const limit =
    Math.min(
      Math.max(
        input.limit
        ?? 20,
        1,
      ),
      100,
    );

  return catalog
    .filter(
      (item) =>
        item.active,
    )
    .filter(
      (item) =>
        !input.onlyWithStock
        || item.availableToBot > 0,
    )
    .map(
      (item) => ({
        item,

        score:
          scoreItem(
            item,
            input,
          ),
      }),
    )
    .filter(
      (
        candidate,
      ) =>
        candidate.score >= 0,
    )
    .sort(
      (
        left,
        right,
      ) => {
        if (
          right.score
          !== left.score
        ) {
          return right.score
            - left.score;
        }

        if (
          right.item.availableToBot
          !== left.item.availableToBot
        ) {
          return right.item.availableToBot
            - left.item.availableToBot;
        }

        return left.item.externalCode
          .localeCompare(
            right.item.externalCode,
          );
      },
    )
    .slice(
      0,
      limit,
    )
    .map(
      (
        candidate,
      ) =>
        publicResult(
          candidate.item,
        ),
    );
}


export async function findNinoxVariantByTechnicalKey(
  technicalKey:
    string,
) {
  const catalog =
    await readNinoxCatalogCache();

  const normalizedKey =
    technicalKey
      .trim()
      .toUpperCase();

  const item =
    catalog.find(
      (candidate) =>
        candidate.technicalKey
          .toUpperCase()
        === normalizedKey,
    );

  return item
    ? publicResult(
        item,
      )
    : null;
}
