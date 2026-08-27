import {
  getOrCreateConversation,
} from "../../services/conversations/conversation.repository.js";

import {
  countActiveVoiceCalls,
  createVoiceCall,
  findCallByExternalId,
} from "./voice-call.repository.js";

import {
  appendVoiceCallEvent,
} from "./voice-event.repository.js";

import {
  findVoiceRoute,
} from "./voice-profile.repository.js";

import {
  ensureVoiceProfile,
} from "./voice-profile.service.js";

import {
  VoiceDomainError,
} from "./voice-state-machine.js";

import type {
  CreateVoiceCallInput,
} from "./voice-call.schema.js";

import type {
  VoiceCallSession,
} from "./voice.types.js";

function normalizePhone(
  value: string,
): string {
  const trimmed =
    value.trim();

  const international =
    trimmed.startsWith("+");

  const digits =
    trimmed.replace(/\D/g, "");

  if (digits.length < 3) {
    throw new VoiceDomainError(
      "INVALID_CONTACT_PHONE",
      "El número telefónico no es válido.",
    );
  }

  return international
    ? `+${digits}`
    : digits;
}

export async function startVoiceCall(
  companyId: string,
  input: CreateVoiceCallInput,
): Promise<VoiceCallSession> {
  const profile =
    await ensureVoiceProfile(
      companyId,
    );

  if (!profile.enabled) {
    throw new VoiceDomainError(
      "VOICE_MODULE_DISABLED",
      "El módulo de llamadas no está activo.",
    );
  }

  if (
    input.direction === "inbound"
    && !profile.inbound_enabled
  ) {
    throw new VoiceDomainError(
      "INBOUND_CALLS_DISABLED",
      "Las llamadas entrantes están desactivadas.",
    );
  }

  if (
    input.direction === "outbound"
    && !profile.outbound_enabled
  ) {
    throw new VoiceDomainError(
      "OUTBOUND_CALLS_DISABLED",
      "Las llamadas salientes están desactivadas.",
    );
  }

  if (input.external_call_id) {
    const existing =
      await findCallByExternalId(
        companyId,
        input.external_call_id,
      );

    if (existing) {
      return existing;
    }
  }

  const activeCalls =
    await countActiveVoiceCalls(
      companyId,
    );

  if (
    activeCalls
    >= profile.max_concurrent_calls
  ) {
    throw new VoiceDomainError(
      "VOICE_CONCURRENCY_LIMIT_REACHED",
      "Se alcanzó el límite de llamadas simultáneas.",
    );
  }

  if (input.route_id) {
    const route =
      await findVoiceRoute(
        companyId,
        input.route_id,
      );

    if (!route || !route.active) {
      throw new VoiceDomainError(
        "VOICE_ROUTE_NOT_AVAILABLE",
        "La ruta telefónica no está disponible.",
      );
    }

    if (
      route.direction !== "both"
      && route.direction
        !== input.direction
    ) {
      throw new VoiceDomainError(
        "VOICE_ROUTE_DIRECTION_MISMATCH",
        "La ruta no admite esta dirección de llamada.",
      );
    }
  }

  const contactPhone =
    normalizePhone(
      input.contact_phone,
    );


        const voiceMemoryMode =
    process.env.VOICE_STORAGE_DRIVER
      ?.trim()
      .toLowerCase() === "memory";

  const conversationContext =
    voiceMemoryMode
      ? {
          contact: {
            id: undefined,
          },
          conversation: {
            id: undefined,
          },
        }
      : await getOrCreateConversation(
          contactPhone,
          input.direction === "inbound"
            ? "Llamada entrante"
            : "Llamada saliente",
          companyId,
          "voice",
        );


  const startedAt =
    new Date().toISOString();

  const call =
    await createVoiceCall({
      company_id:
        companyId,

      profile_id:
        profile.id
        ?? null,

      route_id:
        input.route_id,

      contact_id:
        conversationContext
          .contact.id
        ?? null,

      conversation_id:
        conversationContext
          .conversation.id
        ?? null,

      external_call_id:
        input.external_call_id,

      direction:
        input.direction,

      status:
        input.direction === "inbound"
          ? "ringing"
          : "queued",

      from_number:
        input.from_number
        ?? (
          input.direction === "inbound"
            ? contactPhone
            : null
        ),

      to_number:
        input.to_number
        ?? (
          input.direction === "outbound"
            ? contactPhone
            : null
        ),

      contact_phone:
        contactPhone,

      started_at:
        startedAt,

      answered_at:
        null,

      ended_at:
        null,

      duration_seconds:
        null,

      billable_seconds:
        null,

      recording_enabled:
        profile.recording_enabled,

      recording_consent:
        null,

      metadata: {
        ...input.metadata,

        maxCallSeconds:
          profile.max_call_seconds,

        interruptionEnabled:
          profile.interruption_enabled,

        sttEngine:
          profile.stt_engine,

        ttsEngine:
          profile.tts_engine,

        vadEngine:
          profile.vad_engine,
      },
    });

  if (!call.id) {
    throw new Error(
      "VOICE_CALL_ID_REQUIRED",
    );
  }

  await appendVoiceCallEvent({
    company_id:
      companyId,

    call_session_id:
      call.id,

    event_type:
      "call.created",

    actor_type:
      "system",

    payload: {
      direction:
        call.direction,

      initialStatus:
        call.status,

      profileId:
        call.profile_id
        ?? null,
    },

    occurred_at:
      startedAt,
  });

  return call;
}
