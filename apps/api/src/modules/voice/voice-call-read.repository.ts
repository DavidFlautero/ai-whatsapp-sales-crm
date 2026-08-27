import {
  isVoiceSupabaseConfigured,
  supabaseRequest,
} from "../../services/db/supabase-rest.client.js";

import {
  activeVoiceStatuses,
  memoryVoiceCalls,
  voiceCallKey,
} from "./voice-call.store.js";

import type {
  VoiceCallSession,
} from "./voice.types.js";

export async function findCallByExternalId(
  companyId: string,
  externalCallId: string,
): Promise<VoiceCallSession | null> {
  if (!isVoiceSupabaseConfigured()) {
    return (
      Array.from(
        memoryVoiceCalls.values(),
      ).find(
        (call) =>
          call.company_id
            === companyId
          && call.external_call_id
            === externalCallId,
      )
      ?? null
    );
  }

  const rows =
    await supabaseRequest<
      VoiceCallSession[]
    >({
      table:
        "call_sessions",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&external_call_id=eq.${encodeURIComponent(externalCallId)}`
        + "&select=*"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}

export async function findVoiceCall(
  companyId: string,
  callId: string,
): Promise<VoiceCallSession | null> {
  if (!isVoiceSupabaseConfigured()) {
    return (
      memoryVoiceCalls.get(
        voiceCallKey(
          companyId,
          callId,
        ),
      )
      ?? null
    );
  }

  const rows =
    await supabaseRequest<
      VoiceCallSession[]
    >({
      table:
        "call_sessions",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&id=eq.${encodeURIComponent(callId)}`
        + "&select=*"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}

export async function listVoiceCalls(
  companyId: string,
  limit = 100,
): Promise<VoiceCallSession[]> {
  const safeLimit =
    Math.min(
      200,
      Math.max(
        1,
        Math.floor(limit),
      ),
    );

  if (!isVoiceSupabaseConfigured()) {
    return Array.from(
      memoryVoiceCalls.values(),
    )
      .filter(
        (call) =>
          call.company_id
          === companyId,
      )
      .sort(
        (left, right) =>
          Date.parse(
            right.created_at
            ?? right.started_at,
          )
          - Date.parse(
            left.created_at
            ?? left.started_at,
          ),
      )
      .slice(0, safeLimit);
  }

  return supabaseRequest<
    VoiceCallSession[]
  >({
    table:
      "call_sessions",

    query:
      `?company_id=eq.${encodeURIComponent(companyId)}`
      + "&select=*"
      + "&order=created_at.desc"
      + `&limit=${safeLimit}`,
  });
}

export async function countActiveVoiceCalls(
  companyId: string,
): Promise<number> {
  if (!isVoiceSupabaseConfigured()) {
    return Array.from(
      memoryVoiceCalls.values(),
    ).filter(
      (call) =>
        call.company_id
          === companyId
        && activeVoiceStatuses.includes(
          call.status,
        ),
    ).length;
  }

  const statusFilter =
    activeVoiceStatuses.join(",");

  const rows =
    await supabaseRequest<
      Array<{ id: string }>
    >({
      table:
        "call_sessions",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&status=in.(${statusFilter})`
        + "&select=id",
    });

  return rows.length;
}
