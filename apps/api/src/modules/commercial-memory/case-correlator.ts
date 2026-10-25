import type {
  CommercialCase,
  Identity,
  Message,
  Signal,
} from "./types.js";

import { Supabase } from "./supabase.js";
import { digest } from "./keys.js";

import {
  casesForCustomer,
  ensureCase,
} from "./case.repository.js";

export type CaseDecision = {
  caseRecord: CommercialCase | null;
  ambiguous: boolean;
  reason: string;
};

export async function correlateCustomerCase(
  db: Supabase,
  identity: Identity,
  message: Message,
  signal: Signal,
): Promise<CaseDecision> {
  if (
    signal.intent !== "event_inquiry" ||
    signal.confidence < 0.75 ||
    message.direction !== "inbound"
  ) {
    return {
      caseRecord: null,
      ambiguous: false,
      reason: "not_customer_inquiry",
    };
  }

  const existing = (
    await casesForCustomer(
      db,
      message.company_id,
      identity.id,
    )
  ).filter(item =>
    !["completed", "cancelled"].includes(item.state) &&
    Math.abs(
      Date.parse(message.occurred_at) -
      Date.parse(item.last_activity_at),
    ) < 45 * 86400000,
  );

  const matches = existing.filter(item =>
    signal.eventDate
      ? item.event_date === signal.eventDate
      : (
          item.event_date === null &&
          Math.abs(
            Date.parse(message.occurred_at) -
            Date.parse(item.last_activity_at),
          ) < 14 * 86400000
        ),
  );

  if (matches.length > 1) {
    return {
      caseRecord: null,
      ambiguous: true,
      reason: "multiple_open_cases",
    };
  }

  if (matches.length === 1) {
    return {
      caseRecord: matches[0],
      ambiguous: false,
      reason: "same_contact_matching_date",
    };
  }

  if (!signal.eventDate && existing.length) {
    return {
      caseRecord: null,
      ambiguous: true,
      reason: "undated_inquiry_with_existing_cases",
    };
  }

  const bucket = message.occurred_at.slice(0, 10);

  const caseKey = digest(
    message.company_id,
    identity.id,
    signal.eventDate || bucket,
  );

  const caseRecord = await ensureCase(
    db,
    message.company_id,
    caseKey,
    identity.id,
    signal.eventDate,
    signal.eventType,
    signal.venueMention,
    message.occurred_at,
  );

  return {
    caseRecord,
    ambiguous: false,
    reason: "new_customer_case",
  };
}
