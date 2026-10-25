create extension if not exists btree_gist;

create table if not exists public.crm_venue_calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  venue_id uuid not null references public.crm_venues(id) on delete cascade,
  event_id uuid references public.crm_events(id) on delete set null,

  starts_at timestamptz not null,
  ends_at timestamptz not null,

  status text not null default 'blocked'
    check (status in ('blocked','held','reserved','cancelled','expired')),

  hold_expires_at timestamptz,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crm_venue_block_dates_check
    check (ends_at > starts_at),

  constraint crm_venue_hold_expiry_check
    check (status <> 'held' or hold_expires_at is not null),

  constraint crm_venue_no_double_booking
    exclude using gist (
      company_id with =,
      venue_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    )
    where (status in ('blocked','held','reserved'))
);

create index if not exists crm_venue_calendar_lookup_idx
  on public.crm_venue_calendar_blocks
  (company_id, venue_id, starts_at);

create table if not exists public.crm_venue_availability_inquiries (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,

  venue_id uuid not null
    references public.crm_venues(id) on delete cascade,

  event_id uuid not null
    references public.crm_events(id) on delete cascade,

  starts_at timestamptz not null,
  ends_at timestamptz not null,

  status text not null default 'pending'
    check (status in ('pending','available','unavailable','conditional','cancelled')),

  owner_message_id text,
  owner_response_id text,
  owner_notes text,

  requested_at timestamptz not null default now(),
  answered_at timestamptz,
  updated_at timestamptz not null default now(),

  constraint crm_venue_inquiry_dates_check
    check (ends_at > starts_at)
);

create index if not exists crm_venue_inquiries_lookup_idx
  on public.crm_venue_availability_inquiries
  (company_id, venue_id, event_id, status);

alter table public.crm_venue_calendar_blocks
  enable row level security;

alter table public.crm_venue_availability_inquiries
  enable row level security;

grant select, insert, update, delete
  on public.crm_venue_calendar_blocks to service_role;

grant select, insert, update, delete
  on public.crm_venue_availability_inquiries to service_role;
