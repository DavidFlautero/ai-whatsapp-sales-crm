-- Dominios vinculados a empresas; guardar no implica publicar ni emitir TLS.
begin;

create table if not exists public.platform_company_domains (
  company_id text not null references public.commerce_companies(id) on delete cascade,
  purpose text not null check (purpose in ('menu', 'panel')),
  kind text not null check (kind in ('custom', 'subdomain')),
  hostname text not null,
  status text not null default 'pending_dns'
    check (status in ('pending_dns','dns_verified','active','error')),
  verified_at timestamptz,
  activated_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (company_id, purpose),
  constraint platform_company_domains_hostname_unique unique (hostname),
  constraint platform_company_domains_lowercase check (hostname = lower(hostname)),
  constraint platform_company_domains_hostname_valid check (
    hostname ~ '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$'
    and length(hostname) <= 253
    and position('..' in hostname) = 0
    and position('.' in hostname) > 0
  )
);

create index if not exists platform_company_domains_status_idx
  on public.platform_company_domains (status);

alter table public.platform_company_domains enable row level security;
revoke all on public.platform_company_domains from public, anon, authenticated;
grant select, insert, update, delete on public.platform_company_domains to service_role;

notify pgrst, 'reload schema';
commit;
