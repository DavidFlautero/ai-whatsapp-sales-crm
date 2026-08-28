import {
  Router,
  type Request,
  type Response,
} from "express";

import {
  listProducts,
} from "../../services/catalog/catalog.repository.js";

import {
  listCatalogMediaAssets,
  normalizeArticleCode,
  type CatalogMediaAsset,
  type CatalogMediaRole,
} from "../../services/catalog/catalog-media.repository.js";

/* PUBLIC_CATALOG_MEDIA_MERGE_V1 */
type PublicCatalogImage = {
  id?: string;
  url: string;
  isCover?: boolean;
  order?: number;
  role?: string | null;
};

const PUBLIC_MEDIA_ROLE_ORDER:
Record<CatalogMediaRole, number> = {
  cover: 0,
  front: 1,
  model: 2,
  back: 3,
  detail: 4,
};

function registryImagesByArticle(
  assets: CatalogMediaAsset[],
) {
  const byArticle =
    new Map<string, PublicCatalogImage[]>();

  for (const asset of assets) {
    const code =
      normalizeArticleCode(
        asset.articleCode,
      );

    const url =
      asset.url?.trim();

    if (!code || !url) {
      continue;
    }

    const current =
      byArticle.get(code)
      ?? [];

    if (
      current.some(
        (image) =>
          image.url === url,
      )
    ) {
      continue;
    }

    current.push({
      id: asset.id,
      url,
      isCover:
        asset.role === "cover",
      order:
        PUBLIC_MEDIA_ROLE_ORDER[
          asset.role
        ] * 10
        + current.length,
      role:
        asset.role,
    });

    byArticle.set(
      code,
      current,
    );
  }

  return byArticle;
}

function mergePublicCatalogImages(
  registered:
    PublicCatalogImage[],
  internal:
    PublicCatalogImage[]
    | null
    | undefined,
) {
  const merged:
    PublicCatalogImage[] = [];

  const seen =
    new Set<string>();

  for (
    const image
    of [
      ...registered,
      ...(Array.isArray(internal)
        ? internal
        : []),
    ]
  ) {
    const url =
      image?.url?.trim();

    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);

    merged.push({
      ...image,
      url,
      isCover:
        image.isCover === true
        || image.role === "cover",
      order:
        Number.isFinite(
          Number(image.order),
        )
          ? Number(image.order)
          : merged.length,
    });

    if (merged.length >= 3) {
      break;
    }
  }

  return merged;
}

export const publicCatalogRoutes =
  Router();

/*
 * Catálogo público deliberadamente limitado
 * a Fulanitas.
 *
 * No recibe companyId arbitrario para evitar
 * exposición cruzada entre tenants.
 */
publicCatalogRoutes.get(
  "/",
  async (
    _request:
      Request,

    response:
      Response,
  ) => {
    try {
      const [
  products,
  mediaAssets,
] =
  await Promise.all([
    listProducts(
      "fulanitas",
    ),
    listCatalogMediaAssets(
      "fulanitas",
    ),
  ]);

const mediaByArticle =
  registryImagesByArticle(
    mediaAssets,
  );

      response.setHeader(
        "Cache-Control",
        "public, max-age=20, stale-while-revalidate=60",
      );

      response.json({
        ok:
          true,

        companyId:
          "fulanitas",

        products:
          products
            .filter(
              (product) =>
                product.active !==
                false,
            )
            .map(
              (product) => ({
                id:
                  product.id,

                productId:
                  product.productId,

                variantId:
                  product.variantId,

                sku:
                  product.sku,

                baseSku:
                  product.baseSku,

                name:
                  product.name,

                category:
                  product.category,

                description:
                  product.description,

                color:
                  product.color,

                size:
                  product.size,

                price:
                  product.price,

                currency:
                  product.currency,

                stock:
                  product.stock,

                images:
             mergePublicCatalogImages(
               mediaByArticle.get(
                 normalizeArticleCode(
                   product.baseSku
                   || product.sku,
                 ),
               )
               ?? [],
               product.images,
             ),

                active:
                  product.active,
              }),
            ),
      });
    } catch (
      error
    ) {
      console.error(
        "[PUBLIC CATALOG ERROR]",
        error,
      );

      response.status(
        500,
      ).json({
        ok:
          false,

        error:
          "CATALOG_UNAVAILABLE",
      });
    }
  },
);
