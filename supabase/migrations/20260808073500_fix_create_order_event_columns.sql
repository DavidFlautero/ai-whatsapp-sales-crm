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
      ),

      customer_type = coalesce(
        nullif(
          p_customer ->> 'customer_type',
          ''
        ),
        customer_type
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
      v_variant.cost
    )
    returning id
    into v_item_id;

    v_subtotal :=
      v_subtotal
      + v_line_subtotal;

    v_discount :=
      v_discount
      + (
          (
            v_unit_price
            - v_final_unit_price
          )
          * v_quantity
        );

    if v_reserve then
      update public.commerce_stock_balances
      set
        reserved =
          reserved + v_quantity,
        updated_at = now()
      where
        company_id = p_company_id
        and warehouse_id = v_warehouse_id
        and variant_id = v_variant.variant_id;

      insert into public.commerce_reservation_items (
        company_id,
        reservation_id,
        order_item_id,
        variant_id,
        quantity
      )
      values (
        p_company_id,
        v_reservation_id,
        v_item_id,
        v_variant.variant_id,
        v_quantity
      );
    end if;
  end loop;

  v_total :=
    round(
      v_subtotal + v_shipping,
      2
    );

  update public.commerce_orders
  set
    subtotal = v_subtotal,
    discount = v_discount,
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
      'source',
      coalesce(
        p_options ->> 'source',
        'panel'
      ),
      'number',
      v_order_number,
      'total',
      v_total,
      'stock_reserved',
      v_reserve
    )
  );

  select
    jsonb_build_object(
      'order_id',
      o.id,
      'number',
      o.number,
      'subtotal',
      o.subtotal,
      'discount',
      o.discount,
      'shipping_cost',
      o.shipping_cost,
      'total',
      o.total,
      'currency',
      o.currency,
      'commercial_status',
      o.commercial_status,
      'payment_status',
      o.payment_status,
      'fulfillment_status',
      o.fulfillment_status,
      'reservation_status',
      o.reservation_status
    )
  into v_result
  from public.commerce_orders o
  where o.id = v_order_id;

  return v_result;
end;
$$;

grant execute
on function public.commerce_create_order(
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb
)
to service_role;
