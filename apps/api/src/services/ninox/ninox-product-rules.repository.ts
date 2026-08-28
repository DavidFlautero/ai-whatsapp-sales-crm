import {
  supabaseRequest,
} from "../db/supabase-rest.client.js";


export type NinoxPriceList =
  1 | 2 | 3 | 4 | 5;


export type NinoxSizePriceRule = {
  sizes: string[];
  priceList: NinoxPriceList;
};


export type NinoxProductRule = {
  companyId: string;
  externalCode: string;

  retailEnabled: boolean;
  wholesaleEnabled: boolean;

  retailPriceList:
    NinoxPriceList | null;

  wholesalePriceList:
    NinoxPriceList | null;

  curveSizes: string[];
  unitsPerSize: number;

  sizePriceRules:
    NinoxSizePriceRule[];

  metadata:
    Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
};


type NinoxProductRuleRow = {
  company_id: string;
  external_code: string;

  retail_enabled: boolean;
  wholesale_enabled: boolean;

  retail_price_list:
    NinoxPriceList | null;

  wholesale_price_list:
    NinoxPriceList | null;

  curve_sizes:
    unknown;

  units_per_size: number;

  size_price_rules:
    unknown;

  metadata:
    Record<string, unknown> | null;

  created_at: string;
  updated_at: string;
};


function stringArray(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(
      (item) =>
        String(item).trim(),
    )
    .filter(Boolean);
}


function sizePriceRules(
  value: unknown,
): NinoxSizePriceRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rules:
    NinoxSizePriceRule[] = [];

  for (const item of value) {
    if (
      !item
      || typeof item !== "object"
    ) {
      continue;
    }

    const record =
      item as Record<
        string,
        unknown
      >;

    const sizes =
      stringArray(
        record.sizes,
      );

    const priceList =
      Number(
        record.priceList,
      );

    if (
      !sizes.length
      || ![
        1,
        2,
        3,
        4,
        5,
      ].includes(
        priceList,
      )
    ) {
      continue;
    }

    rules.push({
      sizes,

      priceList:
        priceList as NinoxPriceList,
    });
  }

  return rules;
}


function publicRule(
  row:
    NinoxProductRuleRow,
): NinoxProductRule {
  return {
    companyId:
      row.company_id,

    externalCode:
      row.external_code,

    retailEnabled:
      row.retail_enabled,

    wholesaleEnabled:
      row.wholesale_enabled,

    retailPriceList:
      row.retail_price_list,

    wholesalePriceList:
      row.wholesale_price_list,

    curveSizes:
      stringArray(
        row.curve_sizes,
      ),

    unitsPerSize:
      row.units_per_size,

    sizePriceRules:
      sizePriceRules(
        row.size_price_rules,
      ),

    metadata:
      row.metadata ?? {},

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


export async function getNinoxProductRule(
  companyId: string,
  externalCode: string,
): Promise<NinoxProductRule | null> {
  const rows =
    await supabaseRequest<
      NinoxProductRuleRow[]
    >({
      table:
        "commerce_ninox_product_rules",

      query:
        `?company_id=eq.${encodeURIComponent(
          companyId,
        )}`
        + `&external_code=eq.${encodeURIComponent(
          externalCode.trim().toUpperCase(),
        )}`
        + "&limit=1",
    });

  const row =
    rows[0];

  return row
    ? publicRule(row)
    : null;
}


export async function listNinoxProductRules(
  companyId: string,
): Promise<NinoxProductRule[]> {
  const rows =
    await supabaseRequest<
      NinoxProductRuleRow[]
    >({
      table:
        "commerce_ninox_product_rules",

      query:
        `?company_id=eq.${encodeURIComponent(
          companyId,
        )}`
        + "&order=external_code.asc",
    });

  return rows.map(
    publicRule,
  );
}


export async function saveNinoxProductRule(
  input: {
    companyId: string;
    externalCode: string;

    retailEnabled?: boolean;
    wholesaleEnabled?: boolean;

    retailPriceList?:
      NinoxPriceList | null;

    wholesalePriceList?:
      NinoxPriceList | null;

    curveSizes?: string[];

    unitsPerSize?: number;

    sizePriceRules?:
      NinoxSizePriceRule[];

    metadata?:
      Record<string, unknown>;
  },
): Promise<NinoxProductRule> {
  const companyId =
    input.companyId.trim();

  const externalCode =
    input.externalCode
      .trim()
      .toUpperCase();

  if (
    !companyId
    || !externalCode
  ) {
    throw new Error(
      "NINOX_PRODUCT_RULE_INVALID",
    );
  }

  const rows =
    await supabaseRequest<
      NinoxProductRuleRow[]
    >({
      table:
        "commerce_ninox_product_rules",

      method:
        "POST",

      query:
        "?on_conflict=company_id,external_code",

      prefer:
        "resolution=merge-duplicates,return=representation",

      body: {
        company_id:
          companyId,

        external_code:
          externalCode,

        retail_enabled:
          input.retailEnabled
          ?? true,

        wholesale_enabled:
          input.wholesaleEnabled
          ?? true,

        retail_price_list:
          input.retailPriceList
          ?? null,

        wholesale_price_list:
          input.wholesalePriceList
          ?? null,

        curve_sizes:
          input.curveSizes
          ?? [],

        units_per_size:
          input.unitsPerSize
          ?? 1,

        size_price_rules:
          input.sizePriceRules
          ?? [],

        metadata:
          input.metadata
          ?? {},

        updated_at:
          new Date()
            .toISOString(),
      },
    });

  const row =
    rows[0];

  if (!row) {
    throw new Error(
      "NINOX_PRODUCT_RULE_SAVE_FAILED",
    );
  }

  return publicRule(
    row,
  );
}
