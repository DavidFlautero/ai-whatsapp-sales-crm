
begin;

create table if not exists
public.commerce_catalog_write_requests (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  idempotency_key text not null,
  request_hash text not null,

  product_id uuid
    references public.commerce_products(id)
    on delete set null,

  response_payload jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  constraint
    commerce_catalog_write_requests_key_length
  check (
    char_length(idempotency_key)
    between 16 and 200
  ),

  constraint
    commerce_catalog_write_requests_hash_length
  check (
    char_length(request_hash)
    between 32 and 128
  ),

  unique (
    company_id,
    idempotency_key
  )
);

create index if not exists
commerce_catalog_write_requests_product_idx
on public.commerce_catalog_write_requests (
  company_id,
  product_id
);

create table if not exists
public.commerce_catalog_audit_events (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  actor_id text,

  entity_type text not null
    check (
      entity_type in (
        'product',
        'variant',
        'stock',
        'image'
      )
    ),

  entity_id text not null,
  action text not null,

  before_data jsonb,
  after_data jsonb,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now()
);

create index if not exists
commerce_catalog_audit_lookup_idx
on public.commerce_catalog_audit_events (
  company_id,
  entity_type,
  entity_id,
  created_at desc
);

create or replace function
public.commerce_create_full_product(
  p_company_id text,
  p_actor_id text,
  p_idempotency_key text,
  p_request_hash text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_existing_request
    public.commerce_catalog_write_requests%rowtype;

  v_product
    public.commerce_products%rowtype;

  v_warehouse
    public.commerce_warehouses%rowtype;

  v_variant_json jsonb;
  v_variant
    public.commerce_product_variants%rowtype;

  v_base_sku text;
  v_name text;
  v_currency text;
  v_default_price numeric(16, 2);
  v_active boolean;

  v_variant_sku text;
  v_physical integer;
  v_minimum integer;
  v_total_stock integer := 0;
  v_variant_count integer := 0;

  v_response jsonb;
begin
  if p_company_id is null
     or btrim(p_company_id) = '' then
    raise exception using
      errcode = 'P0001',
      message = 'CATALOG_COMPANY_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.commerce_companies
    where id = p_company_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CATALOG_COMPANY_NOT_FOUND';
  end if;

  if p_idempotency_key is null
     or char_length(
       btrim(p_idempotency_key)
     ) < 16 then
    raise exception using
      errcode = 'P0001',
      message = 'CATALOG_IDEMPOTENCY_KEY_INVALID';
  end if;

  if p_request_hash is null
     or char_length(
       btrim(p_request_hash)
     ) < 32 then
    raise exception using
      errcode = 'P0001',
      message = 'CATALOG_REQUEST_HASH_INVALID';
  end if;

  /*
   * Evita dos escrituras simultáneas
   * con la misma clave de idempotencia.
   */
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_company_id
      || ':'
      || p_idempotency_key,
      0
    )
  );

  select *
  into v_existing_request
  from public.commerce_catalog_write_requests
  where company_id = p_company_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing_request.request_hash
       <> p_request_hash then
      raise exception using
        errcode = 'P0001',
        message =
          'CATALOG_IDEMPOTENCY_CONFLICT';
    end if;

    return
      v_existing_request.response_payload;
  end if;

  if p_payload is null
     or jsonb_typeof(p_payload)
        <> 'object' then
    raise exception using
      errcode = 'P0001',
      message = 'CATALOG_PAYLOAD_INVALID';
  end if;

  v_base_sku :=
    upper(
      btrim(
        coalesce(
          p_payload->>'baseSku',
          ''
        )
      )
    );

  v_name :=
    btrim(
      coalesce(
        p_payload->>'name',
        ''
      )
    );

  v_currency :=
    upper(
      btrim(
        coalesce(
          p_payload->>'currency',
          'ARS'
        )
      )
    );

  v_default_price :=
    coalesce(
      nullif(
        p_payload->>'price',
        ''
      )::numeric,
      0
    );

  v_active :=
    coalesce(
      nullif(
        p_payload->>'active',
        ''
      )::boolean,
      true
    );

  if v_base_sku = '' then
    raise exception using
      errcode = 'P0001',
      message = 'CATALOG_BASE_SKU_REQUIRED';
  end if;

  if char_length(v_base_sku) > 80 then
    raise exception using
      errcode = 'P0001',
      message = 'CATALOG_BASE_SKU_TOO_LONG';
  end if;

  if v_name = ''
     or char_length(v_name) < 3
     or char_length(v_name) > 160 then
    raise exception using
      errcode = 'P0001',
      message = 'CATALOG_NAME_INVALID';
  end if;

  if v_currency <> 'ARS' then
    raise exception using
      errcode = 'P0001',
      message = 'CATALOG_CURRENCY_NOT_ALLOWED';
  end if;

  if v_default_price <= 0
     and v_active then
    raise exception using
      errcode = 'P0001',
      message = 'CATALOG_PRICE_INVALID';
  end if;

  if jsonb_typeof(
       p_payload->'variants'
     ) <> 'array'
     or jsonb_array_length(
       p_payload->'variants'
     ) = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'CATALOG_VARIANTS_REQUIRED';
  end if;

  if jsonb_array_length(
       p_payload->'variants'
     ) > 200 then
    raise exception using
      errcode = 'P0001',
      message = 'CATALOG_TOO_MANY_VARIANTS';
  end if;

  /*
   * Detecta SKU repetido dentro
   * del mismo payload.
   */
  if (
    select count(*)
    from jsonb_array_elements(
      p_payload->'variants'
    )
  ) <> (
    select count(
      distinct upper(
        btrim(value->>'sku')
      )
    )
    from jsonb_array_elements(
      p_payload->'variants'
    )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CATALOG_DUPLICATE_VARIANT_SKU';
  end if;

  /*
   * Crear no debe modificar silenciosamente
   * un producto existente.
   */
  if exists (
    select 1
    from public.commerce_products
    where company_id = p_company_id
      and base_sku = v_base_sku
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CATALOG_BASE_SKU_EXISTS';
  end if;

  insert into public.commerce_products (
    company_id,
    base_sku,
    name,
    category,
    description,
    currency,
    cost,
    default_price,
    active,
    metadata,
    created_at,
    updated_at
  )
  values (
    p_company_id,
    v_base_sku,
    v_name,
    nullif(
      btrim(
        p_payload->>'category'
      ),
      ''
    ),
    nullif(
      btrim(
        p_payload->>'description'
      ),
      ''
    ),
    v_currency,
    0,
    v_default_price,
    v_active,
    jsonb_strip_nulls(
      jsonb_build_object(
        'audience',
          nullif(
            btrim(
              p_payload->>'audience'
            ),
            ''
          ),
        'subcategory',
          nullif(
            btrim(
              p_payload->>'subcategory'
            ),
            ''
          ),
        'collection',
          nullif(
            btrim(
              p_payload->>'collection'
            ),
            ''
          ),
        'season',
          nullif(
            btrim(
              p_payload->>'season'
            ),
            ''
          ),
        'brand',
          nullif(
            btrim(
              p_payload->>'brand'
            ),
            ''
          ),
        'supplier',
          nullif(
            btrim(
              p_payload->>'supplier'
            ),
            ''
          ),
        'composition',
          nullif(
            btrim(
              p_payload->>'composition'
            ),
            ''
          ),
        'tags',
          coalesce(
            p_payload->'tags',
            '[]'::jsonb
          )
      )
    ),
    now(),
    now()
  )
  returning *
  into v_product;

  insert into public.commerce_warehouses (
    company_id,
    code,
    name,
    active,
    created_at,
    updated_at
  )
  values (
    p_company_id,
    'CENTRAL',
    'Depósito principal',
    true,
    now(),
    now()
  )
  on conflict (
    company_id,
    code
  )
  do update set
    active = true,
    updated_at = now()
  returning *
  into v_warehouse;

  for v_variant_json in
    select value
    from jsonb_array_elements(
      p_payload->'variants'
    )
  loop
    v_variant_sku :=
      upper(
        btrim(
          coalesce(
            v_variant_json->>'sku',
            ''
          )
        )
      );

    if v_variant_sku = '' then
      raise exception using
        errcode = 'P0001',
        message =
          'CATALOG_VARIANT_SKU_REQUIRED';
    end if;

    if char_length(
         v_variant_sku
       ) > 100 then
      raise exception using
        errcode = 'P0001',
        message =
          'CATALOG_VARIANT_SKU_TOO_LONG';
    end if;

    if exists (
      select 1
      from public.commerce_product_variants
      where company_id = p_company_id
        and sku = v_variant_sku
    ) then
      raise exception using
        errcode = 'P0001',
        message =
          'CATALOG_VARIANT_SKU_EXISTS:'
          || v_variant_sku;
    end if;

    v_physical :=
      greatest(
        coalesce(
          nullif(
            v_variant_json->>'physical',
            ''
          )::integer,
          0
        ),
        0
      );

    v_minimum :=
      greatest(
        coalesce(
          nullif(
            v_variant_json->>'minimum',
            ''
          )::integer,
          0
        ),
        0
      );

    insert into
    public.commerce_product_variants (
      company_id,
      product_id,
      sku,
      barcode,
      color_name,
      color_hex,
      size,
      cost_override,
      price_override,
      active,
      metadata,
      created_at,
      updated_at
    )
    values (
      p_company_id,
      v_product.id,
      v_variant_sku,
      nullif(
        btrim(
          v_variant_json->>'barcode'
        ),
        ''
      ),
      nullif(
        btrim(
          v_variant_json->>'colorName'
        ),
        ''
      ),
      nullif(
        btrim(
          v_variant_json->>'colorHex'
        ),
        ''
      ),
      nullif(
        btrim(
          v_variant_json->>'size'
        ),
        ''
      ),
      null,
      case
        when nullif(
          v_variant_json->>'price',
          ''
        ) is null
          then null
        else (
          v_variant_json->>'price'
        )::numeric
      end,
      coalesce(
        nullif(
          v_variant_json->>'active',
          ''
        )::boolean,
        true
      ),
      jsonb_strip_nulls(
        jsonb_build_object(
          'colorCode',
            nullif(
              btrim(
                v_variant_json
                ->>'colorCode'
              ),
              ''
            ),
          'incoming',
            greatest(
              coalesce(
                nullif(
                  v_variant_json
                  ->>'incoming',
                  ''
                )::integer,
                0
              ),
              0
            ),
          'images',
            coalesce(
              v_variant_json->'images',
              '[]'::jsonb
            )
        )
      ),
      now(),
      now()
    )
    returning *
    into v_variant;

    insert into
    public.commerce_stock_balances (
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
      v_physical,
      0,
      0,
      v_minimum,
      now()
    );

    if v_physical > 0 then
      insert into
      public.commerce_stock_movements (
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
        'initial',
        v_physical,
        v_physical,
        'Alta inicial de catálogo',
        p_actor_id,
        jsonb_build_object(
          'source',
          'catalog_product_create',
          'baseSku',
          v_base_sku
        ),
        now()
      );
    end if;

    insert into
    public.commerce_catalog_audit_events (
      company_id,
      actor_id,
      entity_type,
      entity_id,
      action,
      after_data,
      metadata
    )
    values (
      p_company_id,
      p_actor_id,
      'variant',
      v_variant.id::text,
      'created',
      to_jsonb(v_variant),
      jsonb_build_object(
        'productId',
        v_product.id
      )
    );

    v_variant_count :=
      v_variant_count + 1;

    v_total_stock :=
      v_total_stock + v_physical;
  end loop;

  v_response :=
    jsonb_build_object(
      'productId',
        v_product.id,
      'companyId',
        p_company_id,
      'baseSku',
        v_product.base_sku,
      'name',
        v_product.name,
      'currency',
        v_product.currency,
      'price',
        v_product.default_price,
      'warehouse',
        jsonb_build_object(
          'id',
            v_warehouse.id,
          'code',
            v_warehouse.code,
          'name',
            v_warehouse.name
        ),
      'variantsCreated',
        v_variant_count,
      'totalStock',
        v_total_stock,
      'idempotentReplay',
        false
    );

  insert into
  public.commerce_catalog_audit_events (
    company_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    after_data,
    metadata
  )
  values (
    p_company_id,
    p_actor_id,
    'product',
    v_product.id::text,
    'created',
    to_jsonb(v_product),
    jsonb_build_object(
      'variantCount',
      v_variant_count,
      'totalStock',
      v_total_stock
    )
  );

  insert into
  public.commerce_catalog_write_requests (
    company_id,
    idempotency_key,
    request_hash,
    product_id,
    response_payload
  )
  values (
    p_company_id,
    p_idempotency_key,
    p_request_hash,
    v_product.id,
    v_response
  );

  return v_response;
end;
$function$;

revoke all on function
public.commerce_create_full_product(
  text,
  text,
  text,
  text,
  jsonb
)
from public;

revoke all on function
public.commerce_create_full_product(
  text,
  text,
  text,
  text,
  jsonb
)
from anon;

revoke all on function
public.commerce_create_full_product(
  text,
  text,
  text,
  text,
  jsonb
)
from authenticated;

grant execute on function
public.commerce_create_full_product(
  text,
  text,
  text,
  text,
  jsonb
)
to service_role;

revoke all on table
public.commerce_catalog_write_requests
from public, anon, authenticated;

revoke all on table
public.commerce_catalog_audit_events
from public, anon, authenticated;

grant all on table
public.commerce_catalog_write_requests
to service_role;

grant all on table
public.commerce_catalog_audit_events
to service_role;

commit;
