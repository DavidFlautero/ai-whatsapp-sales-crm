alter table public.crm_venues
  add column if not exists verification_status text
    not null default 'unverified',

  add column if not exists last_verified_at timestamptz,

  add column if not exists verification_requested_at timestamptz,

  add column if not exists next_verification_at timestamptz,

  add column if not exists verification_interval_days integer
    not null default 90,

  add column if not exists verification_message_id text,

  add column if not exists verification_template_name text;

create index if not exists
  crm_venues_verification_due_idx
on public.crm_venues (
  company_id,
  verification_status,
  next_verification_at
);
