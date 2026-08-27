import {
  isVoiceSupabaseConfigured,
  supabaseRequest,
} from "../../services/db/supabase-rest.client.js";

import type {
  VoiceCallEvent,
  VoiceTranscriptSegment,
} from "./voice.types.js";

const memoryEvents:
  VoiceCallEvent[] = [];

const memoryTranscript:
  VoiceTranscriptSegment[] = [];

function now(): string {
  return new Date().toISOString();
}

async function findEventByExternalId(
  companyId: string,
  externalEventId: string,
): Promise<VoiceCallEvent | null> {
  if (!isVoiceSupabaseConfigured()) {
    return (
      memoryEvents.find(
        (event) =>
          event.company_id
            === companyId
          && event.external_event_id
            === externalEventId,
      )
      ?? null
    );
  }

  const rows =
    await supabaseRequest<
      VoiceCallEvent[]
    >({
      table:
        "call_events",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&external_event_id=eq.${encodeURIComponent(externalEventId)}`
        + "&select=*"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}

export async function appendVoiceCallEvent(
  event: VoiceCallEvent,
): Promise<VoiceCallEvent> {
  if (event.external_event_id) {
    const existing =
      await findEventByExternalId(
        event.company_id,
        event.external_event_id,
      );

    if (existing) {
      return existing;
    }
  }

  if (!isVoiceSupabaseConfigured()) {
    const saved: VoiceCallEvent = {
      ...event,
      id:
        event.id
        ?? crypto.randomUUID(),
      created_at:
        event.created_at
        ?? now(),
    };

    memoryEvents.push(saved);
    return saved;
  }

  const rows =
    await supabaseRequest<
      VoiceCallEvent[]
    >({
      table:
        "call_events",

      method:
        "POST",

      body:
        [event],
    });

  const saved =
    rows[0];

  if (!saved) {
    throw new Error(
      "VOICE_EVENT_SAVE_FAILED",
    );
  }

  return saved;
}

export async function listVoiceCallEvents(
  companyId: string,
  callId: string,
): Promise<VoiceCallEvent[]> {
  if (!isVoiceSupabaseConfigured()) {
    return memoryEvents
      .filter(
        (event) =>
          event.company_id
            === companyId
          && event.call_session_id
            === callId,
      )
      .sort(
        (left, right) =>
          Date.parse(left.occurred_at)
          - Date.parse(right.occurred_at),
      );
  }

  return supabaseRequest<
    VoiceCallEvent[]
  >({
    table:
      "call_events",

    query:
      `?company_id=eq.${encodeURIComponent(companyId)}`
      + `&call_session_id=eq.${encodeURIComponent(callId)}`
      + "&select=*"
      + "&order=occurred_at.asc",
  });
}

export async function appendTranscriptSegment(
  segment: VoiceTranscriptSegment,
): Promise<VoiceTranscriptSegment> {
  if (!isVoiceSupabaseConfigured()) {
    const existing =
      memoryTranscript.find(
        (item) =>
          item.company_id
            === segment.company_id
          && item.call_session_id
            === segment.call_session_id
          && item.sequence_number
            === segment.sequence_number,
      );

    if (existing) {
      Object.assign(
        existing,
        segment,
      );

      return existing;
    }

    const saved:
      VoiceTranscriptSegment = {
      ...segment,
      id:
        segment.id
        ?? crypto.randomUUID(),
      created_at:
        segment.created_at
        ?? now(),
    };

    memoryTranscript.push(saved);
    return saved;
  }

  const rows =
    await supabaseRequest<
      VoiceTranscriptSegment[]
    >({
      table:
        "call_transcript_segments",

      method:
        "POST",

      query:
        "?on_conflict=call_session_id,sequence_number",

      prefer:
        "resolution=merge-duplicates,"
        + "return=representation",

      body:
        [segment],
    });

  const saved =
    rows[0];

  if (!saved) {
    throw new Error(
      "VOICE_TRANSCRIPT_SAVE_FAILED",
    );
  }

  return saved;
}

export async function listTranscriptSegments(
  companyId: string,
  callId: string,
): Promise<VoiceTranscriptSegment[]> {
  if (!isVoiceSupabaseConfigured()) {
    return memoryTranscript
      .filter(
        (segment) =>
          segment.company_id
            === companyId
          && segment.call_session_id
            === callId,
      )
      .sort(
        (left, right) =>
          left.sequence_number
          - right.sequence_number,
      );
  }

  return supabaseRequest<
    VoiceTranscriptSegment[]
  >({
    table:
      "call_transcript_segments",

    query:
      `?company_id=eq.${encodeURIComponent(companyId)}`
      + `&call_session_id=eq.${encodeURIComponent(callId)}`
      + "&select=*"
      + "&order=sequence_number.asc",
  });
}

export async function nextTranscriptSequence(
  companyId: string,
  callId: string,
): Promise<number> {
  const segments =
    await listTranscriptSegments(
      companyId,
      callId,
    );

  const last =
    segments.at(-1);

  return last
    ? last.sequence_number + 1
    : 0;
}
