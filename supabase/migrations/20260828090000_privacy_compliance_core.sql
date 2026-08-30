begin;

create unique index if not exists
  uq_crm_contacts_company_id_id
on public.crm_contacts (
  company_id,
  id
);

create table public.privacy_tenant_policies (
  id uuid primary key
    default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  version integer not null
    default 1,

  status text not null
    default 'draft',

  controller_name text,
  controller_email text,
  dpo_contact text,
  privacy_notice_url text,
  privacy_notice_version text,

  default_language text not null
    default 'es',

  data_residency_region text not null
    default 'eu',

  conversations_retention_days integer not null
    default 365,

  messages_retention_days integer not null
    default 365,

  crm_profile_retention_days integer not null
    default 730,

  call_transcripts_retention_days integer not null
    default 180,

  voice_recordings_retention_days integer not null
    default 30,

  media_retention_days integer not null
    default 90,

  technical_logs_retention_days integer not null
    default 90,

  export_expiration_hours integer not null
    default 72,

  request_due_days integer not null
    default 30,

  identity_verification_ttl_minutes integer not null
    default 30,

  automatic_retention_enabled boolean not null
    default false,

  automatic_erasure_enabled boolean not null
    default false,

  legal_hold_blocks_erasure boolean not null
    default true,

  lawful_basis_catalog jsonb not null
    default '[]'::jsonb,

  policy_metadata jsonb not null
    default '{}'::jsonb,

  activated_at timestamptz,
  retired_at timestamptz,

  created_by_actor_id text,
  updated_by_actor_id text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint privacy_policy_company_id_id_key
    unique (
      company_id,
      id
    ),

  constraint privacy_policy_company_version_key
    unique (
      company_id,
      version
    ),

  constraint privacy_policy_status_check
    check (
      status in (
        'draft',
        'active',
        'retired'
      )
    ),

  constraint privacy_policy_default_language_check
    check (
      default_language ~
      '^[a-z]{2}(-[A-Z]{2})?$'
    ),

  constraint privacy_policy_retention_check
    check (
      conversations_retention_days
        between 1 and 3650
      and messages_retention_days
        between 1 and 3650
      and crm_profile_retention_days
        between 1 and 3650
      and call_transcripts_retention_days
        between 0 and 3650
      and voice_recordings_retention_days
        between 0 and 3650
      and media_retention_days
        between 0 and 3650
      and technical_logs_retention_days
        between 1 and 730
    ),

  constraint privacy_policy_operational_limits_check
    check (
      export_expiration_hours
        between 1 and 168
      and request_due_days
        between 1 and 90
      and identity_verification_ttl_minutes
        between 5 and 1440
    ),

  constraint privacy_policy_lifecycle_check
    check (
      (
        status = 'active'
        and activated_at is not null
        and retired_at is null
      )
      or (
        status = 'draft'
        and retired_at is null
      )
      or (
        status = 'retired'
        and retired_at is not null
      )
    )
);

comment on table
  public.privacy_tenant_policies
is
  'Políticas versionadas de privacidad y retención por empresa.';

create table public.privacy_data_subjects (
  id uuid primary key
    default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  subject_key text not null,

  identifier_kind text not null,

  identifier_digest text not null,

  primary_contact_id uuid,

  status text not null
    default 'active',

  restriction_reason_code text,

  last_request_at timestamptz,
  anonymized_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint privacy_subject_company_id_id_key
    unique (
      company_id,
      id
    ),

  constraint privacy_subject_company_key
    unique (
      company_id,
      subject_key
    ),

  constraint privacy_subject_identifier_key
    unique (
      company_id,
      identifier_kind,
      identifier_digest
    ),

  constraint privacy_subject_contact_fk
    foreign key (
      company_id,
      primary_contact_id
    )
    references public.crm_contacts (
      company_id,
      id
    )
    on delete restrict,

  constraint privacy_subject_key_check
    check (
      char_length(subject_key)
      between 16 and 200
    ),

  constraint privacy_subject_identifier_kind_check
    check (
      identifier_kind in (
        'phone',
        'email',
        'external_id',
        'customer_id',
        'mixed'
      )
    ),

  constraint privacy_subject_digest_check
    check (
      identifier_digest ~
      '^[0-9a-f]{64}$'
    ),

  constraint privacy_subject_status_check
    check (
      status in (
        'active',
        'restricted',
        'erasure_pending',
        'anonymized'
      )
    ),

  constraint privacy_subject_anonymized_check
    check (
      (
        status = 'anonymized'
        and anonymized_at is not null
      )
      or status <> 'anonymized'
    )
);

comment on column
  public.privacy_data_subjects.identifier_digest
is
  'HMAC-SHA256 del identificador normalizado; nunca guardar aquí teléfono o email en texto plano.';

