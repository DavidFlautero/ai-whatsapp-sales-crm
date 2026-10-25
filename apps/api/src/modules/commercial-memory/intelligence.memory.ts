import { Supabase } from "./supabase.js";
import { digest } from "./keys.js";

import type { Message } from "./types.js";
import type {
  AIObservation,
} from "./intelligence.types.js";

export async function saveCommercialMemory(
  db: Supabase,
  message: Message,
  identityId: string,
  caseId: string | null,
  observation: AIObservation,
): Promise<void> {
  const facts: Array<{
    type: string;
    value: unknown;
  }> = [];

  if (observation.event_date) {
    facts.push({
      type: "event_date_mentioned",
      value: observation.event_date,
    });
  }

  if (observation.venue_mention) {
    facts.push({
      type: "venue_mentioned",
      value: observation.venue_mention,
    });
  }

  if (observation.attendees !== null) {
    facts.push({
      type: "attendees_mentioned",
      value: observation.attendees,
    });
  }

  if (observation.amount_eur !== null) {
    facts.push({
      type: "amount_mentioned",
      value: {
        eur: observation.amount_eur,
        price_role: observation.price_role,
        commercial_move:
          observation.commercial_move,
      },
    });
  }

  for (const fact of facts) {
    const memoryKey = digest(
      message.company_id,
      identityId,
      message.id,
      fact.type,
      fact.value,
    );

    await db.insertIgnore(
      "cm_intel_memories",
      {
        company_id: message.company_id,
        memory_key: memoryKey,
        identity_id: identityId,
        case_id: caseId,
        source_message_id: message.id,
        memory_type: fact.type,
        memory_value: {
          value: fact.value,
          evidence_quote:
            observation.evidence_quote,
          direction: message.direction,
        },
        confidence: observation.confidence,
        verification_status: "proposed",
      },
      "company_id,memory_key",
    );
  }
}
