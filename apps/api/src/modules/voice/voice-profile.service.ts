import {
  findVoiceProfile,
  findVoiceRoute,
  listVoiceRoutes,
  saveVoiceProfile,
  saveVoiceRoute,
} from "./voice-profile.repository.js";

import {
  VoiceDomainError,
} from "./voice-state-machine.js";

import type {
  VoiceProfileUpdateInput,
  VoiceRouteInput,
} from "./voice-profile.schema.js";

import type {
  VoiceProfile,
  VoiceRoute,
} from "./voice.types.js";

export function defaultVoiceProfile(
  companyId: string,
): VoiceProfile {
  return {
    company_id:
      companyId,

    enabled:
      false,

    inbound_enabled:
      false,

    outbound_enabled:
      false,

    display_name:
      "Asistente telefónico",

    language:
      "es",

    timezone:
      "Europe/Madrid",

    greeting:
      "Hola, gracias por comunicarte. ¿En qué puedo ayudarte?",

    telephony_driver:
      "asterisk",

    stt_engine:
      "faster-whisper",

    tts_engine:
      "chatterbox",

    vad_engine:
      "silero",

    voice_model_id:
      null,

    voice_sample_url:
      null,

    voice_clone_consent_at:
      null,

    voice_clone_consent_by:
      null,

    interruption_enabled:
      true,

    recording_enabled:
      false,

    recording_consent_message:
      null,

    max_concurrent_calls:
      1,

    max_call_seconds:
      1800,

    retention_days:
      30,

    business_hours:
      {},

    transfer_rules:
      {},

    settings:
      {},
  };
}

export async function getVoiceProfile(
  companyId: string,
): Promise<VoiceProfile> {
  return (
    await findVoiceProfile(
      companyId,
    )
    ?? defaultVoiceProfile(
      companyId,
    )
  );
}

export async function ensureVoiceProfile(
  companyId: string,
): Promise<VoiceProfile> {
  const existing =
    await findVoiceProfile(
      companyId,
    );

  if (existing) {
    return existing;
  }

  return saveVoiceProfile(
    defaultVoiceProfile(
      companyId,
    ),
  );
}

export async function configureVoiceProfile(
  companyId: string,
  changes: VoiceProfileUpdateInput,
): Promise<VoiceProfile> {
  const existing =
    await getVoiceProfile(
      companyId,
    );

  const profile: VoiceProfile = {
    ...existing,
    ...changes,
    company_id:
      companyId,
  };

  if (
    profile.voice_model_id
    && !profile.voice_clone_consent_at
  ) {
    throw new VoiceDomainError(
      "VOICE_CLONE_CONSENT_REQUIRED",
      "No se puede activar una voz clonada sin consentimiento.",
    );
  }

  if (
    profile.recording_enabled
    && !profile.recording_consent_message
  ) {
    throw new VoiceDomainError(
      "RECORDING_CONSENT_MESSAGE_REQUIRED",
      "Debe configurarse el aviso de grabación.",
    );
  }

  return saveVoiceProfile(
    profile,
  );
}

export async function getVoiceRoutes(
  companyId: string,
): Promise<VoiceRoute[]> {
  return listVoiceRoutes(
    companyId,
  );
}

export async function configureVoiceRoute(
  companyId: string,
  input: VoiceRouteInput,
  routeId?: string,
): Promise<VoiceRoute> {
  const profile =
    await ensureVoiceProfile(
      companyId,
    );

  if (!profile.id) {
    throw new Error(
      "VOICE_PROFILE_ID_REQUIRED",
    );
  }

  if (routeId) {
    const existing =
      await findVoiceRoute(
        companyId,
        routeId,
      );

    if (!existing) {
      throw new VoiceDomainError(
        "VOICE_ROUTE_NOT_FOUND",
        "La ruta telefónica no existe.",
      );
    }
  }

  return saveVoiceRoute({
    id:
      routeId,

    company_id:
      companyId,

    profile_id:
      profile.id,

    name:
      input.name,

    direction:
      input.direction,

    did_number:
      input.did_number,

    destination_type:
      input.destination_type,

    destination:
      input.destination,

    priority:
      input.priority,

    active:
      input.active,

    conditions:
      input.conditions,

    metadata:
      input.metadata,
  });
}