create table public.privacy_consents (
  id uuid primary key
    default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  subject_id uuid not null,

  purpose_code text not null,

  status text not null,

  lawful_basis text not null,

  source_channel text not null,

  notice_version text,

  evidence_digest text,
  evidence jsonb not null
    default '{}'::jsonb,

  captured_by_actor_id text,
  captured_at timestamptz not null
    default now(),

  valid_from timestamptz not null
    default now(),

  valid_until timestamptz,

  withdrawn_at timestamptz,
  withdrawal_reason_code text,

  supersedes_consent_id uuid,
  idempotency_key text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint privacy_consent_company_id_id_key
    unique (
      company_id,
      id
    ),

  constraint privacy_consent_subject_fk
    foreign key (
      company_id,
      subject_id
    )
    references public.privacy_data_subjects (
      company_id,
      id
    )
    on delete restrict,

  constraint privacy_consent_supersedes_fk
    foreign key (
      company_id,
      supersedes_consent_id
    )
    references public.privacy_consents (
      company_id,
      id
    )
    on delete restrict,

  constraint privacy_consent_purpose_check
    check (
      char_length(purpose_code)
      between 2 and 80
    ),

  constraint privacy_consent_status_check
    check (
      status in (
        'granted',
        'denied',
        'withdrawn',
        'expired'
      )
    ),

  constraint privacy_consent_lawful_basis_check
    check (
      lawful_basis in (
        'consent',
        'contract',
        'legal_obligation',
        'vital_interests',
        'public_task',
        'legitimate_interests'
      )
    ),

  constraint privacy_consent_channel_check
    check (
      source_channel in (
        'whatsapp',
        'voice',
        'web',
        'panel',
        'api',
        'import',
        'offline'
      )
    ),

  constraint privacy_consent_evidence_digest_check
    check (
      evidence_digest is null
      or evidence_digest ~
        '^[0-9a-f]{64}$'
    ),

  constraint privacy_consent_validity_check
    check (
      valid_until is null
      or valid_until > valid_from
    ),

  constraint privacy_consent_withdrawal_check
    check (
      (
        status = 'withdrawn'
        and withdrawn_at is not null
      )
      or status <> 'withdrawn'
    )
);

comment on table
  public.privacy_consents
is
  'Historial probatorio de consentimientos, denegaciones y retiradas por finalidad.';

create table public.privacy_requests (
  id uuid primary key
    default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  subject_id uuid not null,

  request_code text not null,
  request_type text not null,

  status text not null
    default 'received',

  source_channel text not null,

  identity_verification_status text not null
    default 'pending',

  verification_method text,
  verification_evidence_digest text,

  verified_at timestamptz,
  verified_by_actor_id text,

  priority text not null
    default 'normal',

  assigned_to_actor_id text,

  received_at timestamptz not null
    default now(),

  due_at timestamptz not null,

  requested_scope jsonb not null
    default '{}'::jsonb,

  decision_code text,
  decision_notes text,

  approved_at timestamptz,
  approved_by_actor_id text,

  execution_started_at timestamptz,
  executed_by_actor_id text,

  legal_hold_detected boolean not null
    default false,

  result_summary jsonb not null
    default '{}'::jsonb,

  completed_at timestamptz,

  idempotency_key text,

  created_by_actor_id text,

  version integer not null
    default 1,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint privacy_request_company_id_id_key
    unique (
      company_id,
      id
    ),

  constraint privacy_request_company_code_key
    unique (
      company_id,
      request_code
    ),

  constraint privacy_request_subject_fk
    foreign key (
      company_id,
      subject_id
    )
    references public.privacy_data_subjects (
      company_id,
      id
    )
    on delete restrict,

  constraint privacy_request_code_check
    check (
      request_code ~
      '^[A-Z0-9][A-Z0-9_-]{7,79}$'
    ),

  constraint privacy_request_type_check
    check (
      request_type in (
        'access',
        'export',
        'rectification',
        'erasure',
        'restriction',
        'objection',
        'consent_withdrawal'
      )
    ),

  constraint privacy_request_status_check
    check (
      status in (
        'received',
        'identity_pending',
        'verified',
        'approved',
        'processing',
        'partially_fulfilled',
        'fulfilled',
        'rejected',
        'cancelled',
        'failed'
      )
    ),

  constraint privacy_request_channel_check
    check (
      source_channel in (
        'whatsapp',
        'voice',
        'web',
        'panel',
        'api',
        'email',
        'offline'
      )
    ),

  constraint privacy_request_verification_check
    check (
      identity_verification_status in (
        'pending',
        'challenged',
        'verified',
        'failed',
        'expired',
        'waived'
      )
    ),

  constraint privacy_request_priority_check
    check (
      priority in (
        'low',
        'normal',
        'high',
        'urgent'
      )
    ),

  constraint privacy_request_evidence_digest_check
    check (
      verification_evidence_digest is null
      or verification_evidence_digest ~
        '^[0-9a-f]{64}$'
    ),

  constraint privacy_request_due_at_check
    check (
      due_at > received_at
    ),

  constraint privacy_request_version_check
    check (
      version > 0
    ),

  constraint privacy_request_verifier_separation_check
    check (
      approved_by_actor_id is null
      or verified_by_actor_id is null
      or approved_by_actor_id
        <> verified_by_actor_id
    ),

  constraint privacy_request_erasure_approval_check
    check (
      request_type <> 'erasure'
      or status in (
        'received',
        'identity_pending',
        'verified',
        'rejected',
        'cancelled',
        'failed'
      )
      or (
        approved_at is not null
        and approved_by_actor_id is not null
      )
    ),

  constraint privacy_request_completion_check
    check (
      (
        status in (
          'fulfilled',
          'partially_fulfilled',
          'rejected',
          'cancelled',
          'failed'
        )
        and completed_at is not null
      )
      or (
        status not in (
          'fulfilled',
          'partially_fulfilled',
          'rejected',
          'cancelled',
          'failed'
        )
        and completed_at is null
      )
    )
);

