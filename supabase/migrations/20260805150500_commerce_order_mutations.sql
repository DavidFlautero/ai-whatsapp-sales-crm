create or replace function public.commerce_mutate_order(
  p_company_id text,
  p_order_id uuid,
  p_expected_version integer,
  p_idempotency_key text,
  p_operations jsonb,
  p_source text default 'api',
  p_message_id text default null,
  p_actor jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.commerce_orders%rowtype;
  v_operation_row public.commerce_order_operations%rowtype;

  v_operation jsonb;
  v_operation_type text;

  v_request_hash text;

  v_order_item public.commerce_order_items%rowtype;
  v_existing_item public.commerce_order_items%rowtype;

  v_reservation public.commerce_reservations%rowtype;
  v_reservation_item public.commerce_reservation_items%rowtype;

  v_old_balance public.commerce_stock_balances%rowtype;
  v_new_balance public.commerce_stock_balances%rowtype;

  v_variant public.commerce_product_variants%rowtype;
  v_product public.commerce_products%rowtype;

  v_order_item_id uuid;
  v_variant_id uuid;
  v_new_variant_id uuid;

  v_old_quantity integer;
  v_new_quantity integer;
  v_delta integer;

  v_unit_price numeric(16, 2);
  v_line_subtotal numeric(16, 2);

  v_subtotal numeric(16, 2);
  v_total numeric(16, 2);

  v_result jsonb;

  v_actor_id text;
  v_actor_name text;
  v_actor_role text;
begin
  -- ----------------------------------------------------------
  -- Validaciones básicas
  -- ----------------------------------------------------------

  if
    p_company_id is null
    or btrim(p_company_id) = ''
  then
    raise exception 'COMPANY_REQUIRED';
  end if;


  if p_order_id is null then
    raise exception 'ORDER_ID_REQUIRED';
  end if;


  if
    p_idempotency_key is null
    or char_length(
      btrim(p_idempotency_key)
    ) < 8
  then
    raise exception 'IDEMPOTENCY_KEY_INVALID';
  end if;


  if
    jsonb_typeof(p_operations) <> 'array'
    or jsonb_array_length(p_operations) = 0
  then
    raise exception 'OPERATIONS_REQUIRED';
  end if;


  if jsonb_array_length(p_operations) > 50 then
    raise exception 'TOO_MANY_OPERATIONS';
  end if;


  if p_source not in (
    'whatsapp',
    'panel',
    'api',
    'system'
  ) then
    raise exception 'INVALID_OPERATION_SOURCE';
  end if;


  v_actor_id :=
    nullif(
      btrim(
        coalesce(
          p_actor ->> 'id',
          ''
        )
      ),
      ''
    );


  v_actor_name :=
    nullif(
      btrim(
        coalesce(
          p_actor ->> 'name',
          ''
        )
      ),
      ''
    );


  v_actor_role :=
    nullif(
      btrim(
        coalesce(
          p_actor ->> 'role',
          ''
        )
      ),
      ''
    );


  v_request_hash :=
    md5(
      concat_ws(
        '|',
        p_company_id,
        p_order_id::text,
        coalesce(
          p_expected_version::text,
          ''
        ),
        p_operations::text,
        p_source,
        coalesce(
          p_message_id,
          ''
        )
      )
    );


  -- ----------------------------------------------------------
  -- Idempotencia
  -- ----------------------------------------------------------

  insert into public.commerce_order_operations (
    company_id,
    order_id,
    idempotency_key,
    operation_type,
    status,
    request_hash,
    request_data,
    source,
    message_id,
    actor_id,
    actor_name,
    actor_role
  )
  values (
    p_company_id,
    p_order_id,
    btrim(p_idempotency_key),
    case
      when jsonb_array_length(p_operations) = 1
        then p_operations -> 0 ->> 'type'
      else 'set_quantity'
    end,
    'processing',
    v_request_hash,
    jsonb_build_object(
      'expected_version',
      p_expected_version,
      'operations',
      p_operations
    ),
    p_source,
    p_message_id,
    v_actor_id,
    v_actor_name,
    v_actor_role
  )
  on conflict (
    company_id,
    idempotency_key
  )
  do nothing;


  select *
  into v_operation_row
  from public.commerce_order_operations
  where company_id = p_company_id
    and idempotency_key = btrim(
      p_idempotency_key
    )
  for update;


  if v_operation_row.id is null then
    raise exception 'OPERATION_REGISTER_FAILED';
  end if;


  if
    v_operation_row.request_hash
    <> v_request_hash
  then
    raise exception 'IDEMPOTENCY_CONFLICT';
  end if;


  if
    v_operation_row.status = 'completed'
  then
    return v_operation_row.result_data;
  end if;


  if
    v_operation_row.status = 'failed'
  then
    raise exception
      'PREVIOUS_OPERATION_FAILED: %',
      coalesce(
        v_operation_row.error_message,
        v_operation_row.error_code,
        'Unknown error'
      );
  end if;


  -- ----------------------------------------------------------
  -- Bloqueo principal del pedido
  -- ----------------------------------------------------------

  select *
  into v_order
  from public.commerce_orders
  where id = p_order_id
    and company_id = p_company_id
  for update;


  if v_order.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;


  if
    p_expected_version is not null
    and v_order.version
      <> p_expected_version
  then
    raise exception
      'ORDER_VERSION_CONFLICT: expected %, current %',
      p_expected_version,
      v_order.version;
  end if;


  if
    v_order.commercial_status
    = 'cancelled'
  then
    raise exception 'ORDER_ALREADY_CANCELLED';
  end if;


  if
    v_order.payment_status
    <> 'unpaid'
  then
    raise exception
      'PAID_OR_PARTIAL_ORDER_CANNOT_BE_MODIFIED';
  end if;


  if
    v_order.fulfillment_status
    <> 'pending'
  then
    raise exception
      'ORDER_ALREADY_IN_FULFILLMENT';
  end if;


  -- ----------------------------------------------------------
  -- Reserva activa del pedido
  -- ----------------------------------------------------------

  select *
  into v_reservation
  from public.commerce_reservations
  where company_id = p_company_id
    and order_id = p_order_id
  for update;


  if v_reservation.id is null then
    insert into public.commerce_reservations (
      company_id,
      order_id,
      status,
      expires_at
    )
    values (
      p_company_id,
      p_order_id,
      'active',
      now() + interval '48 hours'
    )
    returning *
    into v_reservation;


    update public.commerce_orders
    set reservation_status = 'active'
    where id = p_order_id
      and company_id = p_company_id;
  end if;


  if
    v_reservation.status
    <> 'active'
  then
    raise exception
      'ORDER_RESERVATION_NOT_ACTIVE';
  end if;


  -- ----------------------------------------------------------
  -- Ejecutar operaciones
  -- ----------------------------------------------------------

  for v_operation
  in
    select value
    from jsonb_array_elements(
      p_operations
    )
  loop
    v_operation_type :=
      nullif(
        btrim(
          coalesce(
            v_operation ->> 'type',
            ''
          )
        ),
        ''
      );


    if v_operation_type not in (
      'add_item',
      'set_quantity',
      'remove_item',
      'replace_variant'
    ) then
      raise exception
        'UNSUPPORTED_OPERATION: %',
        coalesce(
          v_operation_type,
          'null'
        );
    end if;


    -- ========================================================
    -- ADD ITEM
    -- ========================================================

    if v_operation_type = 'add_item' then
      v_variant_id :=
        nullif(
          v_operation ->> 'variant_id',
          ''
        )::uuid;


      v_new_quantity :=
        coalesce(
          nullif(
            v_operation ->> 'quantity',
            ''
          )::integer,
          0
        );


      if v_variant_id is null then
        raise exception
          'VARIANT_ID_REQUIRED';
      end if;


      if v_new_quantity <= 0 then
        raise exception
          'QUANTITY_MUST_BE_POSITIVE';
      end if;


      select *
      into v_variant
      from public.commerce_product_variants
      where id = v_variant_id
        and company_id = p_company_id
        and active = true;


      if v_variant.id is null then
        raise exception
          'VARIANT_NOT_FOUND_OR_INACTIVE';
      end if;


      select *
      into v_product
      from public.commerce_products
      where id = v_variant.product_id
        and company_id = p_company_id
        and active = true;


      if v_product.id is null then
        raise exception
          'PRODUCT_NOT_FOUND_OR_INACTIVE';
      end if;


      select *
      into v_existing_item
      from public.commerce_order_items
      where company_id = p_company_id
        and order_id = p_order_id
        and variant_id = v_variant_id
      order by created_at asc
      limit 1
      for update;


      if v_existing_item.id is not null then
        select *
        into v_reservation_item
        from public.commerce_reservation_items
        where company_id =
          p_company_id
          and reservation_id =
            v_reservation.id
          and order_item_id =
            v_existing_item.id
        for update;


        if v_reservation_item.id is null then
          raise exception
            'RESERVATION_ITEM_NOT_FOUND';
        end if;


        select *
        into v_new_balance
        from public.commerce_stock_balances
        where id =
          v_reservation_item
            .stock_balance_id
          and company_id =
            p_company_id
        for update;


        if v_new_balance.id is null then
          raise exception
            'STOCK_BALANCE_NOT_FOUND';
        end if;


        if
          v_new_balance.available
          < v_new_quantity
        then
          raise exception
            'INSUFFICIENT_STOCK: available %, requested %',
            v_new_balance.available,
            v_new_quantity;
        end if;


        update public.commerce_stock_balances
        set
          reserved =
            reserved
            + v_new_quantity,

          updated_at =
            now()
        where id =
          v_new_balance.id;


        update public.commerce_order_items
        set
          quantity =
            quantity
            + v_new_quantity,

          subtotal =
            final_unit_price
            * (
              quantity
              + v_new_quantity
            )
        where id =
          v_existing_item.id
        returning *
        into v_existing_item;


        update public.commerce_reservation_items
        set quantity =
          quantity
          + v_new_quantity
        where id =
          v_reservation_item.id
          and company_id =
            p_company_id;


        insert into public.commerce_stock_movements (
          company_id,
          warehouse_id,
          variant_id,
          order_id,
          movement_type,
          quantity,
          balance_after,
          reason,
          actor_id,
          metadata
        )
        values (
          p_company_id,
          v_new_balance.warehouse_id,
          v_variant_id,
          p_order_id,
          'reservation',
          v_new_quantity,
          v_new_balance.available
            - v_new_quantity,
          'Incremento de línea en pedido',
          v_actor_id,
          jsonb_build_object(
            'order_item_id',
            v_existing_item.id,
            'source',
            p_source,
            'message_id',
            p_message_id
          )
        );
      else
        select balance.*
        into v_new_balance
        from public.commerce_stock_balances
          as balance
        join public.commerce_warehouses
          as warehouse
          on warehouse.id =
            balance.warehouse_id
          and warehouse.company_id =
            p_company_id
          and warehouse.active = true
        where balance.company_id =
          p_company_id
          and balance.variant_id =
            v_variant_id
          and balance.available >=
            v_new_quantity
        order by
          balance.available desc,
          balance.updated_at asc
        limit 1
        for update of balance;


        if v_new_balance.id is null then
          raise exception
            'INSUFFICIENT_STOCK';
        end if;


        v_unit_price :=
          coalesce(
            v_variant.price_override,
            v_product.default_price,
            0
          );


        v_line_subtotal :=
          v_unit_price
          * v_new_quantity;


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
          picked_quantity,
          packed_quantity,
          unit_price,
          discount_percent,
          final_unit_price,
          subtotal,
          cost_snapshot,
          metadata
        )
        values (
          p_order_id,
          p_company_id,
          v_product.id,
          v_variant.id,
          v_variant.sku,
          v_product.name,
          v_variant.color_name,
          v_variant.size,
          v_new_quantity,
          0,
          0,
          v_unit_price,
          0,
          v_unit_price,
          v_line_subtotal,
          coalesce(
            v_variant.cost_override,
            v_product.cost,
            0
          ),
          jsonb_build_object(
            'added_by_mutation',
            true,
            'source',
            p_source,
            'message_id',
            p_message_id
          )
        )
        returning id
        into v_order_item_id;


        update public.commerce_stock_balances
        set
          reserved =
            reserved
            + v_new_quantity,

          updated_at =
            now()
        where id =
          v_new_balance.id;


        insert into public.commerce_reservation_items (
          company_id,
          reservation_id,
          order_item_id,
          stock_balance_id,
          quantity
        )
        values (
          p_company_id,
          v_reservation.id,
          v_order_item_id,
          v_new_balance.id,
          v_new_quantity
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
          actor_id,
          metadata
        )
        values (
          p_company_id,
          v_new_balance.warehouse_id,
          v_variant_id,
          p_order_id,
          'reservation',
          v_new_quantity,
          v_new_balance.available
            - v_new_quantity,
          'Producto agregado al pedido',
          v_actor_id,
          jsonb_build_object(
            'order_item_id',
            v_order_item_id,
            'source',
            p_source,
            'message_id',
            p_message_id
          )
        );
      end if;


    -- ========================================================
    -- SET QUANTITY / REMOVE ITEM
    -- ========================================================

    elsif v_operation_type in (
      'set_quantity',
      'remove_item'
    ) then
      v_order_item_id :=
        nullif(
          v_operation ->> 'order_item_id',
          ''
        )::uuid;


      if v_order_item_id is null then
        raise exception
          'ORDER_ITEM_ID_REQUIRED';
      end if;


      select *
      into v_order_item
      from public.commerce_order_items
      where id = v_order_item_id
        and company_id = p_company_id
        and order_id = p_order_id
      for update;


      if v_order_item.id is null then
        raise exception
          'ORDER_ITEM_NOT_FOUND';
      end if;


      v_old_quantity :=
        v_order_item.quantity;


      v_new_quantity :=
        case
          when v_operation_type =
            'remove_item'
            then 0
          else coalesce(
            nullif(
              v_operation ->> 'quantity',
              ''
            )::integer,
            -1
          )
        end;


      if v_new_quantity < 0 then
        raise exception
          'QUANTITY_CANNOT_BE_NEGATIVE';
      end if;


      v_delta :=
        v_new_quantity
        - v_old_quantity;


      if v_delta = 0 then
        continue;
      end if;


      select *
      into v_reservation_item
      from public.commerce_reservation_items
      where company_id =
        p_company_id
        and reservation_id =
          v_reservation.id
        and order_item_id =
          v_order_item.id
      for update;


      if v_reservation_item.id is null then
        raise exception
          'RESERVATION_ITEM_NOT_FOUND';
      end if;


      select *
      into v_old_balance
      from public.commerce_stock_balances
      where id =
        v_reservation_item
          .stock_balance_id
        and company_id =
          p_company_id
      for update;


      if v_old_balance.id is null then
        raise exception
          'STOCK_BALANCE_NOT_FOUND';
      end if;


      if
        v_delta > 0
        and v_old_balance.available
          < v_delta
      then
        raise exception
          'INSUFFICIENT_STOCK: available %, requested %',
          v_old_balance.available,
          v_delta;
      end if;


      if
        v_delta < 0
        and v_old_balance.reserved
          < abs(v_delta)
      then
        raise exception
          'RESERVED_STOCK_INCONSISTENT';
      end if;


      update public.commerce_stock_balances
      set
        reserved =
          reserved
          + v_delta,

        updated_at =
          now()
      where id =
        v_old_balance.id;


      if v_new_quantity = 0 then
        delete from public.commerce_reservation_items
        where id =
          v_reservation_item.id
          and company_id =
            p_company_id;


        delete from public.commerce_order_items
        where id =
          v_order_item.id;
      else
        update public.commerce_reservation_items
        set quantity =
          v_new_quantity
        where id =
          v_reservation_item.id
          and company_id =
            p_company_id;


        update public.commerce_order_items
        set
          quantity =
            v_new_quantity,

          subtotal =
            final_unit_price
            * v_new_quantity
        where id =
          v_order_item.id;
      end if;


      insert into public.commerce_stock_movements (
        company_id,
        warehouse_id,
        variant_id,
        order_id,
        movement_type,
        quantity,
        balance_after,
        reason,
        actor_id,
        metadata
      )
      values (
        p_company_id,
        v_old_balance.warehouse_id,
        v_order_item.variant_id,
        p_order_id,
        case
          when v_delta > 0
            then 'reservation'
          else 'reservation_release'
        end,
        abs(v_delta),
        v_old_balance.available
          - v_delta,
        case
          when v_new_quantity = 0
            then 'Producto eliminado del pedido'
          else 'Cantidad modificada en pedido'
        end,
        v_actor_id,
        jsonb_build_object(
          'order_item_id',
          v_order_item.id,
          'old_quantity',
          v_old_quantity,
          'new_quantity',
          v_new_quantity,
          'source',
          p_source,
          'message_id',
          p_message_id
        )
      );


    -- ========================================================
    -- REPLACE VARIANT
    -- ========================================================

    elsif v_operation_type =
      'replace_variant'
    then
      v_order_item_id :=
        nullif(
          v_operation ->> 'order_item_id',
          ''
        )::uuid;


      v_new_variant_id :=
        nullif(
          v_operation ->> 'new_variant_id',
          ''
        )::uuid;


      if
        v_order_item_id is null
        or v_new_variant_id is null
      then
        raise exception
          'ORDER_ITEM_AND_NEW_VARIANT_REQUIRED';
      end if;


      select *
      into v_order_item
      from public.commerce_order_items
      where id = v_order_item_id
        and company_id = p_company_id
        and order_id = p_order_id
      for update;


      if v_order_item.id is null then
        raise exception
          'ORDER_ITEM_NOT_FOUND';
      end if;


      if
        v_order_item.variant_id
        = v_new_variant_id
      then
        raise exception
          'NEW_VARIANT_EQUALS_CURRENT_VARIANT';
      end if;


      select *
      into v_variant
      from public.commerce_product_variants
      where id = v_new_variant_id
        and company_id = p_company_id
        and active = true;


      if v_variant.id is null then
        raise exception
          'NEW_VARIANT_NOT_FOUND_OR_INACTIVE';
      end if;


      select *
      into v_product
      from public.commerce_products
      where id = v_variant.product_id
        and company_id = p_company_id
        and active = true;


      if v_product.id is null then
        raise exception
          'NEW_PRODUCT_NOT_FOUND_OR_INACTIVE';
      end if;


      v_new_quantity :=
        coalesce(
          nullif(
            v_operation ->> 'quantity',
            ''
          )::integer,
          v_order_item.quantity
        );


      if v_new_quantity <= 0 then
        raise exception
          'QUANTITY_MUST_BE_POSITIVE';
      end if;


      select *
      into v_reservation_item
      from public.commerce_reservation_items
      where company_id =
        p_company_id
        and reservation_id =
          v_reservation.id
        and order_item_id =
          v_order_item.id
      for update;


      if v_reservation_item.id is null then
        raise exception
          'RESERVATION_ITEM_NOT_FOUND';
      end if;


      select *
      into v_old_balance
      from public.commerce_stock_balances
      where id =
        v_reservation_item
          .stock_balance_id
        and company_id =
          p_company_id
      for update;


      select balance.*
      into v_new_balance
      from public.commerce_stock_balances
        as balance
      join public.commerce_warehouses
        as warehouse
        on warehouse.id =
          balance.warehouse_id
        and warehouse.company_id =
          p_company_id
        and warehouse.active = true
      where balance.company_id =
        p_company_id
        and balance.variant_id =
          v_new_variant_id
        and balance.available >=
          v_new_quantity
      order by
        balance.available desc,
        balance.updated_at asc
      limit 1
      for update of balance;


      if v_new_balance.id is null then
        raise exception
          'INSUFFICIENT_STOCK_FOR_REPLACEMENT';
      end if;


      if
        v_old_balance.reserved
        < v_order_item.quantity
      then
        raise exception
          'OLD_RESERVED_STOCK_INCONSISTENT';
      end if;


      update public.commerce_stock_balances
      set
        reserved =
          reserved
          - v_order_item.quantity,

        updated_at =
          now()
      where id =
        v_old_balance.id;


      update public.commerce_stock_balances
      set
        reserved =
          reserved
          + v_new_quantity,

        updated_at =
          now()
      where id =
        v_new_balance.id;


      v_unit_price :=
        coalesce(
          v_variant.price_override,
          v_product.default_price,
          0
        );


      update public.commerce_order_items
      set
        product_id =
          v_product.id,

        variant_id =
          v_variant.id,

        sku_snapshot =
          v_variant.sku,

        product_name_snapshot =
          v_product.name,

        color_name_snapshot =
          v_variant.color_name,

        size_snapshot =
          v_variant.size,

        quantity =
          v_new_quantity,

        picked_quantity =
          0,

        packed_quantity =
          0,

        unit_price =
          v_unit_price,

        discount_percent =
          0,

        final_unit_price =
          v_unit_price,

        subtotal =
          v_unit_price
          * v_new_quantity,

        cost_snapshot =
          coalesce(
            v_variant.cost_override,
            v_product.cost,
            0
          ),

        metadata =
          coalesce(
            metadata,
            '{}'::jsonb
          )
          || jsonb_build_object(
            'replaced_at',
            now(),
            'replaced_from_variant_id',
            v_order_item.variant_id,
            'source',
            p_source,
            'message_id',
            p_message_id
          )
      where id =
        v_order_item.id;


      update public.commerce_reservation_items
      set
        stock_balance_id =
          v_new_balance.id,

        quantity =
          v_new_quantity
      where id =
        v_reservation_item.id
        and company_id =
          p_company_id;


      insert into public.commerce_stock_movements (
        company_id,
        warehouse_id,
        variant_id,
        order_id,
        movement_type,
        quantity,
        balance_after,
        reason,
        actor_id,
        metadata
      )
      values
      (
        p_company_id,
        v_old_balance.warehouse_id,
        v_order_item.variant_id,
        p_order_id,
        'reservation_release',
        v_order_item.quantity,
        v_old_balance.available
          + v_order_item.quantity,
        'Variante reemplazada',
        v_actor_id,
        jsonb_build_object(
          'order_item_id',
          v_order_item.id,
          'new_variant_id',
          v_new_variant_id
        )
      ),
      (
        p_company_id,
        v_new_balance.warehouse_id,
        v_new_variant_id,
        p_order_id,
        'reservation',
        v_new_quantity,
        v_new_balance.available
          - v_new_quantity,
        'Nueva variante reservada',
        v_actor_id,
        jsonb_build_object(
          'order_item_id',
          v_order_item.id,
          'old_variant_id',
          v_order_item.variant_id
        )
      );
    end if;
  end loop;


  -- ----------------------------------------------------------
  -- Pedido no puede quedar vacío
  -- ----------------------------------------------------------

  if not exists (
    select 1
    from public.commerce_order_items
    where company_id = p_company_id
      and order_id = p_order_id
  ) then
    raise exception
      'ORDER_CANNOT_BE_EMPTY';
  end if;


  -- ----------------------------------------------------------
  -- Recalcular totales
  -- ----------------------------------------------------------

  select
    coalesce(
      sum(subtotal),
      0
    )
  into v_subtotal
  from public.commerce_order_items
  where company_id = p_company_id
    and order_id = p_order_id;


  v_total :=
    greatest(
      v_subtotal
      - v_order.discount
      + v_order.shipping_cost,
      0
    );


  update public.commerce_orders
  set
    subtotal =
      v_subtotal,

    total =
      v_total,

    reservation_status =
      'active',

    version =
      version
      + 1,

    updated_by =
      coalesce(
        v_actor_id,
        updated_by
      ),

    updated_at =
      now()
  where id = p_order_id
    and company_id = p_company_id
  returning *
  into v_order;


  -- ----------------------------------------------------------
  -- Evento
  -- ----------------------------------------------------------

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
    p_order_id,
    'order_mutated',
    'Pedido modificado',
    'Se modificaron productos o cantidades del pedido.',
    v_actor_id,
    v_actor_name,
    v_actor_role,
    jsonb_build_object(
      'operations',
      p_operations,
      'source',
      p_source,
      'message_id',
      p_message_id,
      'version',
      v_order.version
    )
  );


  -- ----------------------------------------------------------
  -- Auditoría
  -- ----------------------------------------------------------

  insert into public.commerce_audit_events (
    company_id,
    entity_type,
    entity_id,
    action,
    actor_id,
    actor_name,
    actor_role,
    before_data,
    after_data,
    metadata
  )
  values (
    p_company_id,
    'commerce_order',
    p_order_id::text,
    'mutate',
    v_actor_id,
    v_actor_name,
    v_actor_role,
    jsonb_build_object(
      'version',
      v_order.version - 1
    ),
    jsonb_build_object(
      'version',
      v_order.version,
      'subtotal',
      v_order.subtotal,
      'total',
      v_order.total
    ),
    jsonb_build_object(
      'operations',
      p_operations,
      'source',
      p_source,
      'message_id',
      p_message_id,
      'idempotency_key',
      p_idempotency_key
    )
  );


  -- ----------------------------------------------------------
  -- Resultado completo
  -- ----------------------------------------------------------

  select jsonb_build_object(
    'order',
    to_jsonb(v_order),

    'items',
    coalesce(
      (
        select jsonb_agg(
          to_jsonb(item)
          order by item.created_at asc
        )
        from public.commerce_order_items
          as item
        where item.company_id =
          p_company_id
          and item.order_id =
            p_order_id
      ),
      '[]'::jsonb
    ),

    'reservation',
    to_jsonb(v_reservation)
  )
  into v_result;


  update public.commerce_order_operations
  set
    status =
      'completed',

    result_data =
      v_result,

    completed_at =
      now(),

    updated_at =
      now()
  where id =
    v_operation_row.id;


  return v_result;


