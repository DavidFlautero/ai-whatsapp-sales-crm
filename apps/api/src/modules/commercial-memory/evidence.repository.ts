import { Supabase } from "./supabase.js";

import type {
  CommercialFact,
  Message,
} from "./types.js";

import {
  digest,
  confidence,
} from "./keys.js";

export async function storeFacts(
  db: Supabase,
  message: Message,
  identityId: string | null,
  caseId: string | null,
  facts: CommercialFact[],
): Promise<void> {
  for (const fact of facts) {
    const fingerprint = digest(
      message.company_id,
      message.id,
      fact.factType,
      fact.value,
    );

    await db.insertIgnore(
      "crm_memory_facts",
      {
        company_id: message.company_id,
        fingerprint,
        source_message_id: message.id,
        identity_id: identityId,
        case_id: caseId,
        fact_type: fact.factType,
        fact_value: fact.value,
        confidence:
          confidence(fact.confidence),
        observed_at: message.occurred_at,
        status: "proposed",
        source_kind: "whatsapp",
      },
      "company_id,fingerprint",
    );
  }
}
