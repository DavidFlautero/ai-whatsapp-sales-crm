alter table public.crm_event_requirements
  add column if not exists service_name text,
  add column if not exists subcategory text,
  add column if not exists description text,
  add column if not exists quantity integer not null default 1,
  add column if not exists is_required boolean not null default true,
  add column if not exists is_critical boolean not null default false,
  add column if not exists max_budget numeric(14,2),
  add column if not exists service_status text not null default 'pending',

  add column if not exists responsible_team_member_id uuid
    references public.crm_team_members(id)
    on delete set null,

  add column if not exists assigned_provider_id uuid
    references public.crm_providers(id)
    on delete set null,

  add column if not exists provider_cost numeric(14,2) not null default 0,
  add column if not exists client_price numeric(14,2) not null default 0,

  add column if not exists commercial_terms text,

  add column if not exists deposit_required numeric(14,2) not null default 0,
  add column if not exists deposit_paid numeric(14,2) not null default 0,

  add column if not exists provider_payment_due_date date,

  add column if not exists contract_status text not null default 'not_required',

  add column if not exists arrival_time time,
  add column if not exists setup_time time,
  add column if not exists technical_needs text,
  add column if not exists operational_notes text,

  add column if not exists documents jsonb not null default '[]'::jsonb,

  add column if not exists updated_at timestamptz not null default now();


alter table public.crm_event_requirements
  drop constraint if exists crm_event_requirements_quantity_check;

alter table public.crm_event_requirements
  add constraint crm_event_requirements_quantity_check
  check (quantity > 0);


alter table public.crm_event_requirements
  drop constraint if exists crm_event_requirements_service_status_check;

alter table public.crm_event_requirements
  add constraint crm_event_requirements_service_status_check
  check (
    service_status in (
      'pending',
      'searching',
      'quoted',
      'approved',
      'confirmed',
      'completed',
      'cancelled'
    )
  );


alter table public.crm_event_requirements
  drop constraint if exists crm_event_requirements_contract_status_check;

alter table public.crm_event_requirements
  add constraint crm_event_requirements_contract_status_check
  check (
    contract_status in (
      'not_required',
      'pending',
      'generated',
      'sent',
      'signed',
      'cancelled'
    )
  );


alter table public.crm_event_requirements
  drop constraint if exists crm_event_requirements_financial_check;

alter table public.crm_event_requirements
  add constraint crm_event_requirements_financial_check
  check (
    provider_cost >= 0
    and client_price >= 0
    and deposit_required >= 0
    and deposit_paid >= 0
    and (
      max_budget is null
      or max_budget >= 0
    )
  );


create index if not exists
  crm_event_requirements_provider_idx
on public.crm_event_requirements (
  company_id,
  assigned_provider_id
);


create index if not exists
  crm_event_requirements_status_idx
on public.crm_event_requirements (
  company_id,
  event_id,
  service_status
);


create index if not exists
  crm_event_requirements_critical_idx
on public.crm_event_requirements (
  company_id,
  event_id,
  is_critical
);


create or replace function public.crm_touch_event_requirement()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


drop trigger if exists
  crm_event_requirements_touch
on public.crm_event_requirements;


create trigger crm_event_requirements_touch
before update
on public.crm_event_requirements
for each row
execute function public.crm_touch_event_requirement();


comment on column public.crm_event_requirements.service_status is
  'Estado operativo del servicio dentro del evento.';

comment on column public.crm_event_requirements.is_critical is
  'Si es true, el evento no debería marcarse Listo mientras el servicio no esté confirmado o completado.';

comment on column public.crm_event_requirements.assigned_provider_id is
  'Proveedor finalmente seleccionado por una persona. La IA puede recomendar, pero no asignar autónomamente.';
