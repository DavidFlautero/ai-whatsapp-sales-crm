import {
  createHash,
} from "node:crypto";

import {
  isSupabaseConfigured,
  supabaseRpc,
} from "../db/supabase-rest.client.js";

export type CatalogImageRole =
  | "cover"
  | "front"
  | "back"
  | "detail"
  | "model"
  | "packaging";

export type CatalogVariantInput = {
  sku: string;
  barcode?: string;
  colorName?: string;
  colorCode?: string;
  colorHex?: string;
  size?: string;
  price?: number;
  physical?: number;
  minimum?: number;
  incoming?: number;
  active?: boolean;
  images?: Array<{
    id?: string;
    url: string;
    name?: string;
    role: CatalogImageRole;
    isCover?: boolean;
    order?: number;
  }>;
};

export type FullCatalogProductPayload = {
  baseSku: string;
  name: string;

  audience:
    | "men"
    | "women"
    | "boys"
    | "girls"
    | "baby"
    | "unisex";

  category?: string;
  subcategory?: string;
  collection?: string;
  season?: string;
  brand?: string;
  supplier?: string;
  composition?: string;
  description?: string;

  currency: "ARS";
  price: number;
  tags?: string[];
  active: boolean;

  variants: CatalogVariantInput[];
};

export type CreateFullCatalogProductInput = {
  companyId: string;
  actorId: string;
  idempotencyKey: string;
  payload: FullCatalogProductPayload;
};

export type FullCatalogProductResult = {
  productId: string;
  companyId: string;
  baseSku: string;
  name: string;
  currency: string;
  price: number | string;

  warehouse: {
    id: string;
    code: string;
    name: string;
  };

  variantsCreated: number;
  totalStock: number;
  idempotentReplay: boolean;
};

function requestHash(
  payload: FullCatalogProductPayload,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify(payload),
      "utf8",
    )
    .digest("hex");
}

export async function createFullCatalogProduct(
  input: CreateFullCatalogProductInput,
): Promise<FullCatalogProductResult> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "SUPABASE_NOT_CONFIGURED",
    );
  }

  const companyId =
    input.companyId.trim();

  const actorId =
    input.actorId.trim();

  const idempotencyKey =
    input.idempotencyKey.trim();

  if (!companyId) {
    throw new Error(
      "CATALOG_COMPANY_REQUIRED",
    );
  }

  if (!actorId) {
    throw new Error(
      "CATALOG_ACTOR_REQUIRED",
    );
  }

  if (
    idempotencyKey.length < 16
    || idempotencyKey.length > 200
  ) {
    throw new Error(
      "CATALOG_IDEMPOTENCY_KEY_INVALID",
    );
  }

  return supabaseRpc<
    FullCatalogProductResult
  >(
    "commerce_create_full_product",
    {
      p_company_id:
        companyId,

      p_actor_id:
        actorId,

      p_idempotency_key:
        idempotencyKey,

      p_request_hash:
        requestHash(
          input.payload,
        ),

      p_payload:
        input.payload,
    },
  );
}
