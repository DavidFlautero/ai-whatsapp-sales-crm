import {
  isSupabaseConfigured,
  supabaseRequest,
} from "../db/supabase-rest.client.js";

type ProductRow = {
  id: string;
  company_id: string;
  base_sku: string;
  name: string;
  category?: string | null;
  description?: string | null;
  currency: string;
  cost: number | string;
  default_price: number | string;
  active: boolean;
  metadata?: Record<string, unknown>;
};

type VariantRow = {
  id: string;
  company_id: string;
  product_id: string;
  sku: string;
  barcode?: string | null;
  color_name?: string | null;
  color_hex?: string | null;
  size?: string | null;
  cost_override?: number | string | null;
  price_override?: number | string | null;
  active: boolean;
  metadata?: Record<string, unknown>;
};

type StockRow = {
  id: string;
  company_id: string;
  warehouse_id: string;
  variant_id: string;
  on_hand: number;
  reserved: number;
  committed: number;
  available: number;
};

export type CatalogImage = {
  id?: string;
  url: string;
  name?: string;
  role?: string;
  isCover?: boolean;
  order?: number;
  createdAt?: string;
};

export type CatalogItem = {
  id: string;
  productId: string;
  variantId?: string;
  companyId: string;
  sku: string;
  baseSku: string;
  name: string;
  category?: string;
  description?: string;
  color?: string;
  size?: string;
  price: number;
  currency: string;
  stock: number;
  incoming: number;
  active: boolean;
  tags: string[];
  images: CatalogImage[];
};

export type CatalogProductInput = {
  sku?: string;
  name: string;
  category?: string;
  color?: string;
  size?: string;
  price?: number;
  stock?: number;
  tags?: string[];
  description?: string;
  active?: boolean;
};

const fallbackProducts: CatalogItem[] = [];

function numberValue(
  value: number | string | null | undefined,
): number {
  const result = Number(value ?? 0);

  return Number.isFinite(result)
    ? result
    : 0;
}

function metadataImages(
  metadata?: Record<string, unknown>,
): CatalogImage[] {
  const images =
    metadata?.images;

  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .filter(
      (image): image is Record<string, unknown> =>
        Boolean(
          image
          && typeof image === "object"
          && typeof image.url === "string"
          && image.url.trim(),
        ),
    )
    .map((image) => ({
      id:
        typeof image.id === "string"
          ? image.id
          : undefined,
      url:
        String(image.url),
      name:
        typeof image.name === "string"
          ? image.name
          : undefined,
      role:
        typeof image.role === "string"
          ? image.role
          : undefined,
      isCover:
        typeof image.isCover === "boolean"
          ? image.isCover
          : undefined,
      order:
        typeof image.order === "number"
          ? image.order
          : undefined,
      createdAt:
        typeof image.createdAt === "string"
          ? image.createdAt
          : undefined,
    }));
}

function metadataIncoming(
  metadata?: Record<string, unknown>,
): number {
  return numberValue(
    typeof metadata?.incoming === "number"
    || typeof metadata?.incoming === "string"
      ? metadata.incoming
      : 0,
  );
}

function metadataTags(
  metadata?: Record<string, unknown>,
): string[] {
  const tags = metadata?.tags;

  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .filter((tag): tag is string =>
      typeof tag === "string",
    );
}

