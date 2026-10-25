create table if not exists public.crm_files (
  id uuid primary key default gen_random_uuid(),

  company_id text not null,

  provider_id uuid null
    references public.crm_providers(id)
    on delete set null,

  venue_id uuid null
    references public.crm_venues(id)
    on delete set null,

  event_id uuid null
    references public.crm_events(id)
    on delete set null,

  category text not null default 'other',

  visibility text not null default 'private',

  title text null,

  original_name text not null,

  mime_type text null,

  extension text null,

  size_bytes bigint null,

  bucket text not null,

  storage_path text not null,

  public_url text null,

  source text not null default 'manual',

  source_file_id text null,

  source_folder_id text null,

  source_folder_path text null,

  source_modified_at timestamptz null,

  checksum_sha256 text null,

  notes text null,

  metadata jsonb not null default '{}'::jsonb,

  active boolean not null default true,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint crm_files_category_check
    check (
      category in (
        'image',
        'video',
        'contract',
        'quote',
        'spreadsheet',
        'document',
        'audio',
        'location',
        'terms',
        'availability',
        'historical',
        'other'
      )
    ),

  constraint crm_files_visibility_check
    check (
      visibility in (
        'public',
        'private',
        'internal'
      )
    )
);

create index if not exists
  crm_files_company_idx
on public.crm_files (
  company_id
);

create index if not exists
  crm_files_provider_idx
on public.crm_files (
  provider_id
);

create index if not exists
  crm_files_venue_idx
on public.crm_files (
  venue_id
);

create index if not exists
  crm_files_event_idx
on public.crm_files (
  event_id
);

create index if not exists
  crm_files_category_idx
on public.crm_files (
  company_id,
  category
);

create index if not exists
  crm_files_source_file_idx
on public.crm_files (
  company_id,
  source,
  source_file_id
);

create unique index if not exists
  crm_files_drive_source_unique
on public.crm_files (
  company_id,
  source_file_id
)
where
  source = 'google-drive'
  and source_file_id is not null;

alter table public.crm_files
  enable row level security;
