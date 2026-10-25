import { extractCommercialText } from "./commercial-text.js";
import type { Config } from "./config.js";
import type { Message } from "./types.js";

import { Supabase } from "./supabase.js";
import { normalizePhone } from "./phone.js";

import {
  ensureIdentity,
  recordProposedRole,
} from "./identity.repository.js";

import {
  recentContext,
} from "./messages.repository.js";

import {
  analyzeCommercialMessage,
} from "./intelligence.extractor.js";

import {
  guardObservation,
} from "./intelligence.guard.js";

import {
  intelProcessed,
  saveIntelObservation,
  saveIntelReceipt,
} from "./intelligence.repository.js";

import {
  proposePartnerAssociation,
} from "./intelligence.correlator.js";

import {
  saveCommercialMemory,
} from "./intelligence.memory.js";

import {
  proposeCommercialAction,
} from "./intelligence.actions.js";

import {
  INTEL_VERSION,
} from "./intelligence.types.js";

import type {
  AIObservation,
} from "./intelligence.types.js";

async function findSupportedCase(
  db: Supabase,
  message: Message,
  observation: AIObservation,
): Promise<string | null> {
  if (!observation.event_date) return null;

  const linked = await db.get<
    Array<{ case_id: string }>
  >(
    "crm_memory_case_messages",
    [
      ["select", "case_id"],
      ["company_id", `eq.${message.company_id}`],
      ["message_id", `eq.${message.id}`],
      ["association_status", "neq.rejected"],
      ["limit", "10"],
    ],
  );

  const uniqueIds = [...new Set(
    linked.map(row => row.case_id),
  )];

  if (uniqueIds.length !== 1) return null;

  const cases = await db.get<
    Array<{ event_date: string | null }>
  >(
    "crm_memory_cases",
    [
      ["select", "event_date"],
      ["company_id", `eq.${message.company_id}`],
      ["id", `eq.${uniqueIds[0]}`],
      ["limit", "1"],
    ],
  );

  return cases[0]?.event_date ===
    observation.event_date
      ? uniqueIds[0]
      : null;
}

export async function processIntelligence(
  cfg: Config,
  db: Supabase,
  message: Message,
): Promise<"analyzed" | "skipped" | "unsupported"> {
  if (message.company_id !== cfg.companyId) {
    throw new Error("CROSS_COMPANY_INTEL_REJECTED");
  }

  if (
    await intelProcessed(
      db,
      cfg.companyId,
      message.id,
    )
  ) {
    return "skipped";
  }

  const commercialText =
    extractCommercialText(message);

  if (!commercialText) {
    await saveIntelReceipt(
      db,
      cfg.companyId,
      message.id,
      "skipped",
    );

    return "skipped";
  }

  const semanticMessage: Message = {
    ...message,
    body: commercialText,
    message_type: "text",
  };

  const phone = normalizePhone(
    message.contact_phone,
  );

  if (!phone) {
    await saveIntelReceipt(
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

  let observation: AIObservation | null = null;

  const previous = await db.get<
    Array<{ observation: AIObservation }>
  >(
    "cm_intel_observations",
    [
      ["select", "observation"],
      ["company_id", `eq.${cfg.companyId}`],
      ["message_id", `eq.${message.id}`],
      ["processor_version", `eq.${INTEL_VERSION}`],
      ["limit", "1"],
    ],
  );

  if (previous.length) {
    observation = previous[0].observation;
  } else {
    const context = await recentContext(
      db,
      cfg.companyId,
      phone,
      message.created_at,
      10,
    );

    const raw = await analyzeCommercialMessage(
      cfg,
      semanticMessage,
      context,
    );

    observation = guardObservation(
      semanticMessage,
      raw,
    );

    if (observation) {
      await saveIntelObservation(
        db,
        cfg.companyId,
        message.id,
        identity.id,
        cfg.openaiModel,
        observation,
      );
    }
  }

  if (!observation) {
    await saveIntelReceipt(
      db,
      cfg.companyId,
      message.id,
      "unsupported",
    );

    return "unsupported";
  }

  if (
    observation.actor_role !== "unknown" &&
    observation.confidence >= 0.78
  ) {
    await recordProposedRole(
      db,
      cfg.companyId,
      identity.id,
      observation.actor_role,
      observation.confidence,
      message.id,
      message.direction,
      "commercial_intelligence_v2",
    );

    await db.insertIgnore(
      "cm_identity_role_evidence",
      {
        company_id: cfg.companyId,
        identity_id: identity.id,
        role: observation.actor_role,
        source_message_id: message.id,
        confidence: observation.confidence,
        extractor_version: INTEL_VERSION,
      },
      "company_id,identity_id,role,source_message_id",
    );
  }

  const caseId = await findSupportedCase(
    db,
    message,
    observation,
  );

  await saveCommercialMemory(
    db,
    message,
    identity.id,
    caseId,
    observation,
  );

  await proposePartnerAssociation(
    db,
    message,
    identity.id,
    observation,
  );

  await proposeCommercialAction(
    db,
    message,
    identity.id,
    caseId,
    observation,
  );

  await saveIntelReceipt(
    db,
    cfg.companyId,
    message.id,
    "analyzed",
  );

  return "analyzed";
}