export async function listProducts(
  companyId = "fulanitas",
): Promise<CatalogItem[]> {
  if (!isSupabaseConfigured()) {
    return fallbackProducts.filter(
      (product) =>
        product.companyId === companyId,
    );
  }

  const encodedCompanyId =
    encodeURIComponent(companyId);

  const [productRows, variantRows, stockRows] =
    await Promise.all([
      supabaseRequest<ProductRow[]>({
        table: "commerce_products",
        query:
          `?select=*&company_id=eq.${encodedCompanyId}`
          + "&active=eq.true"
          + "&order=created_at.desc",
      }),

      supabaseRequest<VariantRow[]>({
        table: "commerce_product_variants",
        query:
          `?select=*&company_id=eq.${encodedCompanyId}`
          + "&active=eq.true"
          + "&order=created_at.desc",
      }),

      supabaseRequest<StockRow[]>({
        table: "commerce_stock_balances",
        query:
          `?select=*&company_id=eq.${encodedCompanyId}`,
      }),
    ]);

  const stocksByVariant =
    new Map<string, number>();

  for (const stock of stockRows) {
    stocksByVariant.set(
      stock.variant_id,
      (
        stocksByVariant.get(stock.variant_id)
        ?? 0
      ) + Number(stock.available ?? 0),
    );
  }

  const variantsByProduct =
    new Map<string, VariantRow[]>();

  for (const variant of variantRows) {
    const current =
      variantsByProduct.get(variant.product_id)
      ?? [];

    current.push(variant);
    variantsByProduct.set(
      variant.product_id,
      current,
    );
  }

  const result: CatalogItem[] = [];

  for (const product of productRows) {
    const variants =
      variantsByProduct.get(product.id)
      ?? [];

    if (!variants.length) {
      result.push({
        id: product.id,
        productId: product.id,
        companyId: product.company_id,
        sku: product.base_sku,
        baseSku: product.base_sku,
        name: product.name,
        category:
          product.category
          ?? undefined,
        description:
          product.description
          ?? undefined,
        price:
          numberValue(product.default_price),
        currency:
          product.currency,
        stock: 0,
        incoming: 0,
        active:
          product.active,
        tags:
          metadataTags(product.metadata),
        images: [],
      });

      continue;
    }

    for (const variant of variants) {
      result.push({
        id: variant.id,
        productId: product.id,
        variantId: variant.id,
        companyId: product.company_id,
        sku: variant.sku,
        baseSku: product.base_sku,
        name: product.name,
        category:
          product.category
          ?? undefined,
        description:
          product.description
          ?? undefined,
        color:
          variant.color_name
          ?? undefined,
        size:
          variant.size
          ?? undefined,
        price:
          numberValue(
            variant.price_override
            ?? product.default_price,
          ),
        currency:
          product.currency,
        stock:
          stocksByVariant.get(variant.id)
          ?? 0,
        incoming:
          metadataIncoming(
            variant.metadata,
          ),
        active:
          product.active
          && variant.active,
        tags: [
          ...metadataTags(product.metadata),
          ...metadataTags(variant.metadata),
        ],
        images:
          metadataImages(
            variant.metadata,
          ),
      });
    }
  }

  return result;
}

const PRODUCT_ALIASES:
  Record<string, string> = {
    jin: "jean",
    yin: "jean",
    jeans: "jean",
    jeens: "jean",
    jan: "jean",
    jean: "jean",

    pantalon: "pantalon",
    pantalones: "pantalon",

    remera: "remera",
    remeras: "remera",
    camiseta: "remera",
    camisetas: "remera",

    buso: "buzo",
    buzos: "buzo",
    buzo: "buzo",

    campera: "campera",
    camperas: "campera",

    foto: "foto",
    fotos: "foto",
    imagen: "foto",
    imagenes: "foto",
  };