comment on table
  public.privacy_requests
is
  'Solicitudes ARCO/DSAR con verificación, aprobación y separación de funciones.';

create table public.privacy_request_items (
  id uuid primary key
    default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  request_id uuid not null,

  store_code text not null,
  action_code text not null,

  status text not null
    default 'pending',

  locator_digest text,

  records_discovered bigint not null
    default 0,

  records_affected bigint not null
    default 0,

  attempt_count integer not null
    default 0,

  blocking_reason_code text,
  error_code text,

  evidence_digest text,
  evidence jsonb not null
    default '{}'::jsonb,

  started_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint privacy_request_item_company_id_id_key
    unique (
      company_id,
      id
    ),

  constraint privacy_request_item_operation_key
    unique (
      company_id,
      request_id,
      store_code,
      action_code
    ),

  constraint privacy_request_item_request_fk
    foreign key (
      company_id,
      request_id
    )
    references public.privacy_requests (
      company_id,
      id
    )
    on delete cascade,

  constraint privacy_request_item_store_check
    check (
      store_code ~
      '^[a-z][a-z0-9_]{1,79}$'
    ),

  constraint privacy_request_item_action_check
    check (
      action_code in (
        'discover',
        'export',
        'rectify',
        'restrict',
        'anonymize',
        'delete',
        'suppress',
        'retain'
      )
    ),

  constraint privacy_request_item_status_check
    check (
      status in (
        'pending',
        'running',
        'blocked',
        'succeeded',
        'failed',
        'skipped'
      )
    ),

  constraint privacy_request_item_counts_check
    check (
      records_discovered >= 0
      and records_affected >= 0
      and attempt_count >= 0
    ),

  constraint privacy_request_item_locator_check
    check (
      locator_digest is null
      or locator_digest ~
        '^[0-9a-f]{64}$'
    ),

  constraint privacy_request_item_evidence_check
    check (
      evidence_digest is null
      or evidence_digest ~
        '^[0-9a-f]{64}$'
    ),

  constraint privacy_request_item_time_check
    check (
      completed_at is null
      or started_at is null
      or completed_at >= started_at
    )
);

comment on table
  public.privacy_request_items
is
  'Plan y resultado de cada acción ejecutada en cada almacén de datos.';

create table public.privacy_request_events (
  id uuid primary key
    default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  request_id uuid not null,

  sequence_number bigint not null,

  event_type text not null,

  actor_type text not null,
  actor_id text,

  correlation_id text,

  payload jsonb not null
    default '{}'::jsonb,

  previous_digest text,
  event_digest text not null,

  occurred_at timestamptz not null
    default now(),

  created_at timestamptz not null
    default now(),

  constraint privacy_request_event_company_id_id_key
    unique (
      company_id,
      id
    ),

  constraint privacy_request_event_sequence_key
    unique (
      company_id,
      request_id,
      sequence_number
    ),

  constraint privacy_request_event_request_fk
    foreign key (
      company_id,
      request_id
    )
    references public.privacy_requests (
      company_id,
      id
    )
    on delete cascade,

  constraint privacy_request_event_sequence_check
    check (
      sequence_number > 0
    ),

  constraint privacy_request_event_type_check
    check (
      event_type ~
      '^[a-z][a-z0-9_.-]{2,99}$'
    ),

  constraint privacy_request_event_actor_check
    check (
      actor_type in (
        'customer',
        'operator',
        'system',
        'integration',
        'regulator'
      )
    ),

  constraint privacy_request_event_previous_digest_check
    check (
      previous_digest is null
      or previous_digest ~
        '^[0-9a-f]{64}$'
    ),

  constraint privacy_request_event_digest_check
    check (
      event_digest ~
      '^[0-9a-f]{64}$'
    )
);

comment on table
  public.privacy_request_events
is
  'Bitácora append-only con encadenamiento criptográfico por solicitud.';

