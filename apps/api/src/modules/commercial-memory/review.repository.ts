import { Supabase } from "./supabase.js";

import type {
  ReviewType,
  Message,
} from "./types.js";

import { digest } from "./keys.js";

export async function requestReview(
  db: Supabase,
  message: Message,
  type: ReviewType,
  subject: {
    identityId?: string | null;
    caseId?: string | null;
    reason: string;
    metadata?: Record<string, unknown>;
  },
  priority:
    | "normal"
    | "high"
    | "critical" = "normal",
): Promise<void> {
  const fingerprint = digest(
    message.company_id,
    message.id,
    type,
    subject.caseId || "",
    subject.identityId || "",
  );

  await db.insertIgnore(
    "crm_memory_reviews",
    {
      company_id: message.company_id,
      fingerprint,
      source_message_id: message.id,
      identity_id: subject.identityId || null,
      case_id: subject.caseId || null,
      review_type: type,
      priority,
      status: "open",
      metadata: {
        reason: subject.reason,
        ...subject.metadata,
      },
    },
    "company_id,fingerprint",
  );
}
