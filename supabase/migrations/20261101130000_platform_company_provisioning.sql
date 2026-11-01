-- Alta transaccional de empresas desde el superadmin.
-- Se ejecuta después de las migraciones de comercio.
begin;

create table if not exists public.crm_auth_users (
  id text primary key,
  company_id text not null references public.commerce_companies(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  password_hash text not null,
  role text not null check (role in ('owner','admin','supervisor','vendedor')),
  views text[] not null default '{}',
  actions text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists crm_auth_users_email_lower_unique
  on public.crm_auth_users (lower(email));
create index if not exists crm_auth_users_company_idx
  on public.crm_auth_users (company_id);

alter table public.crm_auth_users enable row level security;
revoke all on public.crm_auth_users from public, anon, authenticated;
grant select, insert, update, delete on public.crm_auth_users to service_role;

create or replace function public.platform_create_company(
  p_company_id text,
  p_company_name text,
  p_owner_id text,
  p_owner_name text,
  p_owner_email text,
  p_password_hash text,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_slug text := lower(trim(p_company_id));
  v_email text := lower(trim(p_owner_email));
  v_name text := trim(p_company_name);
  v_owner_name text := trim(p_owner_name);
  v_currency text := upper(trim(p_currency));
  v_prefix text;
begin
  if v_slug !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
     or length(v_name) < 2
     or length(v_owner_name) < 2
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or v_currency !~ '^[A-Z]{3}$'
     or length(p_owner_id) < 10
     or p_password_hash !~ '^[$]2[aby][$][0-9]{2}[$]'
  then
    raise exception 'INVALID_COMPANY_INPUT' using errcode = '22023';
  end if;

  v_prefix := upper(left(regexp_replace(v_slug, '[^a-z0-9]', '', 'g'), 3));
  if length(v_prefix) < 2 then
    v_prefix := 'ORD';
  end if;

  insert into public.commerce_companies (id, name, active)
  values (v_slug, v_name, true);

  insert into public.commerce_business_settings (
    company_id, currency, order_prefix
  ) values (
    v_slug, v_currency, v_prefix
  );

  insert into public.crm_auth_users (
    id, company_id, name, email, password_hash, role, views, actions, active
  ) values (
    p_owner_id,
    v_slug,
    v_owner_name,
    v_email,
    p_password_hash,
    'owner',
    array['dashboard','customers','conversations','team','administration']::text[],
    array['team.manage']::text[],
    true
  );

  return jsonb_build_object(
    'id', v_slug,
    'name', v_name,
    'active', true,
    'currency', v_currency,
    'ownerEmail', v_email
  );
end;
$$;

revoke all on function public.platform_create_company(text,text,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.platform_create_company(text,text,text,text,text,text,text)
  to service_role;

notify pgrst, 'reload schema';
commit;
