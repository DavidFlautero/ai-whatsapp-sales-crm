import { Supabase } from "./supabase.js";

type PriceMemory = {
  id: string;
  source_message_id: string;
  memory_value: {
    value?: {
      eur?: number;
      price_role?: string;
    };
  };
  verification_status: string;
  created_at: string;
};

export async function readCasePrices(
  db: Supabase,
  company: string,
  caseId: string,
) {
  const rows = await db.get<PriceMemory[]>(
    "cm_intel_memories",
    [
      [
        "select",
        "id,source_message_id,memory_value,verification_status,created_at",
      ],
      ["company_id", `eq.${company}`],
      ["case_id", `eq.${caseId}`],
      ["memory_type", "eq.amount_mentioned"],
      ["order", "created_at.desc"],
      ["limit", "300"],
    ],
  );

  const prices = rows
    .map(row => ({
      id: row.id,
      messageId: row.source_message_id,
      amount: row.memory_value?.value?.eur,
      role: row.memory_value?.value?.price_role,
      verified:
        row.verification_status === "verified",
      status: row.verification_status,
      recordedAt: row.created_at,
    }))
    .filter(row =>
      typeof row.amount === "number" &&
      Number.isFinite(row.amount) &&
      row.amount >= 0,
    );

  const verified = prices.filter(
    row => row.verified,
  );

  const latest = (role: string) =>
    verified.find(row => row.role === role);

  const client = latest("customer_price");
  const owner = latest("owner_cost");

  const suppliers = verified.filter(
    row => row.role === "supplier_cost",
  );

  // Las cotizaciones de proveedores pueden ser
  // revisiones del mismo presupuesto.
  // No sumar sin identificar cada partida.
  const margin =
    client && owner && suppliers.length === 0
      ? Number(client.amount) -
        Number(owner.amount)
      : null;

  return {
    prices,
    partialMarginEur: margin,
    verified:
      margin !== null,
    warning:
      margin === null
        ? "MARGIN_REQUIRES_VERIFIED_NON_DUPLICATED_COSTS"
        : "PARTIAL_MARGIN_EXCLUDES_UNRECORDED_COSTS_AND_TAXES",
  };
}