create table public.privacy_legal_holds (
  id uuid primary key
    default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  subject_id uuid not null,

  status text not null
    default 'active',

  reason_code text not null,

  authority_reference_digest text,

  scope jsonb not null
    default '{}'::jsonb,

  starts_at timestamptz not null
    default now(),

  expires_at timestamptz,

  released_at timestamptz,
  released_by_actor_id text,

  created_by_actor_id text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint privacy_legal_hold_company_id_id_key
    unique (
      company_id,
      id
    ),

  constraint privacy_legal_hold_subject_fk
    foreign key (
      company_id,
      subject_id
    )
    references public.privacy_data_subjects (
      company_id,
      id
    )
    on delete restrict,

  constraint privacy_legal_hold_status_check
    check (
      status in (
        'active',
        'released',
        'expired'
      )
    ),

  constraint privacy_legal_hold_reason_check
    check (
      reason_code ~
      '^[a-z][a-z0-9_.-]{2,99}$'
    ),

  constraint privacy_legal_hold_authority_check
    check (
      authority_reference_digest is null
      or authority_reference_digest ~
        '^[0-9a-f]{64}$'
    ),

  constraint privacy_legal_hold_dates_check
    check (
      expires_at is null
      or expires_at > starts_at
    ),

  constraint privacy_legal_hold_release_check
    check (
      (
        status = 'released'
        and released_at is not null
        and released_by_actor_id is not null
      )
      or status <> 'released'
    )
);

comment on table
  public.privacy_legal_holds
is
  'Bloqueos legales que impiden borrar información sujeta a conservación obligatoria.';

create table public.privacy_export_artifacts (
  id uuid primary key
    default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  request_id uuid not null,

  storage_provider text not null,
  object_key text not null,

  artifact_format text not null,

  content_digest text not null,
  size_bytes bigint not null,

  encrypted boolean not null
    default true,

  encryption_algorithm text,
  encryption_key_reference text,

  expires_at timestamptz not null,

  download_count integer not null
    default 0,

  last_downloaded_at timestamptz,

  revoked_at timestamptz,
  revoked_by_actor_id text,

  created_at timestamptz not null
    default now(),

  constraint privacy_export_company_id_id_key
    unique (
      company_id,
      id
    ),

  constraint privacy_export_object_key
    unique (
      company_id,
      request_id,
      object_key
    ),

  constraint privacy_export_request_fk
    foreign key (
      company_id,
      request_id
    )
    references public.privacy_requests (
      company_id,
      id
    )
    on delete cascade,

  constraint privacy_export_provider_check
    check (
      storage_provider in (
        'supabase_storage',
        's3',
        'local_encrypted',
        'external_vault'
      )
    ),

  constraint privacy_export_format_check
    check (
      artifact_format in (
        'json',
        'csv',
        'zip',
        'pdf'
      )
    ),

  constraint privacy_export_digest_check
    check (
      content_digest ~
      '^[0-9a-f]{64}$'
    ),

  constraint privacy_export_size_check
    check (
      size_bytes >= 0
      and download_count >= 0
    ),

  constraint privacy_export_encryption_check
    check (
      (
        encrypted = true
        and encryption_algorithm is not null
        and encryption_key_reference is not null
      )
      or encrypted = false
    ),

  constraint privacy_export_expiry_check
    check (
      expires_at > created_at
    )
);

comment on table
  public.privacy_export_artifacts
is
  'Metadatos de exportaciones temporales; nunca almacena URLs firmadas ni claves criptográficas.';

create table public.privacy_suppression_entries (
  id uuid primary key
    default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  subject_id uuid,

  identifier_kind text not null,
  identifier_digest text not null,

  purpose_code text not null,

  status text not null
    default 'active',

  reason_code text not null,

  source_request_id uuid,

  blocks_reimport boolean not null
    default false,

  starts_at timestamptz not null
    default now(),

  expires_at timestamptz,

  revoked_at timestamptz,
  revoked_by_actor_id text,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint privacy_suppression_company_id_id_key
    unique (
      company_id,
      id
    ),

  constraint privacy_suppression_subject_fk
    foreign key (
      company_id,
      subject_id
    )
    references public.privacy_data_subjects (
      company_id,
      id
    )
    on delete restrict,

  constraint privacy_suppression_request_fk
    foreign key (
      company_id,
      source_request_id
    )
    references public.privacy_requests (
      company_id,
      id
    )
    on delete restrict,

  constraint privacy_suppression_identifier_check
    check (
      identifier_kind in (
        'phone',
        'email',
        'external_id',
        'customer_id',
        'mixed'
      )
      and identifier_digest ~
        '^[0-9a-f]{64}$'
    ),

  constraint privacy_suppression_purpose_check
    check (
      char_length(purpose_code)
      between 2 and 80
    ),

  constraint privacy_suppression_status_check
    check (
      status in (
        'active',
        'revoked',
        'expired'
      )
    ),

  constraint privacy_suppression_reason_check
    check (
      reason_code ~
      '^[a-z][a-z0-9_.-]{2,99}$'
    ),

  constraint privacy_suppression_dates_check
    check (
      expires_at is null
      or expires_at > starts_at
    ),

  constraint privacy_suppression_revocation_check
    check (
      (
        status = 'revoked'
        and revoked_at is not null
        and revoked_by_actor_id is not null
      )
      or status <> 'revoked'
    )
);

