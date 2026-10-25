import { Supabase } from "./supabase.js";

import type {
  Message,
  Signal,
} from "./types.js";

import {
  requestReview,
} from "./review.repository.js";

export async function proposeOwnerLinks(
  db: Supabase,
  message: Message,
  identityId: string,
  signal: Signal,
): Promise<void> {
  if (
    signal.intent !== "owner_offer" ||
    !signal.eventDate
  ) {
    return;
  }

  const matches = await db.get<
    Array<{ id: string }>
  >(
    "crm_memory_cases",
    [
      ["select", "id"],
      [
        "company_id",
        `eq.${message.company_id}`,
      ],
      [
        "event_date",
        `eq.${signal.eventDate}`,
      ],
      ["limit", "20"],
    ],
  );

  if (!matches.length) return;

  await requestReview(
    db,
    message,
    "owner_case_link_candidate",
    {
      identityId,
      reason:
        "owner_offer_matching_event_date",
      metadata: {
        suggested_case_ids:
          matches.map(item => item.id).slice(0, 10),
        event_date: signal.eventDate,
      },
    },
    "normal",
  );
}
