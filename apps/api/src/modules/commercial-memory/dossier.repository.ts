import { Supabase } from "./supabase.js";

export async function readDossier(
  db: Supabase,
  company: string,
  caseId: string,
) {
  if (!/^[a-f\d-]{36}$/i.test(caseId)) {
    throw new Error("INVALID_CASE_ID");
  }

  const [cases, facts, messages] =
    await Promise.all([
      db.get("crm_memory_cases", [
        ["select", "*"],
        ["company_id", `eq.${company}`],
        ["id", `eq.${caseId}`],
        ["limit", "1"],
      ]),

      db.get("crm_memory_facts", [
        [
          "select",
          "id,source_message_id,fact_type,fact_value,confidence,status,observed_at",
        ],
        ["company_id", `eq.${company}`],
        ["case_id", `eq.${caseId}`],
        ["order", "observed_at.asc"],
        ["limit", "1000"],
      ]),

      db.get("crm_memory_case_messages", [
        [
          "select",
          "message_id,association_status,association_reason,confidence",
        ],
        ["company_id", `eq.${company}`],
        ["case_id", `eq.${caseId}`],
        ["limit", "1000"],
      ]),
    ]);

  return {
    cases,
    facts,
    messages,
  };
}
