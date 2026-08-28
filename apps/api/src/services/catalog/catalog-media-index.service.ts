import {
  listProducts,
} from "./catalog.repository.js";

import {
  listCatalogMediaAssets,
  normalizeArticleCode,
  type CatalogMediaRole,
} from "./catalog-media.repository.js";


export type IndexedCatalogImage = {
  articleCode: string;

  color:
    string | null;

  colorCode:
    string | null;

  role:
    CatalogMediaRole;

  url: string;

  source:
    | "registry"
    | "internal";
};


export type CatalogMediaIndex = {
  byCode:
    Map<
      string,
      IndexedCatalogImage[]
    >;

  internalCatalogOk:
    boolean;

  degradedSources:
    string[];

  registryAssets:
    number;

  internalImages:
    number;
};


const roleOrder:
Record<CatalogMediaRole, number> = {
  cover:
    0,

  front:
    1,

  model:
    2,

  back:
    3,

  detail:
    4,
};


function normalizedText(
  value:
    string | null | undefined,
) {
  return String(
    value ?? "",
  )
    .normalize(
      "NFD",
    )
    .replace(
      /\p{Diacritic}/gu,
      "",
    )
    .trim()
    .toUpperCase();
}


function mediaRole(
  role:
    string | null | undefined,
): CatalogMediaRole {
  switch (role) {
    case "front":
    case "back":
    case "detail":
    case "model":
    case "cover":
      return role;

    default:
      return "cover";
  }
}


function pushUnique(
  target:
    Map<
      string,
      IndexedCatalogImage[]
    >,

  code:
    string,

  image:
    IndexedCatalogImage,
) {
  const normalizedCode =
    normalizeArticleCode(
      code,
    );

  if (!normalizedCode) {
    return;
  }

  const current =
    target.get(
      normalizedCode,
    )
    ?? [];

  if (
    current.some(
      (candidate) =>
        candidate.url
        === image.url,
    )
  ) {
    return;
  }

  current.push(
    image,
  );

  target.set(
    normalizedCode,
    current,
  );
}


export async function buildCatalogMediaIndex(
  companyId: string,
): Promise<CatalogMediaIndex> {
  const byCode =
    new Map<
      string,
      IndexedCatalogImage[]
    >();

  const degradedSources:
    string[] =
      [];

  const registry =
    await listCatalogMediaAssets(
      companyId,
    );

  for (
    const asset
    of registry
  ) {
    pushUnique(
      byCode,
      asset.articleCode,
      {
        articleCode:
          normalizeArticleCode(
            asset.articleCode,
          ),

        color:
          asset.colorName,

        colorCode:
          asset.colorCode,

        role:
          asset.role,

        url:
          asset.url,

        source:
          "registry",
      },
    );
  }

  let internalCatalogOk =
    true;

  let internalImages =
    0;

  try {
    const products =
      await listProducts(
        companyId,
      );

    for (
      const product
      of products
    ) {
      const codes =
        new Set(
          [
            normalizeArticleCode(
              product.baseSku,
            ),

            normalizeArticleCode(
              product.sku,
            ),
          ]
            .filter(Boolean),
        );

      for (
        const image
        of product.images
        ?? []
      ) {
        if (!image.url) {
          continue;
        }

        internalImages +=
          1;

        for (
          const code
          of codes
        ) {
          pushUnique(
            byCode,
            code,
            {
              articleCode:
                code,

              color:
                product.color
                ?? null,

              colorCode:
                null,

              role:
                mediaRole(
                  image.role,
                ),

              url:
                image.url,

              source:
                "internal",
            },
          );
        }
      }
    }

  } catch (error) {
    internalCatalogOk =
      false;

    degradedSources.push(
      "internal-catalog",
    );

    console.error(
      "[CATALOG MEDIA INDEX DEGRADED]",
      {
        companyId,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
    );
  }

  for (
    const images
    of byCode.values()
  ) {
    images.sort(
      (a, b) =>
        roleOrder[a.role]
        - roleOrder[b.role],
    );
  }

  return {
    byCode,

    internalCatalogOk,

    degradedSources,

    registryAssets:
      registry.length,

    internalImages,
  };
}


export function selectArticleImages(
  index:
    CatalogMediaIndex,

  articleCode:
    string,

  preferredColor?:
    string | null,

  limit =
    4,
) {
  const images =
    [
      ...(
        index.byCode.get(
          normalizeArticleCode(
            articleCode,
          ),
        )
        ?? []
      ),
    ];

  const color =
    normalizedText(
      preferredColor,
    );

  images.sort(
    (left, right) => {
      const leftColor =
        color
        && (
          normalizedText(
            left.color,
          ) === color
          || normalizedText(
            left.colorCode,
          ) === color
        )
          ? 0
          : 1;

      const rightColor =
        color
        && (
          normalizedText(
            right.color,
          ) === color
          || normalizedText(
            right.colorCode,
          ) === color
        )
          ? 0
          : 1;

      if (
        leftColor
        !== rightColor
      ) {
        return leftColor
          - rightColor;
      }

      return (
        roleOrder[left.role]
        - roleOrder[right.role]
      );
    },
  );

  return images.slice(
    0,
    Math.max(
      1,
      Math.min(
        limit,
        12,
      ),
    ),
  );
}