function normalizeText(
  value: string,
): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /\p{Diacritic}/gu,
      "",
    )
    .replace(
      /[^\p{L}\p{N}\s-]/gu,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeToken(
  value: string,
): string {
  const normalized =
    normalizeText(value);

  return PRODUCT_ALIASES[
    normalized
  ] ?? normalized;
}

function tokenize(
  value: string,
): string[] {
  return normalizeText(value)
    .split(/\s+/)
    .map(normalizeToken)
    .filter(
      (word) =>
        word.length > 1,
    );
}

function editDistance(
  left: string,
  right: string,
): number {
  const rows =
    left.length + 1;

  const columns =
    right.length + 1;

  const matrix =
    Array.from(
      {
        length: rows,
      },
      () =>
        Array<number>(
          columns,
        ).fill(0),
    );

  for (
    let row = 0;
    row < rows;
    row += 1
  ) {
    matrix[row]![0] =
      row;
  }

  for (
    let column = 0;
    column < columns;
    column += 1
  ) {
    matrix[0]![column] =
      column;
  }

  for (
    let row = 1;
    row < rows;
    row += 1
  ) {
    for (
      let column = 1;
      column < columns;
      column += 1
    ) {
      const substitutionCost =
        left[row - 1]
        === right[column - 1]
          ? 0
          : 1;

      matrix[row]![column] =
        Math.min(
          matrix[row - 1]![column]!
            + 1,
          matrix[row]![column - 1]!
            + 1,
          matrix[row - 1]![column - 1]!
            + substitutionCost,
        );
    }
  }

  return matrix[
    rows - 1
  ]![columns - 1]!;
}

function tokenMatches(
  queryToken: string,
  catalogToken: string,
): boolean {
  if (
    queryToken === catalogToken
    || catalogToken.includes(
      queryToken,
    )
    || queryToken.includes(
      catalogToken,
    )
  ) {
    return true;
  }

  const maximumDistance =
    Math.max(
      queryToken.length,
      catalogToken.length,
    ) <= 5
      ? 1
      : 2;

  return editDistance(
    queryToken,
    catalogToken,
  ) <= maximumDistance;
}

function catalogScore(
  product: CatalogItem,
  queryTokens: string[],
): number {
  const catalogTokens =
    tokenize(
      [
        product.name,
        product.category,
        product.color,
        product.size,
        product.sku,
        product.baseSku,
        product.description,
        ...product.tags,
      ]
        .filter(Boolean)
        .join(" "),
    );

  let score = 0;

  for (
    const queryToken
    of queryTokens
  ) {
    if (
      catalogTokens.some(
        (catalogToken) =>
          tokenMatches(
            queryToken,
            catalogToken,
          ),
      )
    ) {
      score += 1;

      if (
        product.size
        && normalizeToken(
          product.size,
        ) === queryToken
      ) {
        score += 2;
      }

      if (
        product.color
        && tokenize(
          product.color,
        ).includes(
          queryToken,
        )
      ) {
        score += 2;
      }
    }
  }

  return score;
}

export async function searchProducts(
  message: string,
  companyId = "fulanitas",
): Promise<CatalogItem[]> {
  const all =
    await listProducts(companyId);

  const queryTokens =
    tokenize(message);

  if (!queryTokens.length) {
    return [];
  }

  return all
    .map((product) => ({
      product,
      score:
        catalogScore(
          product,
          queryTokens,
        ),
    }))
    .filter(
      ({ score }) =>
        score > 0,
    )
    .sort(
      (left, right) =>
        right.score
        - left.score
        || right.product.stock
        - left.product.stock,
    )
    .slice(0, 20)
    .map(
      ({ product }) =>
        product,
    );
}

export function selectCatalogImages(
  product: CatalogItem,
  limit = 4,
): CatalogImage[] {
  return product.images
    .filter(
      (image) =>
        image.url.startsWith(
          "https://",
        ),
    )
    .sort(
      (left, right) =>
        Number(Boolean(right.isCover))
        - Number(Boolean(left.isCover))
        || Number(right.role === "cover")
        - Number(left.role === "cover")
        || Number(right.role === "front")
        - Number(left.role === "front")
        || (
          left.order
          ?? 999
        )
        - (
          right.order
          ?? 999
        ),
    )
    .slice(
      0,
      Math.max(1, limit),
    );
}

export function selectCatalogImage(
  product: CatalogItem,
): CatalogImage | null {
  const validImages =
    product.images
      .filter(
        (image) =>
          image.url.startsWith(
            "https://",
          ),
      )
      .sort(
        (left, right) =>
          Number(
            Boolean(
              right.isCover,
            ),
          )
          - Number(
            Boolean(
              left.isCover,
            ),
          )
          || Number(
            right.role === "cover",
          )
          - Number(
            left.role === "cover",
          )
          || Number(
            right.role === "front",
          )
          - Number(
            left.role === "front",
          )
          || (
            left.order
            ?? 999
          )
          - (
            right.order
            ?? 999
          ),
      );

  return validImages[0]
    ?? null;
}

export async function findRequestedCatalogImage(
  message: string,
  conversationHistory: string,
  companyId = "fulanitas",
): Promise<{
  product: CatalogItem;
  image: CatalogImage;
  images: CatalogImage[];
} | null> {
  const asksForImage =
    /\b(foto|fotos|imagen|imagenes|verlo|verla|mostrame|mostrar|mandame|enviame)\b/i
      .test(
        normalizeText(message),
      );

  if (!asksForImage) {
    return null;
  }

  const matches =
    await searchProducts(
      [
        message,
        conversationHistory,
      ].join("\n"),
      companyId,
    );

  for (
    const product
    of matches
  ) {
    const images =
      selectCatalogImages(
        product,
        4,
      );

    const image =
      images[0];

    if (image) {
      return {
        product,
        image,
        images,
      };
    }
  }

  return null;
}

export async function buildCatalogContext(
  message: string,
  companyId = "fulanitas",
): Promise<string> {
  const matches =
    await searchProducts(
      message,
      companyId,
    );

  if (!matches.length) {
    return [
      "No se encontraron productos específicos",
      "en el catálogo interno para esta consulta.",
      "No inventar disponibilidad, precio ni stock.",
    ].join(" ");
  }

  return matches
    .map((product) => {
      const image =
        selectCatalogImage(
          product,
        );

      return [
        `Producto: ${product.name}`,
        `SKU: ${product.sku}`,
        `Categoría: ${product.category ?? "-"}`,
        `Color: ${product.color ?? "-"}`,
        `Talle: ${product.size ?? "-"}`,
        `Precio: ${product.price} ${product.currency}`,
        `Stock disponible: ${product.stock}`,
        `Stock entrante informado: ${product.incoming}`,
        `Imagen disponible: ${image ? "sí" : "no"}`,
        `Descripción: ${product.description ?? "-"}`,
      ].join("\n");
    })
    .join("\n\n");
}


export async function upsertProduct(
  input: CatalogProductInput,
  companyId = "fulanitas",
): Promise<CatalogItem> {
  const normalizedSku =
    (
      input.sku
      || input.name
    )
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  if (!isSupabaseConfigured()) {
    const fallback: CatalogItem = {
      id: crypto.randomUUID(),
      productId: crypto.randomUUID(),
      companyId,
      sku: normalizedSku,
      baseSku: normalizedSku,
      name: input.name,
      category: input.category,
      description: input.description,
      color: input.color,
      size: input.size,
      price: input.price ?? 0,
      currency: "EUR",
      stock: input.stock ?? 0,
      incoming: 0,
      active: input.active ?? true,
      tags: input.tags ?? [],
      images: [],
    };

    fallbackProducts.unshift(fallback);

    return fallback;
  }

  const productRows =
    await supabaseRequest<ProductRow[]>({
      table: "commerce_products",
      method: "POST",
      query: "?on_conflict=company_id,base_sku",
      prefer:
        "resolution=merge-duplicates,return=representation",
      body: [{
        company_id: companyId,
        base_sku: normalizedSku,
        name: input.name,
        category: input.category ?? null,
        description:
          input.description
          ?? null,
        currency: "EUR",
        default_price:
          input.price
          ?? 0,
        active:
          input.active
          ?? true,
        metadata: {
          tags:
            input.tags
            ?? [],
        },
        updated_at:
          new Date().toISOString(),
      }],
    });

  const product =
    productRows[0];

  if (!product) {
    throw new Error(
      "Could not create catalog product",
    );
  }

  const variantSku = [
    normalizedSku,
    input.color,
    input.size,
  ]
    .filter(Boolean)
    .join("-")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-");

  const variantRows =
    await supabaseRequest<VariantRow[]>({
      table: "commerce_product_variants",
      method: "POST",
      query: "?on_conflict=company_id,sku",
      prefer:
        "resolution=merge-duplicates,return=representation",
      body: [{
        company_id: companyId,
        product_id: product.id,
        sku: variantSku,
        color_name:
          input.color
          ?? null,
        size:
          input.size
          ?? null,
        price_override:
          input.price
          ?? null,
        active:
          input.active
          ?? true,
        metadata: {
          tags:
            input.tags
            ?? [],
        },
        updated_at:
          new Date().toISOString(),
      }],
    });

  const variant =
    variantRows[0];

  if (!variant) {
    throw new Error(
      "Could not create catalog variant",
    );
  }

  return {
    id: variant.id,
    productId: product.id,
    variantId: variant.id,
    companyId,
    sku: variant.sku,
    baseSku: product.base_sku,
    name: product.name,
    category:
      product.category
      ?? undefined,
    description:
      product.description
      ?? undefined,
    color:
      variant.color_name
      ?? undefined,
    size:
      variant.size
      ?? undefined,
    price:
      numberValue(
        variant.price_override
        ?? product.default_price,
      ),
    currency:
      product.currency,
    stock: 0,
    incoming:
      metadataIncoming(
        variant.metadata,
      ),
    active:
      product.active
      && variant.active,
    tags:
      input.tags
      ?? [],
    images:
      metadataImages(
        variant.metadata,
      ),
  };
}
