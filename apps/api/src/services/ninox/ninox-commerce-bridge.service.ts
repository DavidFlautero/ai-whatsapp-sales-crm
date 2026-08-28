import {
  upsertProduct,
} from "../catalog/catalog.repository.js";

import {
  supabaseRpc,
} from "../db/supabase-rest.client.js";

import {
  searchNinoxCatalog,
} from "./ninox-catalog-search.service.js";

import type {
  NinoxCommercialVariant,
} from "./ninox-commercial-catalog.service.js";


export async function ensureCommerceVariantFromNinox(
  input: {
    companyId: string;
    query: string;
  },
) {
  const matches =
    await searchNinoxCatalog({
      query:
        input.query,

      limit:
        10,
    });

  const candidate =
    matches.find(
      (item) =>
        item.active
        && item.available > 0,
    )
    ?? matches[0];

  if (!candidate) {
    return null;
  }

  const product =
    await upsertProduct(
      {
        sku:
          candidate.code,

        name:
          candidate.name,

        description:
          candidate.description,

        color:
          candidate.color
          ?? undefined,

        size:
          candidate.size
          ?? undefined,

        price:
          candidate.price,

        currency:
          "ARS",

        stock:
          candidate.available,

        tags: [
          "ninox",
          candidate.technicalKey,
        ],

        active:
          candidate.active,
      },
      input.companyId,
    );

  if (!product.variantId) {
    throw new Error(
      "NINOX_BRIDGE_VARIANT_ID_MISSING"
    );
  }

  const synced =
    await supabaseRpc<
      Record<string, unknown>
    >(
      "commerce_sync_external_stock",
      {
        p_company_id:
          input.companyId,

        p_variant_sku:
          product.sku,

        p_external_on_hand:
          candidate.externalUnits,

        p_idempotency_key:
          [
            "ninox-bridge",
            candidate.technicalKey,
            candidate.externalUnits,
            Date.now(),
          ].join("-"),

        p_warehouse_code:
          "CENTRAL",

        p_source:
          "ninox_bridge",

        p_metadata: {
          technicalKey:
            candidate.technicalKey,

          externalCode:
            candidate.code,
        },
      },
    );

  return {
    catalogItem:
      product,

    ninoxItem:
      candidate,

    stockSync:
      synced,
  };
}

export async function ensureCommerceVariantFromNinoxExact(
  input: {
    companyId: string;
    variant: NinoxCommercialVariant;
  },
) {
  const query = [
    input.variant.code,
    input.variant.color,
    input.variant.size,
  ]
    .filter(Boolean)
    .join(" ");

  const matches =
    await searchNinoxCatalog({
      query,
      limit: 30,
    });

  const candidate =
    matches.find(
      (item) =>
        item.technicalKey
        === input.variant.technicalKey,
    );

  if (!candidate) {
    throw new Error(
      [
        "NINOX_EXACT_VARIANT_NOT_FOUND",
        input.variant.code,
        input.variant.color ?? "-",
        input.variant.size ?? "-",
        input.variant.technicalKey,
      ].join(":"),
    );
  }

  const product =
    await upsertProduct(
      {
        sku:
          candidate.code,

        name:
          candidate.name,

        description:
          candidate.description,

        color:
          candidate.color
          ?? undefined,

        size:
          candidate.size
          ?? undefined,

        price:
          candidate.price,

        currency:
          "ARS",

        stock:
          candidate.available,

        tags: [
          "ninox",
          candidate.technicalKey,
        ],

        active:
          candidate.active,
      },
      input.companyId,
    );

  if (!product.variantId) {
    throw new Error(
      "NINOX_BRIDGE_VARIANT_ID_MISSING",
    );
  }

  const synced =
    await supabaseRpc<
      Record<string, unknown>
    >(
      "commerce_sync_external_stock",
      {
        p_company_id:
          input.companyId,

        p_variant_sku:
          product.sku,

        p_external_on_hand:
          candidate.externalUnits,

        p_idempotency_key:
          [
            "ninox-bridge-exact",
            candidate.technicalKey,
            candidate.externalUnits,
            Date.now(),
          ].join("-"),

        p_warehouse_code:
          "CENTRAL",

        p_source:
          "ninox_bridge_exact",

        p_metadata: {
          technicalKey:
            candidate.technicalKey,

          externalCode:
            candidate.code,
        },
      },
    );

  return {
    catalogItem:
      product,

    ninoxItem:
      candidate,

    stockSync:
      synced,
  };
}
