import {
  Supabase,
  DbError,
} from "./supabase.js";

import { normalizePhone } from "./phone.js";

import {
  requestReview,
} from "./review.repository.js";

import type {
  CommercialCase,
  Identity,
  Message,
} from "./types.js";

export async function linkExistingLead(
  db: Supabase,
  identity: Identity,
  message: Message,
  caseRecord: CommercialCase,
): Promise<void> {
  let rows: Array<{
    id: string;
    whatsapp: string | null;
  }>;

  try {
    rows = await db.get<
      Array<{
        id: string;
        whatsapp: string | null;
      }>
    >(
      "crm_lead_requests",
      [
        ["select", "id,whatsapp"],
        [
          "company_id",
          `eq.${message.company_id}`,
        ],
        ["limit", "1000"],
      ],
    );
  } catch (error) {
    if (
      error instanceof DbError &&
      [400, 404].includes(error.httpStatus)
    ) {
      return;
    }

    throw error;
  }

  if (rows.length === 1000) return;

  const matches = rows.filter(row =>
    normalizePhone(row.whatsapp) ===
    identity.primary_phone,
  );

  if (
    matches.length === 1 &&
    !caseRecord.crm_lead_id
  ) {
    await requestReview(
      db,
      message,
      "ambiguous_case_match",
      {
        identityId: identity.id,
        caseId: caseRecord.id,
        reason:
          "existing_lead_needs_event_verification",
        metadata: {
          suggested_crm_lead_id:
            matches[0].id,
        },
      },
    );
  } else if (matches.length > 1) {
    await requestReview(
      db,
      message,
      "ambiguous_case_match",
      {
        identityId: identity.id,
        caseId: caseRecord.id,
        reason:
          "multiple_existing_leads_same_contact",
        metadata: {
          existing_lead_count: matches.length,
        },
      },
      "high",
    );
  }
}
