import {
  isVoiceSupabaseConfigured,
  supabaseRequest,
} from "../../services/db/supabase-rest.client.js";

import {
  memoryVoiceCalls,
  voiceCallKey,
  voiceNow,
} from "./voice-call.store.js";

import {
  findVoiceCall,
} from "./voice-call-read.repository.js";

import type {
  VoiceCallSession,
} from "./voice.types.js";

export async function createVoiceCall(
  call: VoiceCallSession,
): Promise<VoiceCallSession> {
  if (!isVoiceSupabaseConfigured()) {
    const timestamp =
      voiceNow();

    const saved: VoiceCallSession = {
      ...call,
      id:
        call.id
        ?? crypto.randomUUID(),
      created_at:
        call.created_at
        ?? timestamp,
      updated_at:
        timestamp,
    };

    memoryVoiceCalls.set(
      voiceCallKey(
        saved.company_id,
        saved.id!,
      ),
      saved,
    );

    return saved;
  }

  const rows =
    await supabaseRequest<
      VoiceCallSession[]
    >({
      table:
        "call_sessions",

      method:
        "POST",

      body:
        [call],
    });

  const saved =
    rows[0];

  if (!saved) {
    throw new Error(
      "VOICE_CALL_CREATE_FAILED",
    );
  }

  return saved;
}

export async function updateVoiceCall(
  companyId: string,
  callId: string,
  changes:
    Partial<VoiceCallSession>,
): Promise<VoiceCallSession | null> {
  if (!isVoiceSupabaseConfigured()) {
    const existing =
      await findVoiceCall(
        companyId,
        callId,
      );

    if (!existing) {
      return null;
    }

    const saved: VoiceCallSession = {
      ...existing,
      ...changes,
      id:
        existing.id,
      company_id:
        existing.company_id,
      updated_at:
        voiceNow(),
    };

    memoryVoiceCalls.set(
      voiceCallKey(
        companyId,
        callId,
      ),
      saved,
    );

    return saved;
  }

  const safeChanges:
    Partial<VoiceCallSession> = {
    ...changes,
  };

  delete safeChanges.id;
  delete safeChanges.company_id;
  delete safeChanges.created_at;

  const rows =
    await supabaseRequest<
      VoiceCallSession[]
    >({
      table:
        "call_sessions",

      method:
        "PATCH",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&id=eq.${encodeURIComponent(callId)}`,

      body:
        safeChanges,
    });

  return rows[0]
    ?? null;
}
