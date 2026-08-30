export const PRIVACY_POLICY_STATUSES = [
  "draft",
  "active",
  "retired",
] as const;

export const PRIVACY_SUBJECT_STATUSES = [
  "active",
  "restricted",
  "erasure_pending",
  "anonymized",
] as const;

export const PRIVACY_IDENTIFIER_KINDS = [
  "phone",
  "email",
  "external_id",
  "customer_id",
  "mixed",
] as const;

export const PRIVACY_CONSENT_STATUSES = [
  "granted",
  "denied",
  "withdrawn",
  "expired",
] as const;

export const PRIVACY_LAWFUL_BASES = [
  "consent",
  "contract",
  "legal_obligation",
  "vital_interests",
  "public_task",
  "legitimate_interests",
] as const;

export const PRIVACY_REQUEST_TYPES = [
  "access",
  "export",
  "rectification",
  "erasure",
  "restriction",
  "objection",
  "consent_withdrawal",
] as const;

export const PRIVACY_REQUEST_STATUSES = [
  "received",
  "identity_pending",
  "verified",
  "approved",
  "processing",
  "partially_fulfilled",
  "fulfilled",
  "rejected",
  "cancelled",
  "failed",
] as const;

export const PRIVACY_REQUEST_CHANNELS = [
  "whatsapp",
  "voice",
  "web",
  "panel",
  "api",
  "email",
  "offline",
] as const;

export const PRIVACY_IDENTITY_STATUSES = [
  "pending",
  "challenged",
  "verified",
  "failed",
  "expired",
  "waived",
] as const;

export const PRIVACY_REQUEST_PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;

export const PRIVACY_ITEM_ACTIONS = [
  "discover",
  "export",
  "rectify",
  "restrict",
  "anonymize",
  "delete",
  "suppress",
  "retain",
] as const;

export const PRIVACY_ITEM_STATUSES = [
  "pending",
  "running",
  "blocked",
  "succeeded",
  "failed",
  "skipped",
] as const;

export const PRIVACY_EVENT_ACTOR_TYPES = [
  "customer",
  "operator",
  "system",
  "integration",
  "regulator",
] as const;

export const PRIVACY_LEGAL_HOLD_STATUSES = [
  "active",
  "released",
  "expired",
] as const;

export const PRIVACY_EXPORT_FORMATS = [
  "json",
  "csv",
  "zip",
  "pdf",
] as const;

export const PRIVACY_EXPORT_PROVIDERS = [
  "supabase_storage",
  "s3",
  "local_encrypted",
  "external_vault",
] as const;

export const PRIVACY_SUPPRESSION_STATUSES = [
  "active",
  "revoked",
  "expired",
] as const;

export const PRIVACY_STORE_CODES = [
  "supabase_crm",
  "supabase_conversations",
  "supabase_commerce",
  "supabase_voice",
  "voice_sqlite",
  "voice_recordings",
  "local_audit_logs",
  "vector_memory",
  "external_crm",
  "external_catalog",
] as const;

export type PrivacyPolicyStatus =
  (typeof PRIVACY_POLICY_STATUSES)[number];

export type PrivacySubjectStatus =
  (typeof PRIVACY_SUBJECT_STATUSES)[number];

export type PrivacyIdentifierKind =
  (typeof PRIVACY_IDENTIFIER_KINDS)[number];

export type PrivacyConsentStatus =
  (typeof PRIVACY_CONSENT_STATUSES)[number];

export type PrivacyLawfulBasis =
  (typeof PRIVACY_LAWFUL_BASES)[number];

export type PrivacyRequestType =
  (typeof PRIVACY_REQUEST_TYPES)[number];

export type PrivacyRequestStatus =
  (typeof PRIVACY_REQUEST_STATUSES)[number];

export type PrivacyRequestChannel =
  (typeof PRIVACY_REQUEST_CHANNELS)[number];

export type PrivacyIdentityStatus =
  (typeof PRIVACY_IDENTITY_STATUSES)[number];

export type PrivacyRequestPriority =
  (typeof PRIVACY_REQUEST_PRIORITIES)[number];

export type PrivacyItemAction =
  (typeof PRIVACY_ITEM_ACTIONS)[number];

export type PrivacyItemStatus =
  (typeof PRIVACY_ITEM_STATUSES)[number];

export type PrivacyEventActorType =
  (typeof PRIVACY_EVENT_ACTOR_TYPES)[number];

export type PrivacyLegalHoldStatus =
  (typeof PRIVACY_LEGAL_HOLD_STATUSES)[number];

export type PrivacyExportFormat =
  (typeof PRIVACY_EXPORT_FORMATS)[number];

export type PrivacyExportProvider =
  (typeof PRIVACY_EXPORT_PROVIDERS)[number];

export type PrivacySuppressionStatus =
  (typeof PRIVACY_SUPPRESSION_STATUSES)[number];

export type PrivacyStoreCode =
  (typeof PRIVACY_STORE_CODES)[number];

export type PrivacyJson =
  | null
  | boolean
  | number
  | string
  | PrivacyJson[]
  | {
      [key: string]: PrivacyJson;
    };

export type PrivacyJsonObject =
  Record<string, PrivacyJson>;

