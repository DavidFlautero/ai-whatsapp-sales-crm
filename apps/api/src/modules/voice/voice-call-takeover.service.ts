import {
  setOperatorMode,
} from "../../services/operator/operator.service.js";

import {
  findVoiceCall,
  updateVoiceCall,
} from "./voice-call.repository.js";

import {
  appendVoiceCallEvent,
} from "./voice-event.repository.js";

import {
  transitionVoiceCall,
} from "./voice-call-transition.service.js";

import {
  VoiceDomainError,
} from "./voice-state-machine.js";

import type {
  VoiceTakeoverInput,
} from "./voice-call.schema.js";

import type {
  VoiceCallSession,
} from "./voice.types.js";

export async function takeOverVoiceCall(
  companyId: string,
  callId: string,
  actorId: string,
  input: VoiceTakeoverInput,
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

  if (
    call.status !== "in_progress"
    && call.status !== "on_hold"
    && call.status !== "transferring"
  ) {
    throw new VoiceDomainError(
      "CALL_NOT_AVAILABLE_FOR_TAKEOVER",
      "La llamada no está disponible para toma humana.",
    );
  }


        const voiceMemoryMode =
    process.env.VOICE_STORAGE_DRIVER
      ?.trim()
      .toLowerCase() === "memory";

  if (!voiceMemoryMode) {
    await setOperatorMode({
      companyId,

      contactPhone:
        call.contact_phone,

      status:
        "human",

      assignedTo:
        actorId,

      reason:
        input.reason,
    });
  }


  if (call.status !== "transferring") {
    return transitionVoiceCall(
      companyId,
      callId,
      {
        status:
          "transferring",

        actor_type:
          "operator",

        actor_id:
          actorId,

        reason:
          input.reason,

        transferred_to:
          input.destination
          ?? actorId,

        metadata: {
          takeover:
            true,
        },

        external_event_id:
          null,
      },
    );
  }

  const updated =
    await updateVoiceCall(
      companyId,
      callId,
      {
        transferred_to:
          input.destination
          ?? actorId,
      },
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

    event_type:
      "call.takeover_refreshed",

    actor_type:
      "operator",

    actor_id:
      actorId,

    payload: {
      destination:
        input.destination
        ?? actorId,

      reason:
        input.reason,
    },

    occurred_at:
      new Date().toISOString(),
  });

  return updated;
}
