create table if not exists public.crm_provider_profiles (
  id uuid primary key default gen_random_uuid(),

  company_id text not null,

  provider_id uuid not null
    references public.crm_providers(id)
    on delete cascade,

  provider_type text null,

  factual_summary text null,

  commercial_relationship text null,

  preferred_contact_method text null,

  service_categories jsonb not null default '[]'::jsonb,

  known_preferences jsonb not null default '[]'::jsonb,

  commercial_conditions jsonb not null default '{}'::jsonb,

  factual_notes text null,

  ai_profile jsonb null,

  ai_profile_generated_at timestamptz null,

  source_metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  unique (
    company_id,
    provider_id
  )
);

create index if not exists
  crm_provider_profiles_company_idx
on public.crm_provider_profiles (
  company_id
);

create index if not exists
  crm_provider_profiles_provider_idx
on public.crm_provider_profiles (
  provider_id
);


create table if not exists public.crm_entity_history (
  id uuid primary key default gen_random_uuid(),

  company_id text not null,

  entity_type text not null,

  provider_id uuid null
    references public.crm_providers(id)
    on delete cascade,

  venue_id uuid null
    references public.crm_venues(id)
    on delete cascade,

  event_id uuid null
    references public.crm_events(id)
    on delete cascade,

  occurred_at timestamptz null,

  occurred_on date null,

  history_type text not null default 'note',

  title text not null,

  description text null,

  old_value jsonb null,

  new_value jsonb null,

  source text not null default 'manual',

  source_file_id text null,

  source_file_name text null,

  source_folder_id text null,

  source_folder_path text null,

  source_modified_at timestamptz null,

  confidence text not null default 'source',

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint crm_entity_history_entity_type_check
    check (
      entity_type in (
        'provider',
        'venue',
        'event',
        'general'
      )
    ),

  constraint crm_entity_history_confidence_check
    check (
      confidence in (
        'source',
        'derived',
        'unverified',
        'conflict'
      )
    )
);

create index if not exists
  crm_entity_history_company_idx
on public.crm_entity_history (
  company_id,
  occurred_at desc
);

create index if not exists
  crm_entity_history_provider_idx
on public.crm_entity_history (
  provider_id,
  occurred_at desc
);

create index if not exists
  crm_entity_history_venue_idx
on public.crm_entity_history (
  venue_id,
  occurred_at desc
);

create index if not exists
  crm_entity_history_source_idx
on public.crm_entity_history (
  company_id,
  source_file_id
);

create unique index if not exists
  crm_entity_history_drive_unique
on public.crm_entity_history (
  company_id,
  entity_type,
  source_file_id,
  history_type,
  title
)
where
  source = 'google-drive'
  and source_file_id is not null;

alter table public.crm_provider_profiles
  enable row level security;

alter table public.crm_entity_history
  enable row level security;