comment on table
  public.privacy_suppression_entries
is
  'Lista seudonimizada de no contacto y bloqueo de reimportación después de una supresión.';

create extension if not exists
  pgcrypto
with schema extensions;

create unique index
  uq_privacy_policy_active_company
on public.privacy_tenant_policies (
  company_id
)
where status = 'active';

create index
  ix_privacy_policy_company_status
on public.privacy_tenant_policies (
  company_id,
  status,
  version desc
);

create index
  ix_privacy_subject_company_status
on public.privacy_data_subjects (
  company_id,
  status,
  updated_at desc
);

create index
  ix_privacy_subject_contact
on public.privacy_data_subjects (
  company_id,
  primary_contact_id
)
where primary_contact_id is not null;

create index
  ix_privacy_consent_subject_purpose
on public.privacy_consents (
  company_id,
  subject_id,
  purpose_code,
  captured_at desc
);

create unique index
  uq_privacy_consent_idempotency
on public.privacy_consents (
  company_id,
  idempotency_key
)
where idempotency_key is not null;

create index
  ix_privacy_request_company_status_due
on public.privacy_requests (
  company_id,
  status,
  due_at
);

create index
  ix_privacy_request_subject_created
on public.privacy_requests (
  company_id,
  subject_id,
  created_at desc
);

create unique index
  uq_privacy_request_idempotency
on public.privacy_requests (
  company_id,
  idempotency_key
)
where idempotency_key is not null;

create index
  ix_privacy_request_item_execution
on public.privacy_request_items (
  company_id,
  request_id,
  status,
  created_at
);

create index
  ix_privacy_request_event_timeline
on public.privacy_request_events (
  company_id,
  request_id,
  sequence_number
);

create index
  ix_privacy_legal_hold_subject
on public.privacy_legal_holds (
  company_id,
  subject_id,
  status
);

create unique index
  uq_privacy_legal_hold_active_reason
on public.privacy_legal_holds (
  company_id,
  subject_id,
  reason_code
)
where status = 'active';

create index
  ix_privacy_export_expiration
on public.privacy_export_artifacts (
  company_id,
  expires_at
)
where revoked_at is null;

create unique index
  uq_privacy_suppression_active
on public.privacy_suppression_entries (
  company_id,
  identifier_kind,
  identifier_digest,
  purpose_code
)
where status = 'active';

create index
  ix_privacy_suppression_reimport
on public.privacy_suppression_entries (
  company_id,
  identifier_digest
)
where (
  status = 'active'
  and blocks_reimport = true
);

create index
  ix_privacy_suppression_expiration
on public.privacy_suppression_entries (
  company_id,
  expires_at
)
where (
  status = 'active'
  and expires_at is not null
);

drop trigger if exists
  trg_privacy_tenant_policies_updated_at
on public.privacy_tenant_policies;

create trigger
  trg_privacy_tenant_policies_updated_at
before update
on public.privacy_tenant_policies
for each row
execute function
  public.commerce_touch_updated_at();

drop trigger if exists
  trg_privacy_data_subjects_updated_at
on public.privacy_data_subjects;

create trigger
  trg_privacy_data_subjects_updated_at
before update
on public.privacy_data_subjects
for each row
execute function
  public.commerce_touch_updated_at();

drop trigger if exists
  trg_privacy_consents_updated_at
on public.privacy_consents;

create trigger
  trg_privacy_consents_updated_at
before update
on public.privacy_consents
for each row
execute function
  public.commerce_touch_updated_at();

drop trigger if exists
  trg_privacy_requests_updated_at
on public.privacy_requests;

create trigger
  trg_privacy_requests_updated_at
before update
on public.privacy_requests
for each row
execute function
  public.commerce_touch_updated_at();

drop trigger if exists
  trg_privacy_request_items_updated_at
on public.privacy_request_items;

create trigger
  trg_privacy_request_items_updated_at
before update
on public.privacy_request_items
for each row
execute function
  public.commerce_touch_updated_at();

drop trigger if exists
  trg_privacy_legal_holds_updated_at
on public.privacy_legal_holds;

create trigger
  trg_privacy_legal_holds_updated_at
before update
on public.privacy_legal_holds
for each row
execute function
  public.commerce_touch_updated_at();

drop trigger if exists
  trg_privacy_suppression_updated_at
on public.privacy_suppression_entries;

create trigger
  trg_privacy_suppression_updated_at
before update
on public.privacy_suppression_entries
for each row
execute function
  public.commerce_touch_updated_at();

create or replace function
  public.privacy_prepare_request_event()
