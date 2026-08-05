create table if not exists public.operator_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  contact_phone text not null,
  status text not null default 'ai'
    check (status in ('ai', 'human', 'paused')),
  assigned_to text,
  reason text,
  taken_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (company_id, contact_phone)
);

create index if not exists
  operator_assignments_company_status_idx
on public.operator_assignments (
  company_id,
  status,
  updated_at desc
);

alter table public.operator_assignments
  enable row level security;

revoke all
on public.operator_assignments
from anon, authenticated;

grant select, insert, update, delete
on public.operator_assignments
to service_role;

notify pgrst, 'reload schema';
