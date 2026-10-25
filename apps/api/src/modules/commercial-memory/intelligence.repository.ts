import { Supabase } from "./supabase.js";

import {
  INTEL_VERSION,
} from "./intelligence.types.js";

import type {
  AIObservation,
  IntelCursor,
} from "./intelligence.types.js";

export async function loadIntelCursor(
  db: Supabase,
  company: string,
  startAt: string,
): Promise<IntelCursor> {
  const rows = await db.get<
    Array<{
      last_created_at: string;
      last_message_id: string;
    }>
  >(
    "cm_intel_cursors",
    [
      ["select", "last_created_at,last_message_id"],
      ["company_id", `eq.${company}`],
      ["processor_version", `eq.${INTEL_VERSION}`],
      ["limit", "1"],
    ],
  );

  return rows[0]
    ? {
        time: rows[0].last_created_at,
        id: rows[0].last_message_id,
      }
    : {
        time: startAt,
        id: "00000000-0000-0000-0000-000000000000",
      };
}

export async function saveIntelCursor(
  db: Supabase,
  company: string,
  cursor: IntelCursor,
): Promise<void> {
  await db.upsert(
    "cm_intel_cursors",
    {
      company_id: company,
      processor_version: INTEL_VERSION,
      last_created_at: cursor.time,
      last_message_id: cursor.id,
      updated_at: new Date().toISOString(),
    },
    "company_id,processor_version",
  );
}

export async function intelProcessed(
  db: Supabase,
  company: string,
  messageId: string,
): Promise<boolean> {
  const rows = await db.get<
    Array<{ message_id: string; result: string }>
  >(
    "cm_intel_receipts",
    [
      ["select", "message_id,result"],
      ["company_id", `eq.${company}`],
      ["message_id", `eq.${messageId}`],
      ["processor_version", `eq.${INTEL_VERSION}`],
      ["limit", "1"],
    ],
  );

  return rows.some(row => row.result !== "skipped");
}

export async function saveIntelReceipt(
  db: Supabase,
  company: string,
  messageId: string,
  result: "analyzed" | "skipped" | "unsupported",
): Promise<void> {
  await db.upsert(
    "cm_intel_receipts",
    {
      company_id: company,
      message_id: messageId,
      processor_version: INTEL_VERSION,
      result,
    },
    "company_id,message_id,processor_version",
  );
}

export async function saveIntelObservation(
  db: Supabase,
  company: string,
  messageId: string,
  identityId: string,
  model: string,
  observation: AIObservation,
): Promise<void> {
  await db.insertIgnore(
    "cm_intel_observations",
    {
      company_id: company,
      message_id: messageId,
      processor_version: INTEL_VERSION,
      model_name: model,
      identity_id: identityId,
      observation,
      evidence_quote: observation.evidence_quote,
      confidence: observation.confidence,
    },
    "company_id,message_id,processor_version",
  );
}

export async function saveIntelFailure(
  db: Supabase,
  company: string,
  messageId: string,
  code: string,
): Promise<void> {
  const rows = await db.get<
    Array<{ attempts: number }>
  >(
    "cm_intel_failures",
    [
      ["select", "attempts"],
      ["company_id", `eq.${company}`],
      ["message_id", `eq.${messageId}`],
      ["processor_version", `eq.${INTEL_VERSION}`],
      ["limit", "1"],
    ],
  );

  await db.upsert(
    "cm_intel_failures",
    {
      company_id: company,
      message_id: messageId,
      processor_version: INTEL_VERSION,
      attempts: (rows[0]?.attempts || 0) + 1,
      last_error_code: code.slice(0, 80),
      last_attempt_at: new Date().toISOString(),
    },
    "company_id,message_id,processor_version",
  );
}
