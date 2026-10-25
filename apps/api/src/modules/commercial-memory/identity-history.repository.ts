import { Supabase } from "./supabase.js";

export async function readIdentityHistory(
  db: Supabase,
  company: string,
  identityId: string,
) {
  if (!/^[a-f\d-]{36}$/i.test(identityId)) {
    throw new Error("INVALID_IDENTITY_ID");
  }

  const filters: Array<[string, string]> = [
    ["company_id", `eq.${company}`],
    ["identity_id", `eq.${identityId}`],
  ];

  const [roles, links, facts, cases] =
    await Promise.all([
      db.get("crm_memory_roles", [
        [
          "select",
          "role,confidence,status,evidence_message_id",
        ],
        ...filters,
      ]),

      db.get("crm_memory_entity_links", [
        [
          "select",
          "target_type,target_id,status,confidence",
        ],
        ...filters,
      ]),

      db.get("crm_memory_facts", [
        [
          "select",
          "fact_type,fact_value,confidence,status,source_message_id,observed_at",
        ],
        ...filters,
        ["order", "observed_at.desc"],
        ["limit", "300"],
      ]),

      db.get("crm_memory_cases", [
        [
          "select",
          "id,event_date,event_type,venue_label,state,last_activity_at,crm_lead_id,crm_event_id",
        ],
        ["company_id", `eq.${company}`],
        [
          "customer_identity_id",
          `eq.${identityId}`,
        ],
        ["order", "last_activity_at.desc"],
        ["limit", "100"],
      ]),
    ]);

  return {
    roles,
    links,
    facts,
    cases,
  };
}
