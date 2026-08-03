import {
  supabaseRequest,
} from "../db/supabase-rest.client.js";

export type StockBalance =
  Record<string, unknown>;

function companyFilter(
  companyId: string,
) {
  return encodeURIComponent(companyId);
}

export async function listStock(
  companyId: string,
) {
  return supabaseRequest<StockBalance[]>({
    table:
      "commerce_stock_balances",

    query:
      `?company_id=eq.${companyFilter(companyId)}`
      + "&select=*"
      + "&order=updated_at.desc"
      + "&limit=1000",
  });
}

export async function listStockMovements(
  companyId: string,
) {
  return supabaseRequest<
    Array<Record<string, unknown>>
  >({
    table:
      "commerce_stock_movements",

    query:
      `?company_id=eq.${companyFilter(companyId)}`
      + "&select=*"
      + "&order=created_at.desc"
      + "&limit=500",
  });
}

export async function getStockContext(
  companyId: string,
  message: string,
) {
  const rows =
    await listStock(
      companyId,
    );

  const normalizedMessage =
    message
      .trim()
      .toLowerCase();

  const available =
    rows.filter(
      (row) => {
        const quantity =
          Number(
            row.available ?? 0,
          );

        return quantity > 0;
      },
    );

  return {
    query:
      normalizedMessage,

    totalBalances:
      rows.length,

    availableBalances:
      available.length,

    stock:
      available.slice(
        0,
        100,
      ),
  };
}
