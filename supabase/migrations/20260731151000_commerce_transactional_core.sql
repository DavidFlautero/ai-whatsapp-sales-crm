begin;

create extension if not exists pgcrypto;

create table if not exists public.commerce_schema_migrations (
  version text primary key,
  description text not null,
  installed_at timestamptz not null default now()
);

create table if not exists public.commerce_companies (
  id text primary key,
  name text not null,

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_business_settings (
  company_id text primary key
    references public.commerce_companies(id)
    on delete cascade,

  currency text not null default 'ARS',
  order_prefix text not null default 'FUL',

  reservation_hours integer not null default 48
    check (
      reservation_hours
      between 1 and 720
    ),

  allow_partial_payments boolean not null default true,
  require_payment_before_picking boolean not null default true,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_customers (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  customer_code text,

  name text not null,
  business_name text,

  whatsapp text,
  email text,

  province text,
  city text,
  address text,

  customer_type text not null default 'wholesaler'
    check (
      customer_type in (
        'retail',
        'wholesaler',
        'distributor',
        'reseller',
        'vip',
        'other'
      )
    ),

  status text not null default 'active'
    check (
      status in (
        'active',
        'inactive',
        'blocked'
      )
    ),

  notes text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists
  commerce_customers_company_whatsapp_unique
on public.commerce_customers (
  company_id,
  whatsapp
)
where
  whatsapp is not null
  and btrim(whatsapp) <> '';

create index if not exists
  commerce_customers_company_idx
on public.commerce_customers(company_id);

create table if not exists public.commerce_warehouses (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  code text not null,
  name text not null,

  address text,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(company_id, code)
);

create table if not exists public.commerce_products (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  base_sku text not null,
  name text not null,

  category text,
  description text,

  currency text not null default 'ARS',

  cost numeric(16, 2) not null default 0
    check (cost >= 0),

  default_price numeric(16, 2) not null default 0
    check (default_price >= 0),

  active boolean not null default true,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(company_id, base_sku)
);

create index if not exists
  commerce_products_company_idx
on public.commerce_products(company_id);

create table if not exists public.commerce_product_variants (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  product_id uuid not null
    references public.commerce_products(id)
    on delete cascade,

  sku text not null,
  barcode text,

  color_name text,
  color_hex text,
  size text,

  cost_override numeric(16, 2)
    check (
      cost_override is null
      or cost_override >= 0
    ),

  price_override numeric(16, 2)
    check (
      price_override is null
      or price_override >= 0
    ),

  active boolean not null default true,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(company_id, sku)
);

create index if not exists
  commerce_product_variants_product_idx
on public.commerce_product_variants(product_id);

create table if not exists public.commerce_price_lists (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  code text not null,
  name text not null,

  currency text not null default 'ARS',

  customer_type text,
  payment_method text,

  minimum_quantity integer not null default 1
    check (minimum_quantity >= 1),

  priority integer not null default 100,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(company_id, code)
);

create table if not exists public.commerce_product_prices (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  product_id uuid not null
    references public.commerce_products(id)
    on delete cascade,

  variant_id uuid
    references public.commerce_product_variants(id)
    on delete cascade,

  price_list_id uuid not null
    references public.commerce_price_lists(id)
    on delete cascade,

  amount numeric(16, 2) not null
    check (amount >= 0),

  effective_from timestamptz not null default now(),
  effective_to timestamptz,

  created_by text,
  created_at timestamptz not null default now(),

  check (
    effective_to is null
    or effective_to > effective_from
  )
);

create index if not exists
  commerce_product_prices_lookup_idx
on public.commerce_product_prices (
  company_id,
  product_id,
  variant_id,
  price_list_id,
  effective_from desc
);

create table if not exists public.commerce_stock_balances (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  warehouse_id uuid not null
    references public.commerce_warehouses(id)
    on delete cascade,

  variant_id uuid not null
    references public.commerce_product_variants(id)
    on delete cascade,

  on_hand integer not null default 0
    check (on_hand >= 0),

  reserved integer not null default 0
    check (reserved >= 0),

  committed integer not null default 0
    check (committed >= 0),

  available integer generated always as (
    on_hand - reserved - committed
  ) stored,

  reorder_point integer not null default 0
    check (reorder_point >= 0),

  updated_at timestamptz not null default now(),

  unique(warehouse_id, variant_id),

  check (
    on_hand - reserved - committed >= 0
  )
);

create index if not exists
  commerce_stock_balances_company_idx
on public.commerce_stock_balances(company_id);

create table if not exists public.commerce_stock_movements (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  warehouse_id uuid not null
    references public.commerce_warehouses(id),

  variant_id uuid not null
    references public.commerce_product_variants(id),

  order_id uuid,

  movement_type text not null
    check (
      movement_type in (
        'initial',
        'purchase',
        'adjustment_in',
        'adjustment_out',
        'reservation',
        'reservation_release',
        'commitment',
        'shipment',
        'return'
      )
    ),

  quantity integer not null,
  balance_after integer,

  reason text,
  actor_id text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create table if not exists public.commerce_order_counters (
  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  period text not null,
  last_value integer not null default 0,

  primary key(company_id, period)
);

create table if not exists public.commerce_orders (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  number text not null,

  source text not null default 'panel'
    check (
      source in (
        'panel',
        'whatsapp',
        'import',
        'api'
      )
    ),

  customer_id uuid
    references public.commerce_customers(id),

  commercial_status text not null default 'received'
    check (
      commercial_status in (
        'received',
        'confirmed',
        'cancelled'
      )
    ),

  payment_status text not null default 'unpaid'
    check (
      payment_status in (
        'unpaid',
        'partial',
        'paid',
        'refunded'
      )
    ),

  fulfillment_status text not null default 'pending'
    check (
      fulfillment_status in (
        'pending',
        'picking',
        'picked',
        'packing',
        'packed',
        'ready_to_dispatch',
        'handed_to_carrier',
        'shipped',
        'delivered',
        'incident',
        'cancelled'
      )
    ),

  reservation_status text not null default 'none'
    check (
      reservation_status in (
        'none',
        'active',
        'converted',
        'released',
        'expired',
        'consumed'
      )
    ),

  currency text not null default 'ARS',

  price_list_code text,

  payment_method text,
  shipping_method text,
  shipping_address text,

  notes text,

  subtotal numeric(16, 2) not null default 0,
  discount numeric(16, 2) not null default 0,
  shipping_cost numeric(16, 2) not null default 0,
  total numeric(16, 2) not null default 0,
  paid_amount numeric(16, 2) not null default 0,

  tracking_token uuid not null default gen_random_uuid(),

  created_by text,
  updated_by text,

  version integer not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(company_id, number),
  unique(tracking_token),

  check (
    subtotal >= 0
    and discount >= 0
    and shipping_cost >= 0
    and total >= 0
    and paid_amount >= 0
    and paid_amount <= total
  )
);

alter table public.commerce_stock_movements
  drop constraint if exists commerce_stock_movements_order_id_fkey;

alter table public.commerce_stock_movements
  add constraint commerce_stock_movements_order_id_fkey
  foreign key(order_id)
  references public.commerce_orders(id)
  on delete set null;

create index if not exists
  commerce_orders_company_created_idx
on public.commerce_orders (
  company_id,
  created_at desc
);

create index if not exists
  commerce_orders_status_idx
on public.commerce_orders (
  company_id,
  payment_status,
  fulfillment_status
);

create table if not exists public.commerce_order_items (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.commerce_orders(id)
    on delete cascade,

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  product_id uuid
    references public.commerce_products(id),

  variant_id uuid
    references public.commerce_product_variants(id),

  sku_snapshot text not null,
  product_name_snapshot text not null,

  color_name_snapshot text,
  size_snapshot text,

  quantity integer not null
    check (quantity > 0),

  picked_quantity integer not null default 0
    check (picked_quantity >= 0),

  packed_quantity integer not null default 0
    check (packed_quantity >= 0),

  unit_price numeric(16, 2) not null
    check (unit_price >= 0),

  discount_percent numeric(7, 4) not null default 0
    check (
      discount_percent
      between 0 and 100
    ),

  final_unit_price numeric(16, 2) not null
    check (final_unit_price >= 0),

  subtotal numeric(16, 2) not null
    check (subtotal >= 0),

  cost_snapshot numeric(16, 2) not null default 0
    check (cost_snapshot >= 0),

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  check (
    picked_quantity <= quantity
    and packed_quantity <= quantity
  )
);

create index if not exists
  commerce_order_items_order_idx
on public.commerce_order_items(order_id);

create table if not exists public.commerce_reservations (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  order_id uuid not null unique
    references public.commerce_orders(id)
    on delete cascade,

  status text not null default 'active'
    check (
      status in (
        'active',
        'converted',
        'released',
        'expired',
        'consumed'
      )
    ),

  expires_at timestamptz,

  converted_at timestamptz,
  released_at timestamptz,
  consumed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists
  commerce_reservations_expiry_idx
on public.commerce_reservations (
  status,
  expires_at
);

create table if not exists public.commerce_reservation_items (
  id uuid primary key default gen_random_uuid(),

  reservation_id uuid not null
    references public.commerce_reservations(id)
    on delete cascade,

  order_item_id uuid not null
    references public.commerce_order_items(id)
    on delete cascade,

  stock_balance_id uuid not null
    references public.commerce_stock_balances(id),

  quantity integer not null
    check (quantity > 0),

  created_at timestamptz not null default now(),

  unique(reservation_id, order_item_id)
);

create table if not exists public.commerce_payments (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  order_id uuid not null
    references public.commerce_orders(id)
    on delete cascade,

  amount numeric(16, 2) not null
    check (amount > 0),

  method text not null,
  reference text,

  status text not null default 'confirmed'
    check (
      status in (
        'pending',
        'confirmed',
        'rejected',
        'refunded'
      )
    ),

  actor_id text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists
  commerce_payments_order_idx
on public.commerce_payments(order_id);

create table if not exists public.commerce_fulfillments (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  order_id uuid not null unique
    references public.commerce_orders(id)
    on delete cascade,

  assigned_to text,

  picking_started_at timestamptz,
  picking_completed_at timestamptz,

  packing_started_at timestamptz,
  packing_completed_at timestamptz,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_fulfillment_scans (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  order_id uuid not null
    references public.commerce_orders(id)
    on delete cascade,

  order_item_id uuid not null
    references public.commerce_order_items(id)
    on delete cascade,

  sku text not null,
  quantity integer not null default 1
    check (quantity > 0),

  action text not null default 'scan'
    check (
      action in (
        'scan',
        'remove'
      )
    ),

  actor_id text,

  created_at timestamptz not null default now()
);

create table if not exists public.commerce_packages (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  order_id uuid not null
    references public.commerce_orders(id)
    on delete cascade,

  package_number integer not null
    check (package_number > 0),

  total_packages integer not null
    check (total_packages > 0),

  weight_kg numeric(12, 3)
    check (
      weight_kg is null
      or weight_kg >= 0
    ),

  dimensions text,
  package_type text,

  label_token uuid not null default gen_random_uuid(),

  created_by text,
  created_at timestamptz not null default now(),

  unique(order_id, package_number),
  unique(label_token)
);

create table if not exists public.commerce_shipments (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  order_id uuid not null unique
    references public.commerce_orders(id)
    on delete cascade,

  carrier text,
  tracking_number text,
  tracking_url text,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'handed_to_carrier',
        'shipped',
        'delivered',
        'incident'
      )
    ),

  handed_to_carrier_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_order_events (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  order_id uuid not null
    references public.commerce_orders(id)
    on delete cascade,

  event_type text not null,
  title text not null,
  description text,

  actor_id text,
  actor_name text,
  actor_role text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists
  commerce_order_events_order_idx
on public.commerce_order_events (
  order_id,
  created_at desc
);

create table if not exists public.commerce_label_prints (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  order_id uuid not null
    references public.commerce_orders(id)
    on delete cascade,

  package_id uuid
    references public.commerce_packages(id)
    on delete cascade,

  label_type text not null default 'internal_a6',
  print_count integer not null default 1,

  printed_by text,
  printed_at timestamptz not null default now(),

  voided_at timestamptz,

  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.commerce_audit_events (
  id uuid primary key default gen_random_uuid(),

  company_id text,

  entity_type text not null,
  entity_id text,

  action text not null,

  actor_id text,
  actor_name text,
  actor_role text,

  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists
  commerce_audit_events_company_idx
on public.commerce_audit_events (
  company_id,
  created_at desc
);

create or replace function public.commerce_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
  trigger_name text;
begin
  foreach table_name in array array[
    'commerce_companies',
    'commerce_business_settings',
    'commerce_customers',
    'commerce_warehouses',
    'commerce_products',
    'commerce_product_variants',
    'commerce_price_lists',
    'commerce_stock_balances',
    'commerce_orders',
    'commerce_reservations',
    'commerce_fulfillments',
    'commerce_shipments'
  ]
  loop
    trigger_name :=
      'trg_' || table_name || '_updated_at';

    execute format(
      'drop trigger if exists %I on public.%I',
      trigger_name,
      table_name
    );

    execute format(
      'create trigger %I
       before update on public.%I
       for each row
       execute function public.commerce_touch_updated_at()',
      trigger_name,
      table_name
    );
  end loop;
end;
$$;

create or replace function public.commerce_next_order_number(
  p_company_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text;
  v_counter integer;
  v_prefix text;
begin
  v_period := to_char(now(), 'YYYYMM');

  select
    coalesce(order_prefix, 'FUL')
  into
    v_prefix
  from public.commerce_business_settings
  where company_id = p_company_id;

  v_prefix := coalesce(v_prefix, 'FUL');

  insert into public.commerce_order_counters (
    company_id,
    period,
    last_value
  )
  values (
    p_company_id,
    v_period,
    0
  )
  on conflict (
    company_id,
    period
  )
  do nothing;

  update public.commerce_order_counters
  set
    last_value = last_value + 1
  where
    company_id = p_company_id
    and period = v_period
  returning
    last_value
  into
    v_counter;

  return
    v_prefix
    || '-'
    || v_period
    || '-'
    || lpad(
      v_counter::text,
      6,
      '0'
    );
end;
$$;

create or replace function public.commerce_create_order(
  p_company_id text,
  p_customer jsonb,
  p_lines jsonb,
  p_options jsonb default '{}'::jsonb,
  p_actor jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_order_id uuid;
  v_order_number text;

  v_warehouse_id uuid;
  v_reservation_id uuid;

  v_currency text;
  v_reservation_hours integer;

  v_reserve boolean;
  v_subtotal numeric(16, 2) := 0;
  v_discount numeric(16, 2) := 0;
  v_shipping numeric(16, 2) := 0;
  v_total numeric(16, 2) := 0;

  v_line record;
  v_variant record;
  v_balance record;

  v_quantity integer;
  v_unit_price numeric(16, 2);
  v_discount_percent numeric(7, 4);
  v_final_unit_price numeric(16, 2);
  v_line_subtotal numeric(16, 2);
  v_item_id uuid;

  v_result jsonb;
begin
  if not exists (
    select 1
    from public.commerce_companies
    where id = p_company_id
      and active = true
  ) then
    raise exception
      'Empresa inexistente o inactiva.';
  end if;

  if
    jsonb_typeof(p_lines) <> 'array'
    or jsonb_array_length(p_lines) = 0
  then
    raise exception
      'La venta debe contener productos.';
  end if;

  select
    currency,
    reservation_hours
  into
    v_currency,
    v_reservation_hours
  from public.commerce_business_settings
  where company_id = p_company_id;

  v_currency :=
    coalesce(
      nullif(p_options ->> 'currency', ''),
      v_currency,
      'ARS'
    );

  v_reservation_hours :=
    coalesce(
      nullif(
        p_options ->> 'reservation_hours',
        ''
      )::integer,
      v_reservation_hours,
      48
    );

  v_reserve :=
    coalesce(
      (p_options ->> 'reserve_stock')::boolean,
      true
    );

  v_shipping :=
    greatest(
      coalesce(
        nullif(
          p_options ->> 'shipping_cost',
          ''
        )::numeric,
        0
      ),
      0
    );

  select
    id
  into
    v_customer_id
  from public.commerce_customers
  where
    company_id = p_company_id
    and nullif(
      p_customer ->> 'whatsapp',
      ''
    ) is not null
    and whatsapp =
      p_customer ->> 'whatsapp'
  limit 1;

  if v_customer_id is null then
    insert into public.commerce_customers (
      company_id,
      name,
      business_name,
      whatsapp,
      email,
      province,
      city,
      address,
      customer_type,
      notes,
      metadata
    )
    values (
      p_company_id,

      coalesce(
        nullif(
          p_customer ->> 'name',
          ''
        ),
        'Cliente sin nombre'
      ),

      nullif(
        p_customer ->> 'business_name',
        ''
      ),

      nullif(
        p_customer ->> 'whatsapp',
        ''
      ),

      nullif(
        p_customer ->> 'email',
        ''
      ),

      nullif(
        p_customer ->> 'province',
        ''
      ),

      nullif(
        p_customer ->> 'city',
        ''
      ),

      nullif(
        p_customer ->> 'address',
        ''
      ),

      coalesce(
        nullif(
          p_customer ->> 'customer_type',
          ''
        ),
        'wholesaler'
      ),

      nullif(
        p_customer ->> 'notes',
        ''
      ),

      coalesce(
        p_customer -> 'metadata',
        '{}'::jsonb
      )
    )
    returning id
    into v_customer_id;
  else
    update public.commerce_customers
    set
      name = coalesce(
        nullif(
          p_customer ->> 'name',
          ''
        ),
        name
      ),

      business_name = coalesce(
        nullif(
          p_customer ->> 'business_name',
          ''
        ),
        business_name
      ),

      email = coalesce(
        nullif(
          p_customer ->> 'email',
          ''
        ),
        email
      ),

      province = coalesce(
        nullif(
          p_customer ->> 'province',
          ''
        ),
        province
      ),

      city = coalesce(
        nullif(
          p_customer ->> 'city',
          ''
        ),
        city
      ),

      address = coalesce(
        nullif(
          p_customer ->> 'address',
          ''
        ),
        address
      )
    where id = v_customer_id;
  end if;

  if nullif(
    p_options ->> 'warehouse_id',
    ''
  ) is not null then
    v_warehouse_id :=
      (
        p_options ->> 'warehouse_id'
      )::uuid;
  else
    select
      id
    into
      v_warehouse_id
    from public.commerce_warehouses
    where
      company_id = p_company_id
      and active = true
    order by created_at asc
    limit 1;
  end if;

  if v_warehouse_id is null then
    raise exception
      'La empresa no tiene depósito activo.';
  end if;

  v_order_id := gen_random_uuid();

  v_order_number :=
    public.commerce_next_order_number(
      p_company_id
    );

  insert into public.commerce_orders (
    id,
    company_id,
    number,
    source,
    customer_id,

    commercial_status,
    payment_status,
    fulfillment_status,
    reservation_status,

    currency,
    price_list_code,

    payment_method,
    shipping_method,
    shipping_address,
    notes,

    subtotal,
    discount,
    shipping_cost,
    total,
    paid_amount,

    created_by,
    updated_by
  )
  values (
    v_order_id,
    p_company_id,
    v_order_number,

    coalesce(
      nullif(
        p_options ->> 'source',
        ''
      ),
      'panel'
    ),

    v_customer_id,

    'received',
    'unpaid',
    'pending',

    case
      when v_reserve
        then 'active'
      else 'none'
    end,

    v_currency,

    nullif(
      p_options ->> 'price_list_code',
      ''
    ),

    nullif(
      p_options ->> 'payment_method',
      ''
    ),

    nullif(
      p_options ->> 'shipping_method',
      ''
    ),

    nullif(
      p_options ->> 'shipping_address',
      ''
    ),

    nullif(
      p_options ->> 'notes',
      ''
    ),

    0,
    0,
    v_shipping,
    v_shipping,
    0,

    nullif(
      p_actor ->> 'id',
      ''
    ),

    nullif(
      p_actor ->> 'id',
      ''
    )
  );

  if v_reserve then
    insert into public.commerce_reservations (
      company_id,
      order_id,
      status,
      expires_at
    )
    values (
      p_company_id,
      v_order_id,
      'active',

      now()
      + make_interval(
          hours => v_reservation_hours
        )
    )
    returning id
    into v_reservation_id;
  end if;

  for v_line in
    select *
    from jsonb_to_recordset(p_lines)
      as input_line (
        variant_id uuid,
        quantity integer,
        unit_price numeric,
        discount_percent numeric
      )
  loop
    v_quantity :=
      greatest(
        coalesce(
          v_line.quantity,
          0
        ),
        0
      );

    if v_quantity <= 0 then
      raise exception
        'Todas las cantidades deben ser mayores a cero.';
    end if;

    select
      variant.id as variant_id,
      variant.sku,
      variant.color_name,
      variant.size,

      product.id as product_id,
      product.name as product_name,

      coalesce(
        variant.cost_override,
        product.cost
      ) as cost,

      coalesce(
        variant.price_override,
        product.default_price
      ) as default_price
    into
      v_variant
    from public.commerce_product_variants as variant
    join public.commerce_products as product
      on product.id = variant.product_id
    where
      variant.id = v_line.variant_id
      and variant.company_id = p_company_id
      and variant.active = true
      and product.active = true;

    if not found then
      raise exception
        'Una variante no existe o está inactiva.';
    end if;

    v_unit_price :=
      greatest(
        coalesce(
          v_line.unit_price,
          v_variant.default_price,
          0
        ),
        0
      );

    v_discount_percent :=
      greatest(
        least(
          coalesce(
            v_line.discount_percent,
            0
          ),
          100
        ),
        0
      );

    v_final_unit_price :=
      round(
        v_unit_price
        * (
          1
          - v_discount_percent
            / 100
        ),
        2
      );

    v_line_subtotal :=
      round(
        v_final_unit_price
        * v_quantity,
        2
      );

    if v_reserve then
      select
        *
      into
        v_balance
      from public.commerce_stock_balances
      where
        company_id = p_company_id
        and warehouse_id = v_warehouse_id
        and variant_id = v_variant.variant_id
      for update;

      if not found then
        raise exception
          'No existe saldo de stock para el SKU %.',
          v_variant.sku;
      end if;

      if
        (
          v_balance.on_hand
          - v_balance.reserved
          - v_balance.committed
        ) < v_quantity
      then
        raise exception
          'Stock insuficiente para %: disponible %, solicitado %.',
          v_variant.sku,
          (
            v_balance.on_hand
            - v_balance.reserved
            - v_balance.committed
          ),
          v_quantity;
      end if;
    end if;

    insert into public.commerce_order_items (
      order_id,
      company_id,

      product_id,
      variant_id,

      sku_snapshot,
      product_name_snapshot,
      color_name_snapshot,
      size_snapshot,

      quantity,

      unit_price,
      discount_percent,
      final_unit_price,
      subtotal,
      cost_snapshot
    )
    values (
      v_order_id,
      p_company_id,

      v_variant.product_id,
      v_variant.variant_id,

      v_variant.sku,
      v_variant.product_name,
      v_variant.color_name,
      v_variant.size,

      v_quantity,

      v_unit_price,
      v_discount_percent,
      v_final_unit_price,
      v_line_subtotal,
      coalesce(
        v_variant.cost,
        0
      )
    )
    returning id
    into v_item_id;

    if v_reserve then
      update public.commerce_stock_balances
      set
        reserved =
          reserved + v_quantity,

        updated_at = now()
      where id = v_balance.id;

      insert into public.commerce_reservation_items (
        reservation_id,
        order_item_id,
        stock_balance_id,
        quantity
      )
      values (
        v_reservation_id,
        v_item_id,
        v_balance.id,
        v_quantity
      );

      insert into public.commerce_stock_movements (
        company_id,
        warehouse_id,
        variant_id,
        order_id,

        movement_type,
        quantity,
        balance_after,

        reason,
        actor_id
      )
      values (
        p_company_id,
        v_warehouse_id,
        v_variant.variant_id,
        v_order_id,

        'reservation',
        v_quantity,
        v_balance.on_hand,

        'Reserva automática por nueva venta',

        nullif(
          p_actor ->> 'id',
          ''
        )
      );
    end if;

    v_subtotal :=
      v_subtotal
      + v_line_subtotal;
  end loop;

  v_discount :=
    greatest(
      coalesce(
        nullif(
          p_options ->> 'order_discount',
          ''
        )::numeric,
        0
      ),
      0
    );

  if v_discount > v_subtotal then
    raise exception
      'El descuento general supera el subtotal.';
  end if;

  v_total :=
    v_subtotal
    - v_discount
    + v_shipping;

  update public.commerce_orders
  set
    subtotal = v_subtotal,
    discount = v_discount,
    shipping_cost = v_shipping,
    total = v_total,
    updated_at = now()
  where id = v_order_id;

  insert into public.commerce_order_events (
    company_id,
    order_id,

    event_type,
    title,
    description,

    actor_id,
    actor_name,
    actor_role,

    metadata
  )
  values (
    p_company_id,
    v_order_id,

    'order.created',
    'Venta recibida',
    'La venta fue creada y registrada en el sistema.',

    nullif(
      p_actor ->> 'id',
      ''
    ),

    nullif(
      p_actor ->> 'name',
      ''
    ),

    nullif(
      p_actor ->> 'role',
      ''
    ),

    jsonb_build_object(
      'number',
      v_order_number,

      'total',
      v_total,

      'stock_reserved',
      v_reserve,

      'reservation_hours',
      case
        when v_reserve
          then v_reservation_hours
        else null
      end
    )
  );

  select
    to_jsonb(current_order)
    || jsonb_build_object(
      'items',
      (
        select
          coalesce(
            jsonb_agg(
              to_jsonb(order_item)
              order by
                order_item.created_at
            ),
            '[]'::jsonb
          )
        from public.commerce_order_items
          as order_item
        where
          order_item.order_id =
            v_order_id
      )
    )
  into
    v_result
  from public.commerce_orders
    as current_order
  where current_order.id = v_order_id;

  return v_result;
end;
$$;

create or replace function public.commerce_record_payment(
  p_order_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text default null,
  p_actor jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_new_paid numeric(16, 2);
  v_fully_paid boolean;

  v_reserved_item record;
  v_result jsonb;
begin
  select
    *
  into
    v_order
  from public.commerce_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception
      'La venta no existe.';
  end if;

  if
    v_order.commercial_status = 'cancelled'
  then
    raise exception
      'No se puede pagar una venta cancelada.';
  end if;

  if p_amount <= 0 then
    raise exception
      'El importe debe ser mayor a cero.';
  end if;

  if
    p_amount
    > (
      v_order.total
      - v_order.paid_amount
    )
  then
    raise exception
      'El pago supera el saldo pendiente.';
  end if;

  insert into public.commerce_payments (
    company_id,
    order_id,

    amount,
    method,
    reference,

    status,
    actor_id
  )
  values (
    v_order.company_id,
    p_order_id,

    round(p_amount, 2),
    p_method,
    nullif(p_reference, ''),

    'confirmed',

    nullif(
      p_actor ->> 'id',
      ''
    )
  );

  v_new_paid :=
    round(
      v_order.paid_amount
      + p_amount,
      2
    );

  v_fully_paid :=
    v_new_paid >= v_order.total;

  update public.commerce_orders
  set
    paid_amount = v_new_paid,

    payment_status =
      case
        when v_fully_paid
          then 'paid'
        else 'partial'
      end,

    commercial_status =
      case
        when v_fully_paid
          then 'confirmed'
        else commercial_status
      end,

    reservation_status =
      case
        when
          v_fully_paid
          and reservation_status = 'active'
        then 'converted'
        else reservation_status
      end,

    updated_by =
      nullif(
        p_actor ->> 'id',
        ''
      ),

    version = version + 1,
    updated_at = now()
  where id = p_order_id;

  if
    v_fully_paid
    and v_order.reservation_status = 'active'
  then
    for v_reserved_item in
      select
        reservation_item.stock_balance_id,
        reservation_item.quantity
      from public.commerce_reservations
        as reservation
      join public.commerce_reservation_items
        as reservation_item
        on reservation_item.reservation_id =
          reservation.id
      where
        reservation.order_id = p_order_id
        and reservation.status = 'active'
    loop
      update public.commerce_stock_balances
      set
        reserved =
          reserved
          - v_reserved_item.quantity,

        committed =
          committed
          + v_reserved_item.quantity,

        updated_at = now()
      where id =
        v_reserved_item.stock_balance_id;
    end loop;

    update public.commerce_reservations
    set
      status = 'converted',
      converted_at = now(),
      expires_at = null,
      updated_at = now()
    where
      order_id = p_order_id
      and status = 'active';
  end if;

  insert into public.commerce_order_events (
    company_id,
    order_id,

    event_type,
    title,
    description,

    actor_id,
    actor_name,
    actor_role,

    metadata
  )
  values (
    v_order.company_id,
    p_order_id,

    case
      when v_fully_paid
        then 'payment.confirmed'
      else 'payment.partial'
    end,

    case
      when v_fully_paid
        then 'Pago confirmado'
      else 'Pago parcial registrado'
    end,

    case
      when v_fully_paid
        then 'La venta quedó habilitada para alistamiento.'
      else 'La venta continúa pendiente de saldo.'
    end,

    nullif(
      p_actor ->> 'id',
      ''
    ),

    nullif(
      p_actor ->> 'name',
      ''
    ),

    nullif(
      p_actor ->> 'role',
      ''
    ),

    jsonb_build_object(
      'amount',
      p_amount,

      'paid_amount',
      v_new_paid,

      'remaining',
      greatest(
        v_order.total
        - v_new_paid,
        0
      ),

      'method',
      p_method,

      'reference',
      p_reference
    )
  );

  select
    to_jsonb(current_order)
  into
    v_result
  from public.commerce_orders
    as current_order
  where current_order.id = p_order_id;

  return v_result;
end;
$$;

create or replace function public.commerce_release_expired_reservations(
  p_limit integer default 200
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation record;
  v_item record;
  v_released integer := 0;
begin
  for v_reservation in
    select
      reservation.id,
      reservation.order_id,
      reservation.company_id
    from public.commerce_reservations
      as reservation
    where
      reservation.status = 'active'
      and reservation.expires_at <= now()
    order by reservation.expires_at asc
    limit greatest(
      least(
        coalesce(
          p_limit,
          200
        ),
        1000
      ),
      1
    )
    for update skip locked
  loop
    for v_item in
      select
        reservation_item.stock_balance_id,
        reservation_item.quantity
      from public.commerce_reservation_items
        as reservation_item
      where
        reservation_item.reservation_id =
          v_reservation.id
    loop
      update public.commerce_stock_balances
      set
        reserved =
          greatest(
            reserved
            - v_item.quantity,
            0
          ),

        updated_at = now()
      where id =
        v_item.stock_balance_id;
    end loop;

    update public.commerce_reservations
    set
      status = 'expired',
      released_at = now(),
      updated_at = now()
    where id = v_reservation.id;

    update public.commerce_orders
    set
      reservation_status = 'expired',
      updated_at = now(),
      version = version + 1
    where id = v_reservation.order_id;

    insert into public.commerce_order_events (
      company_id,
      order_id,

      event_type,
      title,
      description,

      metadata
    )
    values (
      v_reservation.company_id,
      v_reservation.order_id,

      'reservation.expired',
      'Reserva vencida',
      'El stock reservado volvió a quedar disponible.',

      jsonb_build_object(
        'released_at',
        now()
      )
    );

    v_released :=
      v_released + 1;
  end loop;

  return v_released;
end;
$$;

create or replace function public.commerce_transition_fulfillment(
  p_order_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb,
  p_actor jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_item record;
  v_missing integer;

  v_quantity integer;
  v_package_count integer;

  v_carrier text;
  v_tracking_number text;

  v_result jsonb;
begin
  select
    *
  into
    v_order
  from public.commerce_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception
      'La venta no existe.';
  end if;

  case p_action
    when 'start_picking' then
      if v_order.payment_status <> 'paid' then
        raise exception
          'La venta debe estar pagada.';
      end if;

      if
        v_order.fulfillment_status
        not in (
          'pending',
          'incident'
        )
      then
        raise exception
          'La venta no puede iniciar alistamiento desde este estado.';
      end if;

      insert into public.commerce_fulfillments (
        company_id,
        order_id,
        assigned_to,
        picking_started_at
      )
      values (
        v_order.company_id,
        p_order_id,

        nullif(
          p_actor ->> 'id',
          ''
        ),

        now()
      )
      on conflict(order_id)
      do update
      set
        assigned_to =
          excluded.assigned_to,

        picking_started_at =
          coalesce(
            public.commerce_fulfillments
              .picking_started_at,
            excluded.picking_started_at
          ),

        updated_at = now();

      update public.commerce_orders
      set
        fulfillment_status = 'picking',
        updated_at = now(),
        version = version + 1
      where id = p_order_id;

    when 'scan_item' then
      if v_order.fulfillment_status <> 'picking' then
        raise exception
          'El pedido no está en alistamiento.';
      end if;

      v_quantity :=
        greatest(
          coalesce(
            nullif(
              p_payload ->> 'quantity',
              ''
            )::integer,
            1
          ),
          1
        );

      select
        *
      into
        v_item
      from public.commerce_order_items
      where
        id =
          (
            p_payload ->> 'order_item_id'
          )::uuid
        and order_id = p_order_id
      for update;

      if not found then
        raise exception
          'La prenda no pertenece a la venta.';
      end if;

      if
        v_item.picked_quantity
        + v_quantity
        > v_item.quantity
      then
        raise exception
          'La cantidad verificada supera la cantidad esperada.';
      end if;

      update public.commerce_order_items
      set
        picked_quantity =
          picked_quantity
          + v_quantity
      where id = v_item.id;

      insert into public.commerce_fulfillment_scans (
        company_id,
        order_id,
        order_item_id,

        sku,
        quantity,
        action,

        actor_id
      )
      values (
        v_order.company_id,
        p_order_id,
        v_item.id,

        v_item.sku_snapshot,
        v_quantity,
        'scan',

        nullif(
          p_actor ->> 'id',
          ''
        )
      );

    when 'remove_scan' then
      if v_order.fulfillment_status <> 'picking' then
        raise exception
          'El pedido no está en alistamiento.';
      end if;

      select
        *
      into
        v_item
      from public.commerce_order_items
      where
        id =
          (
            p_payload ->> 'order_item_id'
          )::uuid
        and order_id = p_order_id
      for update;

      if not found then
        raise exception
          'La prenda no pertenece a la venta.';
      end if;

      if v_item.picked_quantity <= 0 then
        raise exception
          'La prenda no tiene verificaciones para eliminar.';
      end if;

      update public.commerce_order_items
      set
        picked_quantity =
          picked_quantity - 1
      where id = v_item.id;

      insert into public.commerce_fulfillment_scans (
        company_id,
        order_id,
        order_item_id,

        sku,
        quantity,
        action,

        actor_id
      )
      values (
        v_order.company_id,
        p_order_id,
        v_item.id,

        v_item.sku_snapshot,
        1,
        'remove',

        nullif(
          p_actor ->> 'id',
          ''
        )
      );

    when 'complete_picking' then
      if v_order.fulfillment_status <> 'picking' then
        raise exception
          'El pedido no está en alistamiento.';
      end if;

      select
        count(*)
      into
        v_missing
      from public.commerce_order_items
      where
        order_id = p_order_id
        and picked_quantity <> quantity;

      if v_missing > 0 then
        raise exception
          'No se puede completar: faltan prendas por verificar.';
      end if;

      update public.commerce_fulfillments
      set
        picking_completed_at = now(),
        updated_at = now()
      where order_id = p_order_id;

      update public.commerce_orders
      set
        fulfillment_status = 'picked',
        updated_at = now(),
        version = version + 1
      where id = p_order_id;

    when 'start_packing' then
      if v_order.fulfillment_status <> 'picked' then
        raise exception
          'El pedido debe estar alistado.';
      end if;

      update public.commerce_fulfillments
      set
        packing_started_at = now(),
        updated_at = now()
      where order_id = p_order_id;

      update public.commerce_orders
      set
        fulfillment_status = 'packing',
        updated_at = now(),
        version = version + 1
      where id = p_order_id;

    when 'complete_packing' then
      if
        v_order.fulfillment_status
        not in (
          'picked',
          'packing'
        )
      then
        raise exception
          'El pedido no está listo para completar el empaque.';
      end if;

      select
        count(*)
      into
        v_missing
      from public.commerce_order_items
      where
        order_id = p_order_id
        and picked_quantity <> quantity;

      if v_missing > 0 then
        raise exception
          'No se puede empacar un pedido incompleto.';
      end if;

      v_package_count :=
        greatest(
          least(
            coalesce(
              nullif(
                p_payload ->> 'package_count',
                ''
              )::integer,
              1
            ),
            20
          ),
          1
        );

      update public.commerce_order_items
      set
        packed_quantity = quantity
      where order_id = p_order_id;

      delete from public.commerce_packages
      where order_id = p_order_id;

      insert into public.commerce_packages (
        company_id,
        order_id,

        package_number,
        total_packages,

        weight_kg,
        dimensions,
        package_type,

        created_by
      )
      select
        v_order.company_id,
        p_order_id,

        package_number,
        v_package_count,

        nullif(
          p_payload ->> 'weight_kg',
          ''
        )::numeric,

        nullif(
          p_payload ->> 'dimensions',
          ''
        ),

        nullif(
          p_payload ->> 'package_type',
          ''
        ),

        nullif(
          p_actor ->> 'id',
          ''
        )
      from generate_series(
        1,
        v_package_count
      ) as package_number;

      update public.commerce_fulfillments
      set
        packing_completed_at = now(),
        updated_at = now()
      where order_id = p_order_id;

      update public.commerce_orders
      set
        fulfillment_status = 'packed',
        updated_at = now(),
        version = version + 1
      where id = p_order_id;

    when 'ready_to_dispatch' then
      if v_order.fulfillment_status <> 'packed' then
        raise exception
          'El pedido debe estar empacado.';
      end if;

      update public.commerce_orders
      set
        fulfillment_status =
          'ready_to_dispatch',

        updated_at = now(),
        version = version + 1
      where id = p_order_id;

    when 'hand_to_carrier' then
      if
        v_order.fulfillment_status
        not in (
          'packed',
          'ready_to_dispatch'
        )
      then
        raise exception
          'El pedido no está listo para el transporte.';
      end if;

      v_carrier :=
        nullif(
          p_payload ->> 'carrier',
          ''
        );

      v_tracking_number :=
        nullif(
          p_payload ->> 'tracking_number',
          ''
        );

      if v_carrier is null then
        raise exception
          'El transporte es obligatorio.';
      end if;

      insert into public.commerce_shipments (
        company_id,
        order_id,

        carrier,
        tracking_number,
        tracking_url,

        status,
        handed_to_carrier_at
      )
      values (
        v_order.company_id,
        p_order_id,

        v_carrier,
        v_tracking_number,

        nullif(
          p_payload ->> 'tracking_url',
          ''
        ),

        'handed_to_carrier',
        now()
      )
      on conflict(order_id)
      do update
      set
        carrier =
          excluded.carrier,

        tracking_number =
          excluded.tracking_number,

        tracking_url =
          excluded.tracking_url,

        status =
          'handed_to_carrier',

        handed_to_carrier_at =
          now(),

        updated_at =
          now();

      update public.commerce_orders
      set
        fulfillment_status =
          'handed_to_carrier',

        updated_at = now(),
        version = version + 1
      where id = p_order_id;

    when 'mark_shipped' then
      if
        v_order.fulfillment_status
        <> 'handed_to_carrier'
      then
        raise exception
          'Primero debe entregarse el pedido al transporte.';
      end if;

      v_tracking_number :=
        coalesce(
          nullif(
            p_payload ->> 'tracking_number',
            ''
          ),

          (
            select tracking_number
            from public.commerce_shipments
            where order_id = p_order_id
          )
        );

      if v_tracking_number is null then
        raise exception
          'El número de seguimiento es obligatorio.';
      end if;

      if v_order.reservation_status = 'converted' then
        for v_item in
          select
            reservation_item.stock_balance_id,
            reservation_item.quantity,

            stock_balance.warehouse_id,
            stock_balance.variant_id,
            stock_balance.on_hand
          from public.commerce_reservations
            as reservation
          join public.commerce_reservation_items
            as reservation_item
            on reservation_item.reservation_id =
              reservation.id
          join public.commerce_stock_balances
            as stock_balance
            on stock_balance.id =
              reservation_item.stock_balance_id
          where
            reservation.order_id =
              p_order_id
            and reservation.status =
              'converted'
          for update of stock_balance
        loop
          update public.commerce_stock_balances
          set
            on_hand =
              on_hand - v_item.quantity,

            committed =
              committed - v_item.quantity,

            updated_at = now()
          where id =
            v_item.stock_balance_id;

          insert into public.commerce_stock_movements (
            company_id,
            warehouse_id,
            variant_id,
            order_id,

            movement_type,
            quantity,
            balance_after,

            reason,
            actor_id
          )
          values (
            v_order.company_id,
            v_item.warehouse_id,
            v_item.variant_id,
            p_order_id,

            'shipment',
            -v_item.quantity,

            v_item.on_hand
            - v_item.quantity,

            'Salida por envío confirmado',

            nullif(
              p_actor ->> 'id',
              ''
            )
          );
        end loop;

        update public.commerce_reservations
        set
          status = 'consumed',
          consumed_at = now(),
          updated_at = now()
        where
          order_id = p_order_id
          and status = 'converted';

        update public.commerce_orders
        set
          reservation_status = 'consumed'
        where id = p_order_id;
      end if;

      update public.commerce_shipments
      set
        tracking_number =
          v_tracking_number,

        status = 'shipped',
        shipped_at = now(),
        updated_at = now()
      where order_id = p_order_id;

      update public.commerce_orders
      set
        fulfillment_status = 'shipped',
        updated_at = now(),
        version = version + 1
      where id = p_order_id;

    when 'deliver' then
      if v_order.fulfillment_status <> 'shipped' then
        raise exception
          'La venta debe estar enviada.';
      end if;

      update public.commerce_shipments
      set
        status = 'delivered',
        delivered_at = now(),
        updated_at = now()
      where order_id = p_order_id;

      update public.commerce_orders
      set
        fulfillment_status = 'delivered',
        updated_at = now(),
        version = version + 1
      where id = p_order_id;

    when 'incident' then
      if
        v_order.fulfillment_status
        in (
          'delivered',
          'cancelled'
        )
      then
        raise exception
          'No se puede registrar una incidencia en este estado.';
      end if;

      update public.commerce_orders
      set
        fulfillment_status = 'incident',
        updated_at = now(),
        version = version + 1
      where id = p_order_id;

    when 'cancel' then
      if
        v_order.payment_status
        in (
          'paid',
          'partial'
        )
      then
        raise exception
          'Una venta con pagos requiere devolución o reembolso.';
      end if;

      if
        v_order.fulfillment_status
        in (
          'shipped',
          'delivered'
        )
      then
        raise exception
          'Una venta enviada no puede cancelarse.';
      end if;

      if v_order.reservation_status = 'active' then
        for v_item in
          select
            reservation_item.stock_balance_id,
            reservation_item.quantity
          from public.commerce_reservations
            as reservation
          join public.commerce_reservation_items
            as reservation_item
            on reservation_item.reservation_id =
              reservation.id
          where
            reservation.order_id =
              p_order_id
            and reservation.status =
              'active'
        loop
          update public.commerce_stock_balances
          set
            reserved =
              greatest(
                reserved
                - v_item.quantity,
                0
              ),

            updated_at = now()
          where id =
            v_item.stock_balance_id;
        end loop;

        update public.commerce_reservations
        set
          status = 'released',
          released_at = now(),
          updated_at = now()
        where
          order_id = p_order_id
          and status = 'active';
      end if;

      update public.commerce_orders
      set
        commercial_status = 'cancelled',
        fulfillment_status = 'cancelled',

        reservation_status =
          case
            when reservation_status = 'active'
              then 'released'
            else reservation_status
          end,

        updated_at = now(),
        version = version + 1
      where id = p_order_id;

    else
      raise exception
        'Acción logística no reconocida.';
  end case;

  insert into public.commerce_order_events (
    company_id,
    order_id,

    event_type,
    title,
    description,

    actor_id,
    actor_name,
    actor_role,

    metadata
  )
  values (
    v_order.company_id,
    p_order_id,

    'fulfillment.' || p_action,
    replace(
      initcap(
        replace(
          p_action,
          '_',
          ' '
        )
      ),
      'Picking',
      'Alistamiento'
    ),

    nullif(
      p_payload ->> 'note',
      ''
    ),

    nullif(
      p_actor ->> 'id',
      ''
    ),

    nullif(
      p_actor ->> 'name',
      ''
    ),

    nullif(
      p_actor ->> 'role',
      ''
    ),

    p_payload
  );

  select
    to_jsonb(current_order)
  into
    v_result
  from public.commerce_orders
    as current_order
  where current_order.id = p_order_id;

  return v_result;
end;
$$;

insert into public.commerce_companies (
  id,
  name
)
values (
  'fulanitas',
  'Fulanitas Fábrica'
)
on conflict(id)
do update
set
  name = excluded.name,
  active = true,
  updated_at = now();

insert into public.commerce_business_settings (
  company_id,
  currency,
  order_prefix,
  reservation_hours,

  allow_partial_payments,
  require_payment_before_picking
)
values (
  'fulanitas',
  'ARS',
  'FUL',
  48,

  true,
  true
)
on conflict(company_id)
do nothing;

insert into public.commerce_warehouses (
  company_id,
  code,
  name
)
values (
  'fulanitas',
  'CENTRAL',
  'Depósito central'
)
on conflict (
  company_id,
  code
)
do update
set
  name = excluded.name,
  active = true,
  updated_at = now();

insert into public.commerce_price_lists (
  company_id,
  code,
  name,
  currency,
  customer_type,
  payment_method,
  minimum_quantity,
  priority
)
values
  (
    'fulanitas',
    'MAYORISTA',
    'Mayorista',
    'ARS',
    'wholesaler',
    null,
    1,
    100
  ),
  (
    'fulanitas',
    'TRANSFERENCIA',
    'Transferencia',
    'ARS',
    'wholesaler',
    'transferencia',
    1,
    90
  ),
  (
    'fulanitas',
    'EFECTIVO',
    'Efectivo',
    'ARS',
    'wholesaler',
    'efectivo',
    1,
    80
  ),
  (
    'fulanitas',
    'DISTRIBUIDOR',
    'Distribuidor',
    'ARS',
    'distributor',
    null,
    1,
    70
  ),
  (
    'fulanitas',
    'CURVA',
    'Precio por curva',
    'ARS',
    'wholesaler',
    null,
    1,
    60
  ),
  (
    'fulanitas',
    'DOCENA',
    'Precio por docena',
    'ARS',
    'wholesaler',
    null,
    12,
    50
  ),
  (
    'fulanitas',
    'SUGERIDO',
    'Minorista sugerido',
    'ARS',
    'retail',
    null,
    1,
    40
  )
on conflict (
  company_id,
  code
)
do update
set
  name = excluded.name,
  currency = excluded.currency,
  customer_type = excluded.customer_type,
  payment_method = excluded.payment_method,
  minimum_quantity = excluded.minimum_quantity,
  priority = excluded.priority,
  active = true,
  updated_at = now();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'commerce_companies',
    'commerce_business_settings',
    'commerce_customers',
    'commerce_warehouses',
    'commerce_products',
    'commerce_product_variants',
    'commerce_price_lists',
    'commerce_product_prices',
    'commerce_stock_balances',
    'commerce_stock_movements',
    'commerce_order_counters',
    'commerce_orders',
    'commerce_order_items',
    'commerce_reservations',
    'commerce_reservation_items',
    'commerce_payments',
    'commerce_fulfillments',
    'commerce_fulfillment_scans',
    'commerce_packages',
    'commerce_shipments',
    'commerce_order_events',
    'commerce_label_prints',
    'commerce_audit_events'
  ]
  loop
    execute format(
      'alter table public.%I enable row level security',
      table_name
    );
  end loop;
end;
$$;

/*
 * No modificar permisos de otras tablas del proyecto.
 * El aislamiento se aplica únicamente al módulo commerce.
 */
do $$
declare
  object_record record;
begin
  if exists (
    select 1
    from pg_roles
    where rolname = 'anon'
  ) then
    for object_record in
      select
        namespace.nspname as schema_name,
        relation.relname as object_name
      from pg_class as relation
      join pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relkind in ('r', 'p')
        and relation.relname like 'commerce\_%' escape '\'
    loop
      execute format(
        'revoke all on table %I.%I from anon',
        object_record.schema_name,
        object_record.object_name
      );
    end loop;
  end if;
end;
$$;

do $$
declare
  object_record record;
begin
  if exists (
    select 1
    from pg_roles
    where rolname = 'anon'
  ) then
    for object_record in
      select
        namespace.nspname as schema_name,
        relation.relname as object_name
      from pg_class as relation
      join pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relkind = 'S'
        and relation.relname like 'commerce\_%' escape '\'
    loop
      execute format(
        'revoke all on sequence %I.%I from anon',
        object_record.schema_name,
        object_record.object_name
      );
    end loop;
  end if;
end;
$$;

do $$
declare
  table_name text;
begin
  if exists (
    select 1
    from pg_roles
    where rolname = 'service_role'
  ) then
    foreach table_name in array array[
      'commerce_schema_migrations',
      'commerce_companies',
      'commerce_business_settings',
      'commerce_customers',
      'commerce_warehouses',
      'commerce_products',
      'commerce_product_variants',
      'commerce_price_lists',
      'commerce_product_prices',
      'commerce_stock_balances',
      'commerce_stock_movements',
      'commerce_order_counters',
      'commerce_orders',
      'commerce_order_items',
      'commerce_reservations',
      'commerce_reservation_items',
      'commerce_payments',
      'commerce_fulfillments',
      'commerce_fulfillment_scans',
      'commerce_packages',
      'commerce_shipments',
      'commerce_order_events',
      'commerce_label_prints',
      'commerce_audit_events'
    ]
    loop
      execute format(
        'grant select, insert, update, delete
         on public.%I
         to service_role',
        table_name
      );
    end loop;

    for table_name in
      select sequence_name
      from information_schema.sequences
      where sequence_schema = 'public'
        and sequence_name like 'commerce\_%' escape '\'
    loop
      execute format(
        'grant usage, select
         on sequence public.%I
         to service_role',
        table_name
      );
    end loop;

    grant execute
      on function public.commerce_next_order_number(text)
      to service_role;

    grant execute
      on function public.commerce_create_order(
        text,
        jsonb,
        jsonb,
        jsonb,
        jsonb
      )
      to service_role;

    grant execute
      on function public.commerce_record_payment(
        uuid,
        numeric,
        text,
        text,
        jsonb
      )
      to service_role;

    grant execute
      on function public.commerce_release_expired_reservations(integer)
      to service_role;

    grant execute
      on function public.commerce_transition_fulfillment(
        uuid,
        text,
        jsonb,
        jsonb
      )
      to service_role;
  end if;
end;
$$;

revoke all
on function public.commerce_next_order_number(text)
from public;

revoke all
on function public.commerce_create_order(
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb
)
from public;

revoke all
on function public.commerce_record_payment(
  uuid,
  numeric,
  text,
  text,
  jsonb
)
from public;

revoke all
on function public.commerce_release_expired_reservations(integer)
from public;

revoke all
on function public.commerce_transition_fulfillment(
  uuid,
  text,
  jsonb,
  jsonb
)
from public;

insert into public.commerce_schema_migrations (
  version,
  description
)
values (
  '20260731151000',
  'Commerce transactional core: catálogo, precios, stock, ventas, reservas, pagos y fulfillment'
)
on conflict(version)
do nothing;

commit;