returns trigger
language plpgsql
security definer
set search_path =
  public,
  extensions,
  pg_temp
as $function$
declare
  previous_sequence bigint;
  previous_event_digest text;
  expected_sequence bigint;
  canonical_occurred_at text;
  canonical_event text;
begin
  perform 1
  from public.privacy_requests
  where (
    company_id = new.company_id
    and id = new.request_id
  )
  for update;

  if not found then
    raise exception
      using
        errcode = '23503',
        message =
          'privacy_request_not_found';
  end if;

  select
    sequence_number,
    event_digest
  into
    previous_sequence,
    previous_event_digest
  from public.privacy_request_events
  where (
    company_id = new.company_id
    and request_id = new.request_id
  )
  order by sequence_number desc
  limit 1;

  expected_sequence :=
    coalesce(
      previous_sequence + 1,
      1
    );

  if new.sequence_number is null then
    new.sequence_number :=
      expected_sequence;
  end if;

  if (
    new.sequence_number
    <> expected_sequence
  ) then
    raise exception
      using
        errcode = '23514',
        message =
          'privacy_event_sequence_invalid';
  end if;

  new.previous_digest :=
    previous_event_digest;

  new.occurred_at :=
    coalesce(
      new.occurred_at,
      now()
    );

  canonical_occurred_at :=
    to_char(
      new.occurred_at
        at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
    );

  canonical_event :=
    concat_ws(
      '|',
      new.company_id,
      new.request_id::text,
      new.sequence_number::text,
      new.event_type,
      new.actor_type,
      coalesce(
        new.actor_id,
        ''
      ),
      coalesce(
        new.correlation_id,
        ''
      ),
      coalesce(
        new.previous_digest,
        ''
      ),
      coalesce(
        new.payload,
        '{}'::jsonb
      )::text,
      canonical_occurred_at
    );

  new.event_digest :=
    encode(
      extensions.digest(
        canonical_event,
        'sha256'
      ),
      'hex'
    );

  return new;
end;
$function$;

revoke all
on function
  public.privacy_prepare_request_event()
from public;

revoke all
on function
  public.privacy_prepare_request_event()
from anon, authenticated;

grant execute
on function
  public.privacy_prepare_request_event()
to service_role;

drop trigger if exists
  trg_privacy_request_event_prepare
on public.privacy_request_events;

create trigger
  trg_privacy_request_event_prepare
before insert
on public.privacy_request_events
for each row
execute function
  public.privacy_prepare_request_event();

alter table
  public.privacy_tenant_policies
enable row level security;

alter table
  public.privacy_tenant_policies
force row level security;

alter table
  public.privacy_data_subjects
enable row level security;

alter table
  public.privacy_data_subjects
force row level security;

alter table
  public.privacy_consents
enable row level security;

alter table
  public.privacy_consents
force row level security;

alter table
  public.privacy_requests
enable row level security;

alter table
  public.privacy_requests
force row level security;

alter table
  public.privacy_request_items
enable row level security;

alter table
  public.privacy_request_items
force row level security;

alter table
  public.privacy_request_events
enable row level security;

alter table
  public.privacy_request_events
force row level security;

alter table
  public.privacy_legal_holds
enable row level security;

alter table
  public.privacy_legal_holds
force row level security;

alter table
  public.privacy_export_artifacts
enable row level security;

alter table
  public.privacy_export_artifacts
force row level security;

alter table
  public.privacy_suppression_entries
enable row level security;

alter table
  public.privacy_suppression_entries
force row level security;

revoke all
on table
  public.privacy_tenant_policies,
  public.privacy_data_subjects,
  public.privacy_consents,
  public.privacy_requests,
  public.privacy_request_items,
  public.privacy_request_events,
  public.privacy_legal_holds,
  public.privacy_export_artifacts,
  public.privacy_suppression_entries
from anon, authenticated;

revoke all
on table
  public.privacy_tenant_policies,
  public.privacy_data_subjects,
  public.privacy_consents,
  public.privacy_requests,
  public.privacy_request_items,
  public.privacy_request_events,
  public.privacy_legal_holds,
  public.privacy_export_artifacts,
  public.privacy_suppression_entries
from service_role;

grant
  select,
  insert,
  update
on table
  public.privacy_tenant_policies,
  public.privacy_data_subjects,
  public.privacy_consents,
  public.privacy_requests,
  public.privacy_request_items,
  public.privacy_legal_holds,
  public.privacy_export_artifacts,
  public.privacy_suppression_entries
to service_role;

grant
  select,
  insert
on table
  public.privacy_request_events
to service_role;

comment on table
  public.privacy_request_events
is
  'Registro append-only: service_role puede insertar y consultar, pero no modificar ni eliminar eventos.';


