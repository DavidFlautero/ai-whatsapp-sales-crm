import {
  findVoiceCall,
  listVoiceCalls,
} from "./voice-call.repository.js";

import {
  appendTranscriptSegment,
  appendVoiceCallEvent,
  listTranscriptSegments,
  listVoiceCallEvents,
  nextTranscriptSequence,
} from "./voice-event.repository.js";

import {
  VoiceDomainError,
} from "./voice-state-machine.js";

import type {
  VoiceEventInput,
  VoiceTranscriptInput,
} from "./voice-call.schema.js";

import type {
  VoiceCallDetail,
  VoiceCallSession,
} from "./voice.types.js";

async function requireVoiceCall(
  companyId: string,
  callId: string,
): Promise<VoiceCallSession> {
  const call =
    await findVoiceCall(
      companyId,
      callId,
    );

  if (!call) {
    throw new VoiceDomainError(
      "VOICE_CALL_NOT_FOUND",
      "La llamada no existe.",
    );
  }

  return call;
}

export async function getVoiceCalls(
  companyId: string,
  limit = 100,
): Promise<VoiceCallSession[]> {
  return listVoiceCalls(
    companyId,
    limit,
  );
}

export async function getVoiceCallDetail(
  companyId: string,
  callId: string,
): Promise<VoiceCallDetail> {
  const call =
    await requireVoiceCall(
      companyId,
      callId,
    );

  const [
    events,
    transcript,
  ] = await Promise.all([
    listVoiceCallEvents(
      companyId,
      callId,
    ),

    listTranscriptSegments(
      companyId,
      callId,
    ),
  ]);

  return {
    call,
    events,
    transcript,
  };
}

export async function registerVoiceEvent(
  companyId: string,
  callId: string,
  actorId: string | null,
  input: VoiceEventInput,
) {
  await requireVoiceCall(
    companyId,
    callId,
  );

  return appendVoiceCallEvent({
    company_id:
      companyId,

    call_session_id:
      callId,

    external_event_id:
      input.external_event_id,

    event_type:
      input.event_type,

    actor_type:
      input.actor_type,

    actor_id:
      actorId,

    payload:
      input.payload,

    occurred_at:
      input.occurred_at
      ?? new Date().toISOString(),
  });
}

export async function registerTranscriptSegment(
  companyId: string,
  callId: string,
  input: VoiceTranscriptInput,
) {
  await requireVoiceCall(
    companyId,
    callId,
  );

  return appendTranscriptSegment({
    company_id:
      companyId,

    call_session_id:
      callId,

    sequence_number:
      input.sequence_number,

    speaker:
      input.speaker,

    text:
      input.text,

    is_final:
      input.is_final,

    confidence:
      input.confidence
      ?? null,

    starts_at_ms:
      input.starts_at_ms
      ?? null,

    ends_at_ms:
      input.ends_at_ms
      ?? null,

    metadata:
      input.metadata,
  });
}

export async function allocateTranscriptSequence(
  companyId: string,
  callId: string,
): Promise<number> {
  await requireVoiceCall(
    companyId,
    callId,
  );

  return nextTranscriptSequence(
    companyId,
    callId,
  );
}
