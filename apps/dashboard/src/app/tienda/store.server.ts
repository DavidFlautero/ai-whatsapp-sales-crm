import type {
  StoreProduct,
} from "./store.types";

type PublicCatalogProduct = {
  id?: string;
  productId?: string;
  variantId?: string;

  sku?: string;
  baseSku?: string;

  name?: string;
  description?: string;
  category?: string;

  color?: string;
  size?: string;

  price?: number;
  currency?: string;

  stock?: number;

  images?: StoreProduct["images"];

  active?: boolean;
};

function apiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_URL
    ?? "http://127.0.0.1:4000"
  ).replace(
    /\/+$/,
    "",
  );
}

export async function getStoreProducts():
  Promise<StoreProduct[]> {
  const response =
    await fetch(
      `${apiBaseUrl()}/public/catalog`,
      {
        headers: {
          Accept:
            "application/json",
        },

        cache:
          "no-store",
      },
    );

  if (!response.ok) {
    throw new Error(
      `PUBLIC_CATALOG_FAILED:${response.status}`
    );
  }

  const data =
    await response.json();

  const source:
    PublicCatalogProduct[] =
      Array.isArray(
        data?.products,
      )
        ? data.products
        : [];

  return source
    .filter(
      (product) =>
        product.active !==
        false,
    )
    .map(
      (
        product,
        index,
      ) => ({
        id:
          product.id
          || product.variantId
          || `product-${index}`,

        productId:
          product.productId,

        variantId:
          product.variantId,

        sku:
          product.sku
          || product.baseSku
          || "",

        baseSku:
          product.baseSku
          || product.sku
          || "",

        name:
          product.name
          || "Producto",

        description:
          product.description
          || "",

        category:
          product.category
          || "Sin categoría",

        color:
          product.color
          || "",

        size:
          product.size
          || "",

        /*
         * price4 importado sigue siendo el
         * valor unitario comercial actual.
         *
         * NO calculamos una curva inventada.
         */
        price:
          Number(
            product.price
            || 0,
          ),

        /*
         * Minorista sigue sin inventarse.
         * Se conectará a la lista correcta
         * cuando esté confirmada.
         */
        retailPrice:
          undefined,

        stock:
          Number(
            product.stock
            || 0,
          ),

        images:
          Array.isArray(
            product.images,
          )
            ? product.images
            : [],

        active:
          product.active !==
            false,
      }),
    );
}