create or replace function
  public.privacy_transition_request_atomic(
    p_company_id text,
    p_request_id uuid,
    p_expected_version integer,
    p_target_status text,
    p_actor_type text,
    p_actor_id text,
    p_correlation_id text,
    p_reason text default null,
    p_patch jsonb default '{}'::jsonb,
    p_payload jsonb default '{}'::jsonb
  )
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  extensions,
  pg_temp
as $function$
declare
  v_request
    public.privacy_requests%rowtype;

  v_updated
    public.privacy_requests%rowtype;

  v_event
    public.privacy_request_events%rowtype;

  v_allowed
    jsonb :=
      '{"received":["identity_pending","cancelled"],"identity_pending":["verified","rejected","cancelled","failed"],"verified":["approved","processing","rejected","cancelled"],"approved":["processing","cancelled"],"processing":["partially_fulfilled","fulfilled","failed"],"partially_fulfilled":["processing","fulfilled","failed"],"fulfilled":[],"rejected":[],"cancelled":[],"failed":[]}'::jsonb;
begin
  if (
    p_company_id is null
    or btrim(p_company_id) = ''
  ) then
    raise exception
      using
        errcode = 'P0001',
        message =
          'PRIVACY_COMPANY_REQUIRED';
  end if;

  if (
    p_actor_id is null
    or btrim(p_actor_id) = ''
  ) then
    raise exception
      using
        errcode = 'P0001',
        message =
          'PRIVACY_ACTOR_REQUIRED';
  end if;

  if (
    p_patch ?| array[
      'id',
      'company_id',
      'subject_id',
      'request_code',
      'request_type',
      'created_at',
      'created_by_actor_id',
      'version',
      'status'
    ]
  ) then
    raise exception
      using
        errcode = 'P0001',
        message =
          'PRIVACY_PROTECTED_FIELD_PATCH';
  end if;

  select *
  into v_request
  from public.privacy_requests
  where company_id = p_company_id
    and id = p_request_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message =
          'PRIVACY_REQUEST_NOT_FOUND';
  end if;

  if (
    v_request.version
    <> p_expected_version
  ) then
    raise exception
      using
        errcode = '40001',
        message =
          'PRIVACY_VERSION_CONFLICT';
  end if;

  if not coalesce(
    (
      v_allowed
      -> v_request.status
    ) ? p_target_status,
    false
  ) then
    raise exception
      using
        errcode = 'P0001',
        message =
          'PRIVACY_TRANSITION_NOT_ALLOWED';
  end if;

  if (
    p_target_status = 'approved'
    and v_request
      .verified_by_actor_id
      is not null
    and v_request
      .verified_by_actor_id
      = p_actor_id
  ) then
    raise exception
      using
        errcode = '42501',
        message =
          'PRIVACY_DUAL_CONTROL_REQUIRED';
  end if;

  if (
    v_request.request_type
      = 'erasure'
    and p_target_status in (
      'processing',
      'partially_fulfilled',
      'fulfilled'
    )
    and exists (
      select 1
      from public.privacy_legal_holds
      where company_id =
        p_company_id
        and subject_id =
          v_request.subject_id
        and status = 'active'
        and starts_at <= now()
        and (
          expires_at is null
          or expires_at > now()
        )
    )
  ) then
    raise exception
      using
        errcode = '55000',
        message =
          'PRIVACY_ACTIVE_LEGAL_HOLD';
  end if;
  if (
    v_request.request_type
      = 'erasure'
    and p_target_status in (
      'processing',
      'partially_fulfilled',
      'fulfilled'
    )
  ) then
    if v_request.approved_by_actor_id
      is null
    then
      raise exception
        using
          errcode = '42501',
          message =
            'PRIVACY_ERASURE_APPROVAL_REQUIRED';
    end if;

    if v_request.approved_by_actor_id
      = p_actor_id
    then
      raise exception
        using
          errcode = '42501',
          message =
            'PRIVACY_ERASURE_APPROVER_CANNOT_EXECUTE';
    end if;
  end if;


  update public.privacy_requests
  set
    status =
      p_target_status,

    version =
      version + 1,

    decision_notes =
      case
        when p_reason is not null
          then left(p_reason, 4000)
        else decision_notes
      end,

    identity_verification_status =
      case
        when p_patch
          ? 'identity_verification_status'
          then p_patch
            ->> 'identity_verification_status'
        else identity_verification_status
      end,

    verification_method =
      case
        when p_patch
          ? 'verification_method'
          then nullif(
            p_patch
              ->> 'verification_method',
            ''
          )
        else verification_method
      end,

    verification_evidence_digest =
      case
        when p_patch
          ? 'verification_evidence_digest'
          then nullif(
            p_patch
              ->> 'verification_evidence_digest',
            ''
          )
        else verification_evidence_digest
      end,

    verified_at =
      case
        when p_patch
          ? 'verified_at'
          then nullif(
            p_patch
              ->> 'verified_at',
            ''
          )::timestamptz
        else verified_at
      end,

    verified_by_actor_id =
      case
        when p_patch
          ? 'verified_by_actor_id'
          then nullif(
            p_patch
              ->> 'verified_by_actor_id',
            ''
          )
        else verified_by_actor_id
      end,

    approved_at =
      case
        when p_target_status =
          'approved'
          then now()
        else approved_at
      end,

    approved_by_actor_id =
      case
        when p_target_status =
          'approved'
          then p_actor_id
        else approved_by_actor_id
      end,

    execution_started_at =
      case
        when p_target_status =
          'processing'
          then coalesce(
            execution_started_at,
            now()
          )
        else execution_started_at
      end,

    executed_by_actor_id =
      case
        when p_target_status =
          'processing'
          then p_actor_id
        else executed_by_actor_id
      end,

    completed_at =
      case
        when p_target_status in (
          'fulfilled',
          'partially_fulfilled'
        )
          then now()
        when p_target_status =
          'processing'
          then null
        else completed_at
      end,

    result_summary =
      case
        when p_patch
          ? 'result_summary'
          then p_patch
            -> 'result_summary'
        else result_summary
      end,

    updated_at =
      now()
  where company_id =
      p_company_id
    and id =
      p_request_id
    and version =
      p_expected_version
  returning *
  into v_updated;

  if not found then
    raise exception
      using
        errcode = '40001',
        message =
          'PRIVACY_CONCURRENT_MODIFICATION';
  end if;

  insert into
    public.privacy_request_events (
      company_id,
      request_id,
      event_type,
      actor_type,
      actor_id,
      correlation_id,
      payload
    )
  values (
    p_company_id,
    p_request_id,
    'privacy.request.transitioned',
    p_actor_type,
    p_actor_id,
    p_correlation_id,
    jsonb_build_object(
      'from_status',
        v_request.status,
      'to_status',
        p_target_status,
      'previous_version',
        v_request.version,
      'resulting_version',
        v_updated.version,
      'reason_code',
        case
          when p_reason is null
            then null
          else
            encode(
              extensions.digest(
                p_reason,
                'sha256'
              ),
              'hex'
            )
        end
    )
    || coalesce(
      p_payload,
      '{}'::jsonb
    )
  )
  returning *
  into v_event;

  return jsonb_build_object(
    'request',
      to_jsonb(v_updated),
    'event',
      to_jsonb(v_event)
  );