exception
  when others then
    update public.commerce_order_operations
    set
      status =
        'failed',

      error_code =
        sqlstate,

      error_message =
        left(
          sqlerrm,
          2000
        ),

      failed_at =
        now(),

      updated_at =
        now()
    where
      company_id =
        p_company_id
      and idempotency_key =
        btrim(
          p_idempotency_key
        );

    raise;
end;
$$;



-- ============================================================
-- 3. PERMISOS
-- ============================================================

revoke all
on function public.commerce_mutate_order(
  text,
  uuid,
  integer,
  text,
  jsonb,
  text,
  text,
  jsonb
)
from public, anon, authenticated;


grant execute
on function public.commerce_mutate_order(
  text,
  uuid,
  integer,
  text,
  jsonb,
  text,
  text,
  jsonb
)
to service_role;



-- ============================================================
-- 4. ÍNDICES PARA CONSULTA RÁPIDA
-- ============================================================

create index if not exists
  commerce_orders_customer_history_idx
on public.commerce_orders (
  company_id,
  customer_id,
  created_at desc
);


create index if not exists
  commerce_orders_active_customer_idx
on public.commerce_orders (
  company_id,
  customer_id,
  payment_status,
  commercial_status,
  fulfillment_status,
  created_at desc
)
where
  commercial_status <> 'cancelled'
  and payment_status in (
    'unpaid',
    'partial'
  );


create index if not exists
  commerce_order_items_company_order_created_idx
on public.commerce_order_items (
  company_id,
  order_id,
  created_at
);


create index if not exists
  commerce_reservations_company_order_idx
on public.commerce_reservations (
  company_id,
  order_id,
  created_at desc
);


create index if not exists
  commerce_reservation_items_reservation_balance_idx
on public.commerce_reservation_items (
  reservation_id,
  stock_balance_id
);


comment on function public.commerce_mutate_order(
  text,
  uuid,
  integer,
  text,
  jsonb,
  text,
  text,
  jsonb
)
is
  'Modifica líneas de pedidos pendientes en una sola transacción, con bloqueo, idempotencia, stock, auditoría y control de versión.';
