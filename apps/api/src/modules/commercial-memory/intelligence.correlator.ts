import { Supabase } from "./supabase.js";
import { digest } from "./keys.js";

import type { Message } from "./types.js";
import type {
  AIObservation,
} from "./intelligence.types.js";

import {
  requestReview,
} from "./review.repository.js";

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export async function proposePartnerAssociation(
  db: Supabase,
  message: Message,
  identityId: string,
  observation: AIObservation,
): Promise<void> {
  const role = observation.actor_role;

  if (
    role !== "owner" &&
    role !== "supplier" &&
    role !== "organizer"
  ) {
    return;
  }

  if (
    !observation.event_date ||
    !observation.venue_mention ||
    observation.confidence < 0.75
  ) {
    return;
  }

  const cases = await db.get<
    Array<{
      id: string;
      venue_label: string | null;
    }>
  >(
    "crm_memory_cases",
    [
      ["select", "id,venue_label"],
      ["company_id", `eq.${message.company_id}`],
      ["event_date", `eq.${observation.event_date}`],
      ["state", "not.in.(cancelled,completed)"],
      ["limit", "50"],
    ],
  );

  const venue = normalized(
    observation.venue_mention,
  );

  if (venue.length < 5) return;

  const matches = cases.filter(item => {
    const candidate = normalized(
      item.venue_label || "",
    );

    if (candidate.length < 5) return false;

    return (
      candidate === venue ||
      (
        candidate.length >= 8 &&
        venue.length >= 8 &&
        (
          candidate.includes(venue) ||
          venue.includes(candidate)
        )
      )
    );
  });

  if (matches.length !== 1) {
    if (matches.length > 1) {
      await requestReview(
        db,
        message,
        "owner_case_link_candidate",
        {
          identityId,
          reason: "multiple_matching_operations",
          metadata: {
            possible_case_ids:
              matches.map(x => x.id).slice(0, 10),
          },
        },
        "high",
      );
    }

    return;
  }

  const caseId = matches[0].id;

  const key = digest(
    message.company_id,
    caseId,
    identityId,
    role,
    message.id,
  );

  await db.insertIgnore(
    "cm_operation_partners",
    {
      company_id: message.company_id,
      link_key: key,
      case_id: caseId,
      identity_id: identityId,
      partner_role: role,
      source_message_id: message.id,
      confidence: 0.86,
      status: "proposed",
      evidence: {
        association_reason:
          "explicit_date_and_venue_match",
        event_date: observation.event_date,
        venue: observation.venue_mention,
        evidence_quote:
          observation.evidence_quote,
      },
    },
    "company_id,link_key",
  );

  await requestReview(
    db,
    message,
    "owner_case_link_candidate",
    {
      identityId,
      caseId,
      reason: "review_cross_conversation_partner",
    },
    "normal",
  );
}
