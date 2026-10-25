-- ============================================================
-- PROVIDER AVAILABILITY PER EVENT REQUIREMENT
-- ============================================================

create table if not exists public.crm_provider_availability (
  id uuid primary key default gen_random_uuid(),

  company_id text not null,

  event_id uuid not null
    references public.crm_events(id)
    on delete cascade,

  requirement_id uuid not null
    references public.crm_event_requirements(id)
    on delete cascade,

  provider_id uuid not null
    references public.crm_providers(id)
    on delete cascade,

  status text not null default 'unknown',

  event_date date null,
  start_time time null,
  end_time time null,

  notes text null,

  checked_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crm_provider_availability_status_check
    check (
      status in (
        'unknown',
        'requested',
        'available',
        'tentative',
        'unavailable',
        'reserved'
      )
    ),

  constraint crm_provider_availability_unique
    unique (
      company_id,
      event_id,
      requirement_id,
      provider_id
    )
);


create index if not exists
  crm_provider_availability_event_idx
on public.crm_provider_availability (
  company_id,
  event_id
);


create index if not exists
  crm_provider_availability_requirement_idx
on public.crm_provider_availability (
  company_id,
  requirement_id
);


create index if not exists
  crm_provider_availability_provider_idx
on public.crm_provider_availability (
  company_id,
  provider_id
);


create index if not exists
  crm_provider_availability_status_idx
on public.crm_provider_availability (
  company_id,
  status
);


create or replace function
public.crm_provider_availability_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();

  return new;
end;
$$;


drop trigger if exists
  crm_provider_availability_touch
on public.crm_provider_availability;


create trigger
  crm_provider_availability_touch
before update
on public.crm_provider_availability
for each row
execute function
  public.crm_provider_availability_touch_updated_at();


alter table
  public.crm_provider_availability
enable row level security;


comment on table
  public.crm_provider_availability
is
  'Availability checks for candidate providers per event requirement.';


comment on column
  public.crm_provider_availability.status
is
  'unknown=request not started, requested=provider contacted, available=confirmed available, tentative=provisional, unavailable=not available, reserved=reservation confirmed.';


comment on column
  public.crm_provider_availability.checked_at
is
  'Timestamp of the latest availability status verification.';
