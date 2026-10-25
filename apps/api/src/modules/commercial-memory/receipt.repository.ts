import { Supabase } from "./supabase.js";

export type ReceiptResult =
  | "observed"
  | "case_proposed"
  | "review_required"
  | "skipped";

export async function isProcessed(
  db: Supabase,
  company: string,
  messageId: string,
): Promise<boolean> {
  const rows = await db.get<
    Array<{ message_id: string }>
  >(
    "crm_memory_receipts",
    [
      ["select", "message_id"],
      ["company_id", `eq.${company}`],
      ["message_id", `eq.${messageId}`],
      ["limit", "1"],
    ],
  );

  return rows.length > 0;
}

export async function recordReceipt(
  db: Supabase,
  company: string,
  messageId: string,
  result: ReceiptResult,
): Promise<void> {
  await db.insertIgnore(
    "crm_memory_receipts",
    {
      company_id: company,
      message_id: messageId,
      processor_version: "stage23-v1",
      result,
    },
    "company_id,message_id",
  );
}
