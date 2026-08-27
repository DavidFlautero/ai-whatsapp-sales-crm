import {
  findVoiceCall,
  updateVoiceCall,
} from "./voice-call.repository.js";

import {
  appendVoiceCallEvent,
} from "./voice-event.repository.js";

import {
  assertVoiceTransition,
  isTerminalVoiceStatus,
  VoiceDomainError,
} from "./voice-state-machine.js";

import type {
  TransitionVoiceCallInput,
} from "./voice-call.schema.js";

import type {
  VoiceCallSession,
} from "./voice.types.js";

export type VoiceTransitionCommand =
  TransitionVoiceCallInput & {
    actor_id?: string | null;
  };

function elapsedSeconds(
  start: string | null | undefined,
  end: string,
): number | null {
  if (!start) {
    return null;
  }

  const milliseconds =
    Date.parse(end)
    - Date.parse(start);

  if (!Number.isFinite(milliseconds)) {
    return null;
  }

  return Math.max(
    0,
    Math.floor(milliseconds / 1000),
  );
}

export async function transitionVoiceCall(
  companyId: string,
  callId: string,
  input: VoiceTransitionCommand,
): Promise<VoiceCallSession> {
  const existing =
    await findVoiceCall(
      companyId,
      callId,
    );

  if (!existing) {
    throw new VoiceDomainError(
      "VOICE_CALL_NOT_FOUND",
      "La llamada no existe.",
    );
  }

  assertVoiceTransition(
    existing.status,
    input.status,
  );

  if (existing.status === input.status) {
    return existing;
  }

  const occurredAt =
    new Date().toISOString();

  const changes:
    Partial<VoiceCallSession> = {
    status:
      input.status,

    metadata: {
      ...existing.metadata,
      ...input.metadata,
    },
  };

  if (
    input.status === "in_progress"
    && !existing.answered_at
  ) {
    changes.answered_at =
      occurredAt;
  }

  if (
    input.disposition
    !== undefined
  ) {
    changes.disposition =
      input.disposition;
  }

  if (input.summary !== undefined) {
    changes.summary =
      input.summary;
  }

  if (
    input.transferred_to
    !== undefined
  ) {
    changes.transferred_to =
      input.transferred_to;
  }

  if (
    input.recording_consent
    !== undefined
  ) {
    changes.recording_consent =
      input.recording_consent;
  }

  if (
    input.recording_url
    !== undefined
  ) {
    changes.recording_url =
      input.recording_url;
  }

  if (input.status === "failed") {
    changes.failure_reason =
      input.reason
      ?? "Fallo sin detalle.";
  }

  if (
    isTerminalVoiceStatus(
      input.status,
    )
  ) {
    changes.ended_at =
      occurredAt;

    changes.duration_seconds =
      elapsedSeconds(
        existing.started_at,
        occurredAt,
      );

    changes.billable_seconds =
      elapsedSeconds(
        existing.answered_at,
        occurredAt,
      );
  }

  const updated =
    await updateVoiceCall(
      companyId,
      callId,
      changes,
    );

  if (!updated) {
    throw new VoiceDomainError(
      "VOICE_CALL_NOT_FOUND",
      "La llamada dejó de estar disponible.",
    );
  }

  await appendVoiceCallEvent({
    company_id:
      companyId,

    call_session_id:
      callId,

    external_event_id:
      input.external_event_id,

    event_type:
      `call.${input.status}`,

    actor_type:
      input.actor_type,

    actor_id:
      input.actor_id
      ?? null,

    payload: {
      from:
        existing.status,

      to:
        input.status,

      reason:
        input.reason,

      ...input.metadata,
    },

    occurred_at:
      occurredAt,
  });

  return updated;
}
