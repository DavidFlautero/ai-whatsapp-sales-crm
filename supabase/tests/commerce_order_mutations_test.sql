\set ON_ERROR_STOP on
\timing on

begin;

do $test$
declare
  v_company_id text :=
    'test-order-mutations';

  v_customer_id uuid;
  v_warehouse_id uuid;
  v_product_id uuid;

  v_variant_38 uuid;
  v_variant_40 uuid;
  v_variant_42 uuid;

  v_balance_38 uuid;
  v_balance_40 uuid;
  v_balance_42 uuid;

  v_order_id uuid;
  v_order_number text;

  v_item_38 uuid;
  v_item_40 uuid;

  v_version integer;
  v_initial_total numeric(16, 2);
  v_result jsonb;

  v_reserved_38 integer;
  v_reserved_40 integer;
  v_reserved_42 integer;

  v_quantity integer;
  v_total numeric(16, 2);

  v_operation_count integer;

  v_error_detected boolean;
begin
  raise notice
    '============================================';

  raise notice
    'INICIANDO PRUEBAS DE MUTACIONES DE PEDIDOS';

  raise notice
    '============================================';


  -- ==========================================================
  -- EMPRESA DE PRUEBA
  -- ==========================================================

  insert into public.commerce_companies (
    id,
    name,
    active
  )
  values (
    v_company_id,
    'Mutation Test Company',
    true
  )
  on conflict (id)
  do update set
    name =
      excluded.name,

    active =
      true;


  insert into public.commerce_business_settings (
    company_id
  )
  values (
    v_company_id
  )
  on conflict (company_id)
  do nothing;


  -- ==========================================================
  -- CLIENTE
  -- ==========================================================

  insert into public.commerce_customers (
    company_id,
    name,
    business_name,
    whatsapp
  )
  values (
    v_company_id,
    'Cliente de prueba',
    'Pruebas transaccionales',
    '34999999999'
  )
  returning id
  into v_customer_id;


  -- ==========================================================
  -- BODEGA
  -- ==========================================================

  insert into public.commerce_warehouses (
    company_id,
    code,
    name,
    active
  )
  values (
    v_company_id,
    'TEST',
    'Bodega de pruebas',
    true
  )
  returning id
  into v_warehouse_id;


  -- ==========================================================
  -- PRODUCTO
  -- ==========================================================

  insert into public.commerce_products (
    company_id,
    base_sku,
    name,
    category,
    currency,
    cost,
    default_price,
    active
  )
  values (
    v_company_id,
    'JEAN-TEST',
    'Jean transaccional',
    'Pantalones',
    'ARS',
    15000,
    25000,
    true
  )
  returning id
  into v_product_id;


  -- ==========================================================
  -- VARIANTES
  -- ==========================================================

  insert into public.commerce_product_variants (
    company_id,
    product_id,
    sku,
    color_name,
    size,
    active
  )
  values (
    v_company_id,
    v_product_id,
    'JEAN-TEST-NEGRO-38',
    'Negro',
    '38',
    true
  )
  returning id
  into v_variant_38;


  insert into public.commerce_product_variants (
    company_id,
    product_id,
    sku,
    color_name,
    size,
    active
  )
  values (
    v_company_id,
    v_product_id,
    'JEAN-TEST-NEGRO-40',
    'Negro',
    '40',
    true
  )
  returning id
  into v_variant_40;


  insert into public.commerce_product_variants (
    company_id,
    product_id,
    sku,
    color_name,
    size,
    active
  )
  values (
    v_company_id,
    v_product_id,
    'JEAN-TEST-NEGRO-42',
    'Negro',
    '42',
    true
  )
  returning id
  into v_variant_42;


  -- ==========================================================
  -- STOCK
  -- ==========================================================

  insert into public.commerce_stock_balances (
    company_id,
    warehouse_id,
    variant_id,
    on_hand,
    reserved,
    committed,
    reorder_point
  )
  values (
    v_company_id,
    v_warehouse_id,
    v_variant_38,
    100,
    0,
    0,
    10
  )
  returning id
  into v_balance_38;


  insert into public.commerce_stock_balances (
    company_id,
    warehouse_id,
    variant_id,
    on_hand,
    reserved,
    committed,
    reorder_point
  )
  values (
    v_company_id,
    v_warehouse_id,
    v_variant_40,
    80,
    0,
    0,
    10
  )
  returning id
  into v_balance_40;


  insert into public.commerce_stock_balances (
    company_id,
    warehouse_id,
    variant_id,
    on_hand,
    reserved,
    committed,
    reorder_point
  )
  values (
    v_company_id,
    v_warehouse_id,
    v_variant_42,
    2,
    0,
    0,
    2
  )
  returning id
  into v_balance_42;


  -- ==========================================================
  -- PEDIDO INICIAL MANUALMENTE CONTROLADO
  -- ==========================================================

  v_order_number :=
    'TEST-'
    || replace(
      gen_random_uuid()::text,
      '-',
      ''
    );


  insert into public.commerce_orders (
    company_id,
    number,
    source,
    customer_id,
    commercial_status,
    payment_status,
    fulfillment_status,
    reservation_status,
    currency,
    subtotal,
    discount,
    shipping_cost,
    total,
    paid_amount,
    created_by,
    updated_by,
    version
  )
  values (
    v_company_id,
    v_order_number,
    'api',
    v_customer_id,
    'received',
    'unpaid',
    'pending',
    'active',
    'ARS',
    125000,
    0,
    0,
    125000,
    0,
    'test-suite',
    'test-suite',
    1
  )
  returning
    id,
    version,
    total
  into
    v_order_id,
    v_version,
    v_initial_total;


  -- Línea inicial: cinco unidades talle 38.

  insert into public.commerce_order_items (
    company_id,
    order_id,
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
    v_company_id,
    v_order_id,
    v_product_id,
    v_variant_38,
    'JEAN-TEST-NEGRO-38',
    'Jean transaccional',
    'Negro',
    '38',
    5,
    25000,
    0,
    25000,
    125000,
    15000
  )
  returning id
  into v_item_38;


  update public.commerce_stock_balances
  set reserved =
    reserved + 5
  where id =
    v_balance_38;


  insert into public.commerce_reservations (
    company_id,
    order_id,
    status,
    expires_at
  )
  values (
    v_company_id,
    v_order_id,
    'active',
    now() + interval '48 hours'
  );


  insert into public.commerce_reservation_items (
    company_id,
    reservation_id,
    order_item_id,
    stock_balance_id,
    quantity
  )
  select
    v_company_id,
    reservation.id,
    v_item_38,
    v_balance_38,
    5
  from public.commerce_reservations
    as reservation
  where reservation.company_id =
    v_company_id
    and reservation.order_id =
      v_order_id;


  raise notice
    'Pedido de prueba: %',
    v_order_number;


  -- ==========================================================
  -- TEST 1: AGREGAR VARIANTE NUEVA
  -- ==========================================================

  v_result :=
    public.commerce_mutate_order(
      v_company_id,
      v_order_id,
      1,
      'test:add-item:message-001',
      jsonb_build_array(
        jsonb_build_object(
          'type',
          'add_item',

          'variant_id',
          v_variant_40,

          'quantity',
          3
        )
      ),
      'whatsapp',
      'message-001',
      jsonb_build_object(
        'id',
        'test-agent',

        'name',
        'Test Agent',

        'role',
        'system'
      )
    );


  select
    id,
    quantity
  into
    v_item_40,
    v_quantity
  from public.commerce_order_items
  where company_id =
    v_company_id
    and order_id =
      v_order_id
    and variant_id =
      v_variant_40;


  if
    v_item_40 is null
    or v_quantity <> 3
  then
    raise exception
      'TEST 1 FALLÓ: la variante 40 no quedó con cantidad 3';
  end if;


  select reserved
  into v_reserved_40
  from public.commerce_stock_balances
  where id =
    v_balance_40;


  if v_reserved_40 <> 3 then
    raise exception
      'TEST 1 FALLÓ: reserved talle 40 esperado 3, actual %',
      v_reserved_40;
  end if;


  select
    version,
    total
  into
    v_version,
    v_total
  from public.commerce_orders
  where id =
    v_order_id;


  if v_version <> 2 then
    raise exception
      'TEST 1 FALLÓ: versión esperada 2, actual %',
      v_version;
  end if;


  if v_total <> 200000 then
    raise exception
      'TEST 1 FALLÓ: total esperado 200000, actual %',
      v_total;
  end if;


  raise notice
    'TEST 1 OK — variante agregada, stock reservado y total recalculado';


  -- ==========================================================
  -- TEST 2: IDEMPOTENCIA
  -- Ejecutar exactamente el mismo mensaje no debe sumar otra vez.
  -- ==========================================================

  v_result :=
    public.commerce_mutate_order(
      v_company_id,
      v_order_id,
      1,
      'test:add-item:message-001',
      jsonb_build_array(
        jsonb_build_object(
          'type',
          'add_item',

          'variant_id',
          v_variant_40,

          'quantity',
          3
        )
      ),
      'whatsapp',
      'message-001',
      jsonb_build_object(
        'id',
        'test-agent',

        'name',
        'Test Agent',

        'role',
        'system'
      )
    );


  select quantity
  into v_quantity
  from public.commerce_order_items
  where id =
    v_item_40;


  if v_quantity <> 3 then
    raise exception
      'TEST 2 FALLÓ: webhook repetido duplicó cantidad; actual %',
      v_quantity;
  end if;


  select version
  into v_version
  from public.commerce_orders
  where id =
    v_order_id;


  if v_version <> 2 then
    raise exception
      'TEST 2 FALLÓ: webhook repetido incrementó versión; actual %',
      v_version;
  end if;


  raise notice
    'TEST 2 OK — webhook repetido devolvió resultado anterior';


  -- ==========================================================
  -- TEST 3: CONFLICTO DE IDEMPOTENCIA
  -- Misma clave con otros parámetros debe fallar.
  -- ==========================================================

  v_error_detected :=
    false;


  begin
    perform public.commerce_mutate_order(
      v_company_id,
      v_order_id,
      2,
      'test:add-item:message-001',
      jsonb_build_array(
        jsonb_build_object(
          'type',
          'add_item',

          'variant_id',
          v_variant_40,

          'quantity',
          7
        )
      ),
      'whatsapp',
      'message-001',
      '{}'::jsonb
    );
  exception
    when others then
      if position(
        'IDEMPOTENCY_CONFLICT'
        in sqlerrm
      ) > 0 then
        v_error_detected :=
          true;
      else
        raise;
      end if;
  end;


  if not v_error_detected then
    raise exception
      'TEST 3 FALLÓ: no detectó reutilización incorrecta de clave';
  end if;


  raise notice
    'TEST 3 OK — conflicto de idempotencia detectado';


  -- ==========================================================
  -- TEST 4: AUMENTAR LÍNEA EXISTENTE
  -- ==========================================================

  perform public.commerce_mutate_order(
    v_company_id,
    v_order_id,
    2,
    'test:set-quantity:message-002',
    jsonb_build_array(
      jsonb_build_object(
        'type',
        'set_quantity',

        'order_item_id',
        v_item_38,

        'quantity',
        8
      )
    ),
    'whatsapp',
    'message-002',
    '{}'::jsonb
  );


  select quantity
  into v_quantity
  from public.commerce_order_items
  where id =
    v_item_38;


  if v_quantity <> 8 then
    raise exception
      'TEST 4 FALLÓ: cantidad esperada 8, actual %',
      v_quantity;
  end if;


  select reserved
  into v_reserved_38
  from public.commerce_stock_balances
  where id =
    v_balance_38;


  if v_reserved_38 <> 8 then
    raise exception
      'TEST 4 FALLÓ: stock reservado esperado 8, actual %',
      v_reserved_38;
  end if;


  raise notice
    'TEST 4 OK — aumento de cantidad consistente';


  -- ==========================================================
  -- TEST 5: REDUCIR CANTIDAD
  -- ==========================================================

  perform public.commerce_mutate_order(
    v_company_id,
    v_order_id,
    3,
    'test:set-quantity:message-003',
    jsonb_build_array(
      jsonb_build_object(
        'type',
        'set_quantity',

        'order_item_id',
        v_item_38,

        'quantity',
        4
      )
    ),
    'whatsapp',
    'message-003',
    '{}'::jsonb
  );


  select
    item.quantity,
    balance.reserved
  into
    v_quantity,
    v_reserved_38
  from public.commerce_order_items
    as item
  join public.commerce_reservation_items
    as reservation_item
    on reservation_item.order_item_id =
      item.id
    and reservation_item.company_id =
      item.company_id
  join public.commerce_stock_balances
    as balance
    on balance.id =
      reservation_item.stock_balance_id
    and balance.company_id =
      item.company_id
  where item.id =
    v_item_38
    and item.company_id =
      v_company_id;


  if
    v_quantity <> 4
    or v_reserved_38 <> 4
  then
    raise exception
      'TEST 5 FALLÓ: cantidad %, reservado %',
      v_quantity,
      v_reserved_38;
  end if;


  raise notice
    'TEST 5 OK — reducción liberó stock correctamente';


  -- ==========================================================
  -- TEST 6: REEMPLAZAR VARIANTE
  -- Cambiar línea talle 40 por talle 42, cantidad 2.
  -- ==========================================================

  perform public.commerce_mutate_order(
    v_company_id,
    v_order_id,
    4,
    'test:replace:message-004',
    jsonb_build_array(
      jsonb_build_object(
        'type',
        'replace_variant',

        'order_item_id',
        v_item_40,

        'new_variant_id',
        v_variant_42,

        'quantity',
        2
      )
    ),
    'whatsapp',
    'message-004',
    '{}'::jsonb
  );


  select
    item.quantity,
    balance.reserved
  into
    v_quantity,
    v_reserved_42
  from public.commerce_order_items
    as item
  join public.commerce_reservation_items
    as reservation_item
    on reservation_item.order_item_id =
      item.id
    and reservation_item.company_id =
      item.company_id
  join public.commerce_stock_balances
    as balance
    on balance.id =
      reservation_item.stock_balance_id
  where item.id =
    v_item_40
    and item.variant_id =
      v_variant_42;


  if
    v_quantity <> 2
    or v_reserved_42 <> 2
  then
    raise exception
      'TEST 6 FALLÓ: reemplazo cantidad %, reservado nuevo %',
      v_quantity,
      v_reserved_42;
  end if;


  select reserved
  into v_reserved_40
  from public.commerce_stock_balances
  where id =
    v_balance_40;


  if v_reserved_40 <> 0 then
    raise exception
      'TEST 6 FALLÓ: la variante anterior conserva reserva %',
      v_reserved_40;
  end if;


  raise notice
    'TEST 6 OK — reemplazo liberó variante anterior y reservó nueva';


  -- ==========================================================
  -- TEST 7: STOCK INSUFICIENTE
  -- Talle 42 sólo tiene dos y ya están reservados.
  -- ==========================================================

  v_error_detected :=
    false;


  begin
    perform public.commerce_mutate_order(
      v_company_id,
      v_order_id,
      5,
      'test:insufficient:message-005',
      jsonb_build_array(
        jsonb_build_object(
          'type',
          'add_item',

          'variant_id',
          v_variant_42,

          'quantity',
          1
        )
      ),
      'whatsapp',
      'message-005',
      '{}'::jsonb
    );
  exception
    when others then
      if position(
        'INSUFFICIENT_STOCK'
        in sqlerrm
      ) > 0 then
        v_error_detected :=
          true;
      else
        raise;
      end if;
  end;


  if not v_error_detected then
    raise exception
      'TEST 7 FALLÓ: permitió reservar stock inexistente';
  end if;


  raise notice
    'TEST 7 OK — stock insuficiente rechazado';


  -- ==========================================================
  -- TEST 8: CONFLICTO DE VERSIÓN
  -- ==========================================================

  v_error_detected :=
    false;


  begin
    perform public.commerce_mutate_order(
      v_company_id,
      v_order_id,
      1,
      'test:version:message-006',
      jsonb_build_array(
        jsonb_build_object(
          'type',
          'set_quantity',

          'order_item_id',
          v_item_38,

          'quantity',
          5
        )
      ),
      'panel',
      'message-006',
      '{}'::jsonb
    );
  exception
    when others then
      if position(
        'ORDER_VERSION_CONFLICT'
        in sqlerrm
      ) > 0 then
        v_error_detected :=
          true;
      else
        raise;
      end if;
  end;


  if not v_error_detected then
    raise exception
      'TEST 8 FALLÓ: no detectó versión desactualizada';
  end if;


  raise notice
    'TEST 8 OK — conflicto optimista detectado';


  -- ==========================================================
  -- TEST 9: ELIMINAR LÍNEA
  -- ==========================================================

  perform public.commerce_mutate_order(
    v_company_id,
    v_order_id,
    5,
    'test:remove:message-007',
    jsonb_build_array(
      jsonb_build_object(
        'type',
        'remove_item',

        'order_item_id',
        v_item_40
      )
    ),
    'whatsapp',
    'message-007',
    '{}'::jsonb
  );


  if exists (
    select 1
    from public.commerce_order_items
    where id =
      v_item_40
  ) then
    raise exception
      'TEST 9 FALLÓ: la línea eliminada todavía existe';
  end if;


  select reserved
  into v_reserved_42
  from public.commerce_stock_balances
  where id =
    v_balance_42;


  if v_reserved_42 <> 0 then
    raise exception
      'TEST 9 FALLÓ: el stock reemplazado no fue liberado';
  end if;


  raise notice
    'TEST 9 OK — línea eliminada y stock liberado';


  -- ==========================================================
  -- TEST 10: IMPEDIR PEDIDO VACÍO
  -- ==========================================================

  v_error_detected :=
    false;


  begin
    perform public.commerce_mutate_order(
      v_company_id,
      v_order_id,
      6,
      'test:empty:message-008',
      jsonb_build_array(
        jsonb_build_object(
          'type',
          'remove_item',

          'order_item_id',
          v_item_38
        )
      ),
      'whatsapp',
      'message-008',
      '{}'::jsonb
    );
  exception
    when others then
      if position(
        'ORDER_CANNOT_BE_EMPTY'
        in sqlerrm
      ) > 0 then
        v_error_detected :=
          true;
      else
        raise;
      end if;
  end;


  if not v_error_detected then
    raise exception
      'TEST 10 FALLÓ: permitió dejar el pedido vacío';
  end if;


  if not exists (
    select 1
    from public.commerce_order_items
    where id =
      v_item_38
      and quantity = 4
  ) then
    raise exception
      'TEST 10 FALLÓ: el rollback interno no restauró la línea';
  end if;


  raise notice
    'TEST 10 OK — pedido vacío rechazado sin cambios parciales';


  -- ==========================================================
  -- TEST 11: PEDIDO PAGADO NO MODIFICABLE
  -- ==========================================================

  update public.commerce_orders
  set
    payment_status =
      'paid',

    paid_amount =
      total
  where id =
    v_order_id;


  select version
  into v_version
  from public.commerce_orders
  where id =
    v_order_id;


  v_error_detected :=
    false;


  begin
    perform public.commerce_mutate_order(
      v_company_id,
      v_order_id,
      v_version,
      'test:paid:message-009',
      jsonb_build_array(
        jsonb_build_object(
          'type',
          'set_quantity',

          'order_item_id',
          v_item_38,

          'quantity',
          5
        )
      ),
      'panel',
      'message-009',
      '{}'::jsonb
    );
  exception
    when others then
      if position(
        'PAID_OR_PARTIAL_ORDER_CANNOT_BE_MODIFIED'
        in sqlerrm
      ) > 0 then
        v_error_detected :=
          true;
      else
        raise;
      end if;
  end;


  if not v_error_detected then
    raise exception
      'TEST 11 FALLÓ: permitió modificar pedido pagado';
  end if;


  raise notice
    'TEST 11 OK — pedido pagado protegido';


  -- ==========================================================
  -- TEST 12: PEDIDO CANCELADO NO MODIFICABLE
  -- ==========================================================

  update public.commerce_orders
  set
    payment_status =
      'unpaid',

    paid_amount =
      0,

    commercial_status =
      'cancelled'
  where id =
    v_order_id;


  v_error_detected :=
    false;


  begin
    perform public.commerce_mutate_order(
      v_company_id,
      v_order_id,
      v_version,
      'test:cancelled:message-010',
      jsonb_build_array(
        jsonb_build_object(
          'type',
          'set_quantity',

          'order_item_id',
          v_item_38,

          'quantity',
          5
        )
      ),
      'panel',
      'message-010',
      '{}'::jsonb
    );
  exception
    when others then
      if position(
        'ORDER_ALREADY_CANCELLED'
        in sqlerrm
      ) > 0 then
        v_error_detected :=
          true;
      else
        raise;
      end if;
  end;


  if not v_error_detected then
    raise exception
      'TEST 12 FALLÓ: permitió modificar pedido cancelado';
  end if;


  raise notice
    'TEST 12 OK — pedido cancelado protegido';


  -- ==========================================================
  -- AUDITORÍA Y EVENTOS
  -- ==========================================================

  select count(*)
  into v_operation_count
  from public.commerce_order_events
  where company_id =
    v_company_id
    and order_id =
      v_order_id
    and event_type =
      'order_mutated';


  if v_operation_count < 5 then
    raise exception
      'AUDITORÍA FALLÓ: eventos esperados >= 5, actuales %',
      v_operation_count;
  end if;


  if not exists (
    select 1
    from public.commerce_audit_events
    where company_id =
      v_company_id
      and entity_type =
        'commerce_order'
      and entity_id =
        v_order_id::text
      and action =
        'mutate'
  ) then
    raise exception
      'AUDITORÍA FALLÓ: no existen eventos de auditoría';
  end if;


  raise notice
    'AUDITORÍA OK — eventos y trazabilidad presentes';


  raise notice
    '============================================';

  raise notice
    'TODAS LAS PRUEBAS TRANSACCIONALES PASARON';

  raise notice
    'La transacción será revertida; no queda información de prueba.';

  raise notice
    '============================================';
end;
$test$;

rollback;
