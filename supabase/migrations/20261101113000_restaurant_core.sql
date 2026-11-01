-- Delibocados / restaurante: modelo independiente del comercio mayorista.
-- Aplicar tras las migraciones de commerce_companies. No contiene datos de clientes.
begin;

create extension if not exists pgcrypto;

create table if not exists public.restaurant_menu_items (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.commerce_companies(id) on delete cascade,
  sku text not null,
  name text not null,
  category text not null default 'General',
  description text,
  price numeric(14,2) not null check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, sku)
);

create index if not exists restaurant_menu_company_idx
  on public.restaurant_menu_items(company_id, active, category);

create table if not exists public.restaurant_orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity,
  company_id text not null references public.commerce_companies(id) on delete cascade,
  source text not null check (source in ('panel','qr','whatsapp','api')),
  order_type text not null check (order_type in ('table','delivery','pickup')),
  table_label text,
  customer_name text,
  customer_phone text,
  delivery_address text,
  notes text,
  status text not null default 'received'
    check (status in ('received','accepted','preparing','ready','completed','cancelled')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','paid')),
  total numeric(14,2) not null default 0 check (total >= 0),
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, order_number),
  unique(company_id, idempotency_key),
  check (order_type <> 'table' or nullif(btrim(table_label), '') is not null),
  check (order_type <> 'delivery' or nullif(btrim(delivery_address), '') is not null)
);

create index if not exists restaurant_orders_company_idx
  on public.restaurant_orders(company_id, created_at desc);

create table if not exists public.restaurant_order_lines (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.commerce_companies(id) on delete cascade,
  order_id uuid not null references public.restaurant_orders(id) on delete cascade,
  menu_item_id uuid not null references public.restaurant_menu_items(id),
  product_name text not null,
  quantity integer not null check (quantity between 1 and 100),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  subtotal numeric(14,2) not null check (subtotal >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists restaurant_order_lines_idx
  on public.restaurant_order_lines(company_id, order_id);

create table if not exists public.restaurant_print_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.commerce_companies(id) on delete cascade,
  order_id uuid not null references public.restaurant_orders(id) on delete cascade,
  station text not null check (station in ('kitchen','cashier')),
  status text not null default 'pending'
    check (status in ('pending','printed','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  printed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(order_id, station)
);

create index if not exists restaurant_print_queue_idx
  on public.restaurant_print_jobs(company_id, station, status, created_at);

-- Sin políticas públicas: solo el backend autorizado usa service_role.
alter table public.restaurant_menu_items enable row level security;
alter table public.restaurant_orders enable row level security;
alter table public.restaurant_order_lines enable row level security;
alter table public.restaurant_print_jobs enable row level security;

revoke all on public.restaurant_menu_items from anon, authenticated;
revoke all on public.restaurant_orders from anon, authenticated;
revoke all on public.restaurant_order_lines from anon, authenticated;
revoke all on public.restaurant_print_jobs from anon, authenticated;
grant select, insert, update, delete on
  public.restaurant_menu_items, public.restaurant_orders,
  public.restaurant_order_lines, public.restaurant_print_jobs to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Crea pedido, líneas y trabajos de impresión en UNA transacción.
-- No admite precios suministrados por navegador o agente IA.
create or replace function public.restaurant_create_order(
  p_company_id text,
  p_source text,
  p_order_type text,
  p_lines jsonb,
  p_table_label text default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_delivery_address text default null,
  p_notes text default null,
  p_idempotency_key text default null
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_existing uuid;
  v_item jsonb;
  v_menu record;
  v_qty integer;
  v_total numeric(14,2) := 0;
begin
  if p_company_id is null or p_company_id = '' then
    raise exception 'COMPANY_REQUIRED';
  end if;
  if p_source not in ('panel','qr','whatsapp','api') then
    raise exception 'INVALID_SOURCE';
  end if;
  if p_order_type not in ('table','delivery','pickup') then
    raise exception 'INVALID_ORDER_TYPE';
  end if;
  if p_order_type = 'table' and nullif(btrim(coalesce(p_table_label,'')), '') is null then
    raise exception 'TABLE_REQUIRED';
  end if;
  if p_order_type = 'delivery'
    and nullif(btrim(coalesce(p_delivery_address,'')), '') is null then
    raise exception 'DELIVERY_ADDRESS_REQUIRED';
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array'
    or jsonb_array_length(p_lines) not between 1 and 100 then
    raise exception 'LINES_REQUIRED';
  end if;

  if nullif(p_idempotency_key,'') is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_company_id || ':' || p_idempotency_key, 0));
    select id into v_existing
    from public.restaurant_orders
    where company_id = p_company_id and idempotency_key = p_idempotency_key;
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  insert into public.restaurant_orders (
    company_id, source, order_type, table_label, customer_name,
    customer_phone, delivery_address, notes, idempotency_key
  ) values (
    p_company_id, p_source, p_order_type, nullif(btrim(p_table_label),''),
    nullif(btrim(p_customer_name),''), nullif(btrim(p_customer_phone),''),
    nullif(btrim(p_delivery_address),''), nullif(btrim(p_notes),''),
    nullif(p_idempotency_key,'')
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(v_item) <> 'object'
      or (v_item->>'quantity') !~ '^[0-9]{1,3}$' then
      raise exception 'INVALID_LINE';
    end if;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty not between 1 and 100 then
      raise exception 'INVALID_QUANTITY';
    end if;

    select id, name, price into v_menu
    from public.restaurant_menu_items
    where id = (v_item->>'menu_item_id')::uuid
      and company_id = p_company_id and active = true;
    if not found then
      raise exception 'MENU_ITEM_NOT_FOUND';
    end if;

    insert into public.restaurant_order_lines (
      company_id, order_id, menu_item_id, product_name,
      quantity, unit_price, subtotal, notes
    ) values (
      p_company_id, v_order_id, v_menu.id, v_menu.name,
      v_qty, v_menu.price, v_qty * v_menu.price,
      nullif(btrim(v_item->>'notes'),'')
    );
    v_total := v_total + (v_qty * v_menu.price);
  end loop;

  update public.restaurant_orders
  set total = v_total
  where id = v_order_id;

  insert into public.restaurant_print_jobs(company_id, order_id, station)
  values (p_company_id, v_order_id, 'kitchen'),
         (p_company_id, v_order_id, 'cashier');
  return v_order_id;
end;
$$;

create or replace function public.restaurant_change_status(
  p_company_id text, p_order_id uuid, p_status text
) returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_previous text;
begin
  select status into v_previous
  from public.restaurant_orders
  where company_id = p_company_id and id = p_order_id
  for update;
  if not found then return false; end if;
  if v_previous = p_status then return true; end if;
  if not (
    (v_previous = 'received' and p_status in ('accepted','cancelled')) or
    (v_previous = 'accepted' and p_status in ('preparing','cancelled')) or
    (v_previous = 'preparing' and p_status in ('ready','cancelled')) or
    (v_previous = 'ready' and p_status = 'completed')
  ) then
    raise exception 'INVALID_STATUS_TRANSITION: % -> %', v_previous, p_status;
  end if;
  update public.restaurant_orders
  set status = p_status, updated_at = now()
  where company_id = p_company_id and id = p_order_id;
  return true;
end;
$$;

revoke all on function public.restaurant_create_order(text,text,text,jsonb,text,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.restaurant_create_order(text,text,text,jsonb,text,text,text,text,text,text)
  to service_role;
revoke all on function public.restaurant_change_status(text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.restaurant_change_status(text,uuid,text)
  to service_role;

commit;
