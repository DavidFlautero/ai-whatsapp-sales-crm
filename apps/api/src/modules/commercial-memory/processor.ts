import type { Config } from "./config.js";

import type {
  Message,
  CommercialCase,
} from "./types.js";

import { Supabase } from "./supabase.js";
import { normalizePhone } from "./phone.js";

import {
  ensureIdentity,
  recordProposedRole,
} from "./identity.repository.js";

import {
  rolesForIdentity,
} from "./role-context.js";

import {
  extractRules,
} from "./rules-extractor.js";

import {
  extractWithAI,
} from "./ai-extractor.js";

import {
  selectSignal,
  extractFacts,
} from "./signal-policy.js";

import {
  detectRole,
} from "./role-classifier.js";

import {
  recentContext,
} from "./messages.repository.js";

import {
  correlateCustomerCase,
} from "./case-correlator.js";

import {
  correlateFollowUp,
} from "./context-correlator.js";

import {
  attachCaseMessage,
  updateCaseActivity,
} from "./case.repository.js";

import {
  storeFacts,
} from "./evidence.repository.js";

import {
  requestReview,
} from "./review.repository.js";

import {
  linkExistingLead,
} from "./existing-crm-linker.js";

import {
  proposeOwnerLinks,
} from "./owner-case-candidates.js";

import {
  isProcessed,
  recordReceipt,
} from "./receipt.repository.js";

export type ProcessResult =
  | "observed"
  | "case_proposed"
  | "review_required"
  | "skipped"
  | "duplicate";

export async function processMessage(
  cfg: Config,
  db: Supabase,
  message: Message,
): Promise<ProcessResult> {
  if (message.company_id !== cfg.companyId) {
    throw new Error(
      "CROSS_TENANT_MESSAGE_REJECTED",
    );
  }

  if (
    await isProcessed(
      db,
      cfg.companyId,
      message.id,
    )
  ) {
    return "duplicate";
  }

  const phone = normalizePhone(
    message.contact_phone,
  );

  if (!phone) {
    await recordReceipt(
      db,
      cfg.companyId,
      message.id,
      "skipped",
    );

    return "skipped";
  }

  const identity = await ensureIdentity(
    db,
    cfg.companyId,
    phone,
  );

  const rule = extractRules(message);

  const shouldAI =
    cfg.aiEnabled &&
    message.message_type === "text" &&
    Boolean(message.body?.trim()) &&
    (
      rule.intent !== "noncommercial" ||
      /(quiero|chalet|evento|reserva|precio|disponib|confirm|transfer|se[nñ]al|catering|dj|presupuesto)/i
        .test(message.body || "")
    );

  const context = shouldAI
    ? await recentContext(
        db,
        cfg.companyId,
        phone,
        message.created_at,
        12,
      )
    : [];

  const ai = shouldAI
    ? await extractWithAI(
        cfg,
        context,
        message,
      )
    : null;

  const signal = selectSignal(
    message,
    ai,
  );

  const detectedRole = detectRole(message);

  if (detectedRole) {
    await recordProposedRole(
      db,
      cfg.companyId,
      identity.id,
      detectedRole.role,
      detectedRole.score,
      message.id,
      message.direction,
      detectedRole.why,
    );
  }

  if (
    signal.role !== "unknown" &&
    signal.confidence >= 0.78
  ) {
    await recordProposedRole(
      db,
      cfg.companyId,
      identity.id,
      signal.role,
      signal.confidence,
      message.id,
      message.direction,
      "semantic_classification",
    );
  }

  const knownRoles =
    await rolesForIdentity(
      db,
      cfg.companyId,
      identity.id,
    );

  const peerActsAsPartner =
    signal.intent === "owner_offer" ||
    signal.intent === "supplier_offer" ||
    (
      (
        knownRoles.has("owner") ||
        knownRoles.has("supplier")
      ) &&
      signal.intent !== "event_inquiry"
    );

  let caseRecord:
    CommercialCase | null = null;

  let ambiguous = false;

  if (
    !peerActsAsPartner &&
    signal.intent === "event_inquiry" &&
    message.direction === "inbound"
  ) {
    const decision =
      await correlateCustomerCase(
        db,
        identity,
        message,
        signal,
      );

    caseRecord = decision.caseRecord;
    ambiguous = decision.ambiguous;
  } else if (!peerActsAsPartner) {
    const decision = await correlateFollowUp(
      db,
      identity,
      message,
      signal,
    );

    caseRecord = decision.caseRecord;
    ambiguous = decision.ambiguous;
  }

  if (caseRecord) {
    await attachCaseMessage(
      db,
      cfg.companyId,
      caseRecord.id,
      message.id,
      signal.intent === "event_inquiry"
        ? "explicit_customer_event_query"
        : "same_customer_active_case",
      signal.intent === "event_inquiry"
        ? 0.89
        : 0.74,
    );

    await updateCaseActivity(
      db,
      cfg.companyId,
      caseRecord.id,
      message.occurred_at,
    );

    if (signal.intent === "event_inquiry") {
      await linkExistingLead(
        db,
        identity,
        message,
        caseRecord,
      );
    }
  }

  const facts = extractFacts(signal);

  if (facts.length) {
    await storeFacts(
      db,
      message,
      identity.id,
      caseRecord?.id || null,
      facts,
    );
  }

  let needsReview = ambiguous;

  if (ambiguous) {
    await requestReview(
      db,
      message,
      "ambiguous_case_match",
      {
        identityId: identity.id,
        reason:
          "multiple_or_undated_open_cases",
      },
      "high",
    );
  }

  if (signal.potentialAcceptance) {
    needsReview = true;

    await requestReview(
      db,
      message,
      "possible_booking_confirmation",
      {
        identityId: identity.id,
        caseId: caseRecord?.id,
        reason:
          "potential_agreement_no_automatic_confirmation",
      },
      "high",
    );
  }

  if (signal.intent === "owner_offer") {
    await proposeOwnerLinks(
      db,
      message,
      identity.id,
      signal,
    );
  }

  const result:
    Exclude<ProcessResult, "duplicate"> =
    needsReview
      ? "review_required"
      : caseRecord
        ? "case_proposed"
        : "observed";

  await recordReceipt(
    db,
    cfg.companyId,
    message.id,
    result,
  );

  return result;
}
