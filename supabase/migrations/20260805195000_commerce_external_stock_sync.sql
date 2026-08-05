begin;

create table if not exists
public.commerce_external_stock_syncs (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  idempotency_key text not null,
  request_hash text not null,

  variant_id uuid
    references public.commerce_product_variants(id),

  warehouse_id uuid
    references public.commerce_warehouses(id),

  external_on_hand integer,
  previous_on_hand integer,
  resulting_on_hand integer,

  status text not null default 'processing'
    check (
      status in (
        'processing',
        'completed',
        'failed'
      )
    ),

  result_data jsonb,
  error_code text,
  error_message text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(company_id, idempotency_key)
);


create index if not exists
commerce_external_stock_syncs_variant_idx
on public.commerce_external_stock_syncs (
  company_id,
  variant_id,
  created_at desc
);


alter table
public.commerce_external_stock_syncs
enable row level security;


revoke all
on table public.commerce_external_stock_syncs
from public, anon, authenticated;


grant
  select,
  insert,
  update
on table public.commerce_external_stock_syncs
to service_role;


create or replace function
public.commerce_sync_external_stock(
  p_company_id text,
  p_variant_sku text,
  p_external_on_hand integer,
  p_idempotency_key text,
  p_warehouse_code text default 'CENTRAL',
  p_source text default 'ninox',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_variant public.commerce_product_variants%rowtype;
  v_warehouse public.commerce_warehouses%rowtype;
  v_balance public.commerce_stock_balances%rowtype;
  v_sync public.commerce_external_stock_syncs%rowtype;

  v_request_hash text;
  v_delta integer;
  v_result jsonb;
begin
  if
    p_company_id is null
    or btrim(p_company_id) = ''
  then
    raise exception 'COMPANY_REQUIRED';
  end if;

  if
    p_variant_sku is null
    or btrim(p_variant_sku) = ''
  then
    raise exception 'VARIANT_SKU_REQUIRED';
  end if;

  if
    p_external_on_hand is null
    or p_external_on_hand < 0
  then
    raise exception 'EXTERNAL_STOCK_INVALID';
  end if;

  if
    p_idempotency_key is null
    or char_length(btrim(p_idempotency_key)) < 8
  then
    raise exception 'IDEMPOTENCY_KEY_INVALID';
  end if;

  if
    p_warehouse_code is null
    or btrim(p_warehouse_code) = ''
  then
    raise exception 'WAREHOUSE_CODE_REQUIRED';
  end if;

  v_request_hash :=
    md5(
      concat_ws(
        '|',
        p_company_id,
        upper(btrim(p_variant_sku)),
        p_external_on_hand::text,
        upper(btrim(p_warehouse_code)),
        coalesce(p_source, ''),
        coalesce(p_metadata::text, '{}')
      )
    );

  insert into public.commerce_external_stock_syncs (
    company_id,
    idempotency_key,
    request_hash,
    external_on_hand,
    status,
    metadata
  )
  values (
    p_company_id,
    btrim(p_idempotency_key),
    v_request_hash,
    p_external_on_hand,
    'processing',
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (
    company_id,
    idempotency_key
  )
  do nothing;

  select *
  into v_sync
  from public.commerce_external_stock_syncs
  where company_id = p_company_id
    and idempotency_key = btrim(
      p_idempotency_key
    )
  for update;

  if v_sync.id is null then
    raise exception 'STOCK_SYNC_REGISTER_FAILED';
  end if;

  if v_sync.request_hash <> v_request_hash then
    raise exception 'IDEMPOTENCY_CONFLICT';
  end if;

  if v_sync.status = 'completed' then
    return
      jsonb_set(
        coalesce(
          v_sync.result_data,
          '{}'::jsonb
        ),
        '{idempotent}',
        'true'::jsonb,
        true
      );
  end if;

  if v_sync.status = 'failed' then
    raise exception
      'PREVIOUS_STOCK_SYNC_FAILED: %',
      coalesce(
        v_sync.error_message,
        v_sync.error_code,
        'Unknown error'
      );
  end if;

  select *
  into v_variant
  from public.commerce_product_variants
  where company_id = p_company_id
    and sku = upper(
      btrim(p_variant_sku)
    )
  for update;

  if v_variant.id is null then
    raise exception
      'VARIANT_NOT_FOUND: %',
      upper(btrim(p_variant_sku));
  end if;

  select *
  into v_warehouse
  from public.commerce_warehouses
  where company_id = p_company_id
    and code = upper(
      btrim(p_warehouse_code)
    )
    and active = true
  for update;

  if v_warehouse.id is null then
    raise exception
      'WAREHOUSE_NOT_FOUND: %',
      upper(btrim(p_warehouse_code));
  end if;

  insert into public.commerce_stock_balances (
    company_id,
    warehouse_id,
    variant_id,
    on_hand,
    reserved,
    committed,
    reorder_point,
    updated_at
  )
  values (
    p_company_id,
    v_warehouse.id,
    v_variant.id,
    p_external_on_hand,
    0,
    0,
    0,
    now()
  )
  on conflict (
    warehouse_id,
    variant_id
  )
  do nothing;

  select *
  into v_balance
  from public.commerce_stock_balances
  where company_id = p_company_id
    and warehouse_id = v_warehouse.id
    and variant_id = v_variant.id
  for update;

  if v_balance.id is null then
    raise exception 'STOCK_BALANCE_NOT_FOUND';
  end if;

  if
    p_external_on_hand
    < v_balance.reserved
      + v_balance.committed
  then
    raise exception
      'EXTERNAL_STOCK_BELOW_RESERVED: external=% reserved=% committed=%',
      p_external_on_hand,
      v_balance.reserved,
      v_balance.committed;
  end if;

  v_delta :=
    p_external_on_hand
    - v_balance.on_hand;

  update public.commerce_stock_balances
  set
    on_hand = p_external_on_hand,
    updated_at = now()
  where id = v_balance.id;

  if v_delta <> 0 then
    insert into public.commerce_stock_movements (
      company_id,
      warehouse_id,
      variant_id,
      movement_type,
      quantity,
      balance_after,
      reason,
      actor_id,
      metadata,
      created_at
    )
    values (
      p_company_id,
      v_warehouse.id,
      v_variant.id,
      case
        when v_delta > 0
          then 'adjustment_in'
        else 'adjustment_out'
      end,
      v_delta,
      p_external_on_hand,
      'Sincronización de stock externo',
      coalesce(
        nullif(
          btrim(p_source),
          ''
        ),
        'external'
      ),
      jsonb_strip_nulls(
        coalesce(
          p_metadata,
          '{}'::jsonb
        )
        || jsonb_build_object(
          'source',
          coalesce(
            nullif(
              btrim(p_source),
              ''
            ),
            'external'
          ),
          'idempotencyKey',
          btrim(p_idempotency_key),
          'variantSku',
          v_variant.sku,
          'previousOnHand',
          v_balance.on_hand,
          'externalOnHand',
          p_external_on_hand
        )
      ),
      now()
    );
  end if;

  v_result :=
    jsonb_build_object(
      'ok',
      true,
      'companyId',
      p_company_id,
      'warehouseId',
      v_warehouse.id,
      'warehouseCode',
      v_warehouse.code,
      'variantId',
      v_variant.id,
      'variantSku',
      v_variant.sku,
      'previousOnHand',
      v_balance.on_hand,
      'onHand',
      p_external_on_hand,
      'reserved',
      v_balance.reserved,
      'committed',
      v_balance.committed,
      'available',
      p_external_on_hand
        - v_balance.reserved
        - v_balance.committed,
      'delta',
      v_delta,
      'idempotent',
      false
    );

  update public.commerce_external_stock_syncs
  set
    variant_id = v_variant.id,
    warehouse_id = v_warehouse.id,
    previous_on_hand = v_balance.on_hand,
    resulting_on_hand = p_external_on_hand,
    status = 'completed',
    result_data = v_result,
    updated_at = now()
  where id = v_sync.id;

  return v_result;

end;
$$;


revoke all
on function public.commerce_sync_external_stock(
  text,
  text,
  integer,
  text,
  text,
  text,
  jsonb
)
from public, anon, authenticated;


grant execute
on function public.commerce_sync_external_stock(
  text,
  text,
  integer,
  text,
  text,
  text,
  jsonb
)
to service_role;


comment on function
public.commerce_sync_external_stock(
  text,
  text,
  integer,
  text,
  text,
  text,
  jsonb
)
is
  'Sincroniza stock físico desde un sistema externo, preservando reservas, registrando movimientos e idempotencia.';


insert into public.commerce_schema_migrations (
  version,
  description
)
values (
  '20260805195000',
  'Sincronización transaccional e idempotente de stock externo'
)
on conflict(version)
do nothing;

commit;