end;
$function$;

revoke all
on function
  public.privacy_transition_request_atomic(
    text,
    uuid,
    integer,
    text,
    text,
    text,
    text,
    text,
    jsonb,
    jsonb
  )
from public, anon, authenticated;

grant execute
on function
  public.privacy_transition_request_atomic(
    text,
    uuid,
    integer,
    text,
    text,
    text,
    text,
    text,
    jsonb,
    jsonb
  )
to service_role;

create or replace function
  public.privacy_activate_policy_atomic(
    p_company_id text,
    p_policy_id uuid,
    p_actor_id text
  )
returns jsonb
language plpgsql
security definer
set search_path =
  public,
  pg_temp
as $function$
declare
  v_policy
    public.privacy_tenant_policies%rowtype;
begin
  perform 1
  from public.privacy_tenant_policies
  where company_id =
    p_company_id
  for update;

  select *
  into v_policy
  from public.privacy_tenant_policies
  where company_id =
      p_company_id
    and id =
      p_policy_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message =
          'PRIVACY_POLICY_NOT_FOUND';
  end if;

  if v_policy.status <> 'draft' then
    raise exception
      using
        errcode = 'P0001',
        message =
          'PRIVACY_POLICY_NOT_DRAFT';
  end if;

  update public.privacy_tenant_policies
  set
    status =
      'retired',
    retired_at =
      now(),
    updated_by_actor_id =
      p_actor_id,
    updated_at =
      now()
  where company_id =
      p_company_id
    and status =
      'active'
    and id <>
      p_policy_id;

  update public.privacy_tenant_policies
  set
    status =
      'active',
    activated_at =
      now(),
    retired_at =
      null,
    updated_by_actor_id =
      p_actor_id,
    updated_at =
      now()
  where company_id =
      p_company_id
    and id =
      p_policy_id
  returning *
  into v_policy;

  return jsonb_build_object(
    'policy',
    to_jsonb(v_policy)
  );
end;
$function$;

revoke all
on function
  public.privacy_activate_policy_atomic(
    text,
    uuid,
    text
  )
from public, anon, authenticated;

grant execute
on function
  public.privacy_activate_policy_atomic(
    text,
    uuid,
    text
  )
to service_role;

comment on function
  public.privacy_transition_request_atomic(
    text,
    uuid,
    integer,
    text,
    text,
    text,
    text,
    text,
    jsonb,
    jsonb
  )
is
  'Actualiza una solicitud y agrega su evento en una única transacción.';

comment on function
  public.privacy_activate_policy_atomic(
    text,
    uuid,
    text
  )
is
  'Activa una política y retira la anterior bajo bloqueo transaccional.';

commit;