export interface PrivacyTenantPolicyRecord {
  id: string;
  company_id: string;
  version: number;
  status: PrivacyPolicyStatus;
  controller_name: string | null;
  controller_email: string | null;
  dpo_contact: string | null;
  privacy_notice_url: string | null;
  privacy_notice_version: string | null;
  default_language: string;
  data_residency_region: string;
  conversations_retention_days: number;
  messages_retention_days: number;
  crm_profile_retention_days: number;
  call_transcripts_retention_days: number;
  voice_recordings_retention_days: number;
  media_retention_days: number;
  technical_logs_retention_days: number;
  export_expiration_hours: number;
  request_due_days: number;
  identity_verification_ttl_minutes: number;
  automatic_retention_enabled: boolean;
  automatic_erasure_enabled: boolean;
  legal_hold_blocks_erasure: boolean;
  lawful_basis_catalog: PrivacyJson[];
  policy_metadata: PrivacyJsonObject;
  activated_at: string | null;
  retired_at: string | null;
  created_by_actor_id: string | null;
  updated_by_actor_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrivacyDataSubjectRecord {
  id: string;
  company_id: string;
  subject_key: string;
  identifier_kind: PrivacyIdentifierKind;
  identifier_digest: string;
  primary_contact_id: string | null;
  status: PrivacySubjectStatus;
  restriction_reason_code: string | null;
  last_request_at: string | null;
  anonymized_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrivacyConsentRecord {
  id: string;
  company_id: string;
  subject_id: string;
  purpose_code: string;
  status: PrivacyConsentStatus;
  lawful_basis: PrivacyLawfulBasis;
  source_channel: PrivacyRequestChannel | "import";
  notice_version: string | null;
  evidence_digest: string | null;
  evidence: PrivacyJsonObject;
  captured_by_actor_id: string | null;
  captured_at: string;
  valid_from: string;
  valid_until: string | null;
  withdrawn_at: string | null;
  withdrawal_reason_code: string | null;
  supersedes_consent_id: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrivacyRequestRecord {
  id: string;
  company_id: string;
  subject_id: string;
  request_code: string;
  request_type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  source_channel: PrivacyRequestChannel;
  identity_verification_status:
    PrivacyIdentityStatus;
  verification_method: string | null;
  verification_evidence_digest:
    string | null;
  verified_at: string | null;
  verified_by_actor_id: string | null;
  priority: PrivacyRequestPriority;
  assigned_to_actor_id: string | null;
  received_at: string;
  due_at: string;
  requested_scope: PrivacyJsonObject;
  decision_code: string | null;
  decision_notes: string | null;
  approved_at: string | null;
  approved_by_actor_id: string | null;
  execution_started_at: string | null;
  executed_by_actor_id: string | null;
  legal_hold_detected: boolean;
  result_summary: PrivacyJsonObject;
  completed_at: string | null;
  idempotency_key: string | null;
  created_by_actor_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface PrivacyRequestItemRecord {
  id: string;
  company_id: string;
  request_id: string;
  store_code: string;
  action_code: PrivacyItemAction;
  status: PrivacyItemStatus;
  locator_digest: string | null;
  records_discovered: number;
  records_affected: number;
  attempt_count: number;
  blocking_reason_code: string | null;
  error_code: string | null;
  evidence_digest: string | null;
  evidence: PrivacyJsonObject;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrivacyRequestEventRecord {
  id: string;
  company_id: string;
  request_id: string;
  sequence_number: number;
  event_type: string;
  actor_type: PrivacyEventActorType;
  actor_id: string | null;
  correlation_id: string | null;
  payload: PrivacyJsonObject;
  previous_digest: string | null;
  event_digest: string;
  occurred_at: string;
  created_at: string;
}

export interface PrivacyLegalHoldRecord {
  id: string;
  company_id: string;
  subject_id: string;
  status: PrivacyLegalHoldStatus;
  reason_code: string;
  authority_reference_digest: string | null;
  scope: PrivacyJsonObject;
  starts_at: string;
  expires_at: string | null;
  released_at: string | null;
  released_by_actor_id: string | null;
  created_by_actor_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrivacyExportArtifactRecord {
  id: string;
  company_id: string;
  request_id: string;
  storage_provider: PrivacyExportProvider;
  object_key: string;
  artifact_format: PrivacyExportFormat;
  content_digest: string;
  size_bytes: number;
  encrypted: boolean;
  encryption_algorithm: string | null;
  encryption_key_reference: string | null;
  expires_at: string;
  download_count: number;
  last_downloaded_at: string | null;
  revoked_at: string | null;
  revoked_by_actor_id: string | null;
  created_at: string;
}

export interface PrivacySuppressionEntryRecord {
  id: string;
  company_id: string;
  subject_id: string | null;
  identifier_kind: PrivacyIdentifierKind;
  identifier_digest: string;
  purpose_code: string;
  status: PrivacySuppressionStatus;
  reason_code: string;
  source_request_id: string | null;
  blocks_reimport: boolean;
  starts_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by_actor_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrivacyActorContext {
  actorId: string;
  companyId: string;
  requestId: string;
}

export interface PrivacyRequestTransitionContext {
  request: PrivacyRequestRecord;
  targetStatus: PrivacyRequestStatus;
  actorId: string;
  legalHoldActive: boolean;
}

export interface PrivacyPage<T> {
  data: T[];
  limit: number;
  offset: number;
  total: number;
}
