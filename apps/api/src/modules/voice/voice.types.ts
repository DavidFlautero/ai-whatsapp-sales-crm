export const VOICE_CALL_STATUSES = [
  "queued",
  "ringing",
  "connecting",
  "in_progress",
  "on_hold",
  "transferring",
  "transferred",
  "completed",
  "failed",
  "busy",
  "no_answer",
  "cancelled",
] as const;

export type VoiceCallStatus =
  (typeof VOICE_CALL_STATUSES)[number];

export type VoiceCallDirection =
  | "inbound"
  | "outbound";

export type VoiceActorType =
  | "customer"
  | "assistant"
  | "operator"
  | "provider"
  | "system";

export type VoiceSpeaker =
  | "customer"
  | "assistant"
  | "operator"
  | "system";

export type VoiceJson =
  Record<string, unknown>;

export type VoiceProfile = {
  id?: string;
  company_id: string;

  enabled: boolean;
  inbound_enabled: boolean;
  outbound_enabled: boolean;

  display_name: string;
  language: string;
  timezone: string;
  greeting: string;

  telephony_driver: string;
  stt_engine: string;
  tts_engine: string;
  vad_engine: string;

  voice_model_id?: string | null;
  voice_sample_url?: string | null;
  voice_clone_consent_at?: string | null;
  voice_clone_consent_by?: string | null;

  interruption_enabled: boolean;
  recording_enabled: boolean;
  recording_consent_message?: string | null;

  max_concurrent_calls: number;
  max_call_seconds: number;
  retention_days: number;

  business_hours: VoiceJson;
  transfer_rules: VoiceJson;
  settings: VoiceJson;

  created_at?: string;
  updated_at?: string;
};

export type VoiceProfileUpdate =
  Partial<
    Omit<
      VoiceProfile,
      | "id"
      | "company_id"
      | "created_at"
      | "updated_at"
    >
  >;

export type VoiceRouteDirection =
  | "inbound"
  | "outbound"
  | "both";

export type VoiceDestinationType =
  | "voice_agent"
  | "human"
  | "queue"
  | "voicemail";

export type VoiceRoute = {
  id?: string;
  company_id: string;
  profile_id: string;

  name: string;
  direction: VoiceRouteDirection;
  did_number?: string | null;
  destination_type: VoiceDestinationType;
  destination?: string | null;

  priority: number;
  active: boolean;

  conditions: VoiceJson;
  metadata: VoiceJson;

  created_at?: string;
  updated_at?: string;
};

export type VoiceCallSession = {
  id?: string;
  company_id: string;

  profile_id?: string | null;
  route_id?: string | null;
  contact_id?: string | null;
  conversation_id?: string | null;

  external_call_id?: string | null;
  direction: VoiceCallDirection;
  status: VoiceCallStatus;

  from_number?: string | null;
  to_number?: string | null;
  contact_phone: string;

  started_at: string;
  answered_at?: string | null;
  ended_at?: string | null;

  duration_seconds?: number | null;
  billable_seconds?: number | null;

  recording_enabled: boolean;
  recording_consent?: boolean | null;
  recording_url?: string | null;

  disposition?: string | null;
  summary?: string | null;
  transferred_to?: string | null;
  failure_reason?: string | null;

  metadata: VoiceJson;

  created_at?: string;
  updated_at?: string;
};

export type VoiceCallEvent = {
  id?: string;
  company_id: string;
  call_session_id: string;

  external_event_id?: string | null;
  event_type: string;
  actor_type: VoiceActorType;
  actor_id?: string | null;

  payload: VoiceJson;
  occurred_at: string;
  created_at?: string;
};

export type VoiceTranscriptSegment = {
  id?: string;
  company_id: string;
  call_session_id: string;

  sequence_number: number;
  speaker: VoiceSpeaker;
  text: string;
  is_final: boolean;

  confidence?: number | null;
  starts_at_ms?: number | null;
  ends_at_ms?: number | null;

  metadata: VoiceJson;
  created_at?: string;
};

export type VoiceCallDetail = {
  call: VoiceCallSession;
  events: VoiceCallEvent[];
  transcript: VoiceTranscriptSegment[];
};
