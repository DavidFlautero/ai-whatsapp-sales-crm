import type {
  CommercialCase,
  Identity,
  Message,
  Signal,
} from "./types.js";

import { Supabase } from "./supabase.js";

import {
  casesForCustomer,
} from "./case.repository.js";

export async function correlateFollowUp(
  db: Supabase,
  identity: Identity,
  message: Message,
  signal: Signal,
): Promise<{
  caseRecord: CommercialCase | null;
  ambiguous: boolean;
}> {
  const candidates = (
    await casesForCustomer(
      db,
      message.company_id,
      identity.id,
    )
  ).filter(item =>
    !["completed", "cancelled"]
      .includes(item.state) &&

    Math.abs(
      Date.parse(message.occurred_at) -
      Date.parse(item.last_activity_at),
    ) < 21 * 86400000 &&

    (
      !signal.eventDate ||
      !item.event_date ||
      item.event_date === signal.eventDate
    ),
  );

  if (candidates.length === 1) {
    return {
      caseRecord: candidates[0],
      ambiguous: false,
    };
  }

  return {
    caseRecord: null,
    ambiguous: candidates.length > 1,
  };
}
