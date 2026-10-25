import type {
  CommercialCase,
} from "./types.js";

import { Supabase } from "./supabase.js";

export async function casesForCustomer(
  db: Supabase,
  company: string,
  identityId: string,
): Promise<CommercialCase[]> {
  return db.get<CommercialCase[]>(
    "crm_memory_cases",
    [
      [
        "select",
        "id,company_id,case_key,customer_identity_id,event_date,event_type,venue_label,state,last_activity_at",
      ],
      ["company_id", `eq.${company}`],
      [
        "customer_identity_id",
        `eq.${identityId}`,
      ],
      ["order", "last_activity_at.desc"],
      ["limit", "30"],
    ],
  );
}

export async function ensureCase(
  db: Supabase,
  company: string,
  caseKey: string,
  identityId: string,
  date: string | null,
  eventType: string | null,
  venue: string | null,
  occurredAt: string,
): Promise<CommercialCase> {
  await db.insertIgnore(
    "crm_memory_cases",
    {
      company_id: company,
      case_key: caseKey,
      customer_identity_id: identityId,
      event_date: date,
      event_type: eventType,
      venue_label: venue,
      opened_at: occurredAt,
      last_activity_at: occurredAt,
      state: "inquiry",
    },
    "company_id,case_key",
  );

  const rows = await db.get<CommercialCase[]>(
    "crm_memory_cases",
    [
      [
        "select",
        "id,company_id,case_key,customer_identity_id,event_date,event_type,venue_label,state,last_activity_at",
      ],
      ["company_id", `eq.${company}`],
      ["case_key", `eq.${caseKey}`],
      ["limit", "1"],
    ],
  );

  if (!rows[0]) {
    throw new Error("CASE_UPSERT_READ_FAILED");
  }

  return rows[0];
}

export async function attachCaseMessage(
  db: Supabase,
  company: string,
  caseId: string,
  messageId: string,
  reason: string,
  score: number,
): Promise<void> {
  await db.insertIgnore(
    "crm_memory_case_messages",
    {
      company_id: company,
      case_id: caseId,
      message_id: messageId,
      association_status: "proposed",
      association_reason: reason,
      confidence: score,
    },
    "company_id,case_id,message_id",
  );
}

export async function updateCaseActivity(
  db: Supabase,
  company: string,
  caseId: string,
  occurredAt: string,
): Promise<void> {
  await db.request(
    "crm_memory_cases",
    {
      method: "PATCH",
      filters: [
        ["company_id", `eq.${company}`],
        ["id", `eq.${caseId}`],
        [
          "last_activity_at",
          `lt.${occurredAt}`,
        ],
      ],
      body: {
        last_activity_at: occurredAt,
        updated_at: new Date().toISOString(),
      },
      returnRepresentation: false,
    },
  );
}
