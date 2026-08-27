begin;

create extension if not exists pgcrypto;

alter table public.conversations
  drop constraint if exists conversations_channel_check;

alter table public.conversations
  add constraint conversations_channel_check
  check (
    channel in (
      'whatsapp',
      'voice',
      'web',
      'instagram',
      'facebook',
      'manual'
    )
  );

create table public.voice_profiles (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  enabled boolean not null default false,
  inbound_enabled boolean not null default false,
  outbound_enabled boolean not null default false,

  display_name text not null default 'Asistente telefónico',
  language text not null default 'es',
  timezone text not null default 'Europe/Madrid',

  greeting text not null default
    'Hola, gracias por comunicarte. ¿En qué puedo ayudarte?',

  telephony_driver text not null default 'asterisk',
  stt_engine text not null default 'faster-whisper',
  tts_engine text not null default 'chatterbox',
  vad_engine text not null default 'silero',

  voice_model_id text,
  voice_sample_url text,
  voice_clone_consent_at timestamptz,
  voice_clone_consent_by text,

  interruption_enabled boolean not null default true,
  recording_enabled boolean not null default false,
  recording_consent_message text,

  max_concurrent_calls integer not null default 1
    check (
      max_concurrent_calls between 1 and 100
    ),

  max_call_seconds integer not null default 1800
    check (
      max_call_seconds between 30 and 14400
    ),

  retention_days integer not null default 30
    check (
      retention_days between 1 and 3650
    ),

  business_hours jsonb not null default '{}'::jsonb,
  transfer_rules jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint voice_profiles_company_key
    unique (company_id),

  constraint voice_profiles_clone_consent_check
    check (
      voice_model_id is null
      or voice_clone_consent_at is not null
    )
);

create table public.voice_routes (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  profile_id uuid not null
    references public.voice_profiles(id)
    on delete cascade,

  name text not null,

  direction text not null default 'both'
    check (
      direction in (
        'inbound',
        'outbound',
        'both'
      )
    ),

  did_number text,

  destination_type text not null default 'voice_agent'
    check (
      destination_type in (
        'voice_agent',
        'human',
        'queue',
        'voicemail'
      )
    ),

  destination text,
  priority integer not null default 100,
  active boolean not null default true,

  conditions jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.call_sessions (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  profile_id uuid
    references public.voice_profiles(id)
    on delete set null,

  route_id uuid
    references public.voice_routes(id)
    on delete set null,

  contact_id uuid
    references public.crm_contacts(id)
    on delete set null,

  conversation_id uuid
    references public.conversations(id)
    on delete set null,

  external_call_id text,
  direction text not null
    check (
      direction in (
        'inbound',
        'outbound'
      )
    ),

  status text not null
    check (
      status in (
        'queued',
        'ringing',
        'connecting',
        'in_progress',
        'on_hold',
        'transferring',
        'transferred',
        'completed',
        'failed',
        'busy',
        'no_answer',
        'cancelled'
      )
    ),

  from_number text,
  to_number text,
  contact_phone text not null,

  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,

  duration_seconds integer
    check (
      duration_seconds is null
      or duration_seconds >= 0
    ),

  billable_seconds integer
    check (
      billable_seconds is null
      or billable_seconds >= 0
    ),

  recording_enabled boolean not null default false,
  recording_consent boolean,
  recording_url text,

  disposition text,
  summary text,
  transferred_to text,
  failure_reason text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index
  uq_call_sessions_company_external
on public.call_sessions (
  company_id,
  external_call_id
)
where external_call_id is not null;

create table public.call_events (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  call_session_id uuid not null
    references public.call_sessions(id)
    on delete cascade,

  external_event_id text,
  event_type text not null,
  actor_type text not null default 'system'
    check (
      actor_type in (
        'customer',
        'assistant',
        'operator',
        'provider',
        'system'
      )
    ),

  actor_id text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index
  uq_call_events_company_external
on public.call_events (
  company_id,
  external_event_id
)
where external_event_id is not null;

create table public.call_transcript_segments (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  call_session_id uuid not null
    references public.call_sessions(id)
    on delete cascade,

  sequence_number integer not null
    check (
      sequence_number >= 0
    ),

  speaker text not null
    check (
      speaker in (
        'customer',
        'assistant',
        'operator',
        'system'
      )
    ),

  text text not null,
  is_final boolean not null default true,

  confidence numeric(5,4)
    check (
      confidence is null
      or confidence between 0 and 1
    ),

  starts_at_ms integer
    check (
      starts_at_ms is null
      or starts_at_ms >= 0
    ),

  ends_at_ms integer
    check (
      ends_at_ms is null
      or ends_at_ms >= 0
    ),

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint call_transcript_segments_sequence_key
    unique (
      call_session_id,
      sequence_number
    )
);

drop trigger if exists trg_voice_profiles_updated_at
on public.voice_profiles;

create trigger trg_voice_profiles_updated_at
before update on public.voice_profiles
for each row
execute function public.commerce_touch_updated_at();

drop trigger if exists trg_voice_routes_updated_at
on public.voice_routes;

create trigger trg_voice_routes_updated_at
before update on public.voice_routes
for each row
execute function public.commerce_touch_updated_at();

drop trigger if exists trg_call_sessions_updated_at
on public.call_sessions;

create trigger trg_call_sessions_updated_at
before update on public.call_sessions
for each row
execute function public.commerce_touch_updated_at();

alter table public.voice_profiles enable row level security;
alter table public.voice_routes enable row level security;
alter table public.call_sessions enable row level security;
alter table public.call_events enable row level security;
alter table public.call_transcript_segments enable row level security;

revoke all on public.voice_profiles
from anon, authenticated;

revoke all on public.voice_routes
from anon, authenticated;

revoke all on public.call_sessions
from anon, authenticated;

revoke all on public.call_events
from anon, authenticated;

revoke all on public.call_transcript_segments
from anon, authenticated;

grant select, insert, update, delete
on public.voice_profiles
to service_role;

grant select, insert, update, delete
on public.voice_routes
to service_role;

-- Service-role access for the voice runtime.
grant select, insert, update, delete
on public.call_sessions
to service_role;

grant select, insert, update, delete
on public.call_events
to service_role;

grant select, insert, update, delete
on public.call_transcript_segments
to service_role;
