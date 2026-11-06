-- Run ONLY against an isolated ephemeral PostgreSQL database.
BEGIN;
DO $$
DECLARE
 v_order jsonb; v_retry jsonb; v_delivery jsonb;
 v_zone uuid; v_courier uuid; v_version integer;
BEGIN
 SELECT id INTO v_zone FROM public.restaurant_ops_zones
 WHERE company_id='delibocados' AND name='200M';
 IF v_zone IS NULL THEN RAISE EXCEPTION 'SMOKE_ZONE_MISSING'; END IF;
 UPDATE public.restaurant_ops_zones SET active=true
 WHERE id=v_zone AND company_id='delibocados';

 v_order:=public.restaurant_ops_create_order(
   p_company_id=>'delibocados',
   p_source=>'whatsapp',p_source_key=>'whatsapp-pickup-smoke-123',
   p_customer_phone=>'573001234567',p_customer_name=>'Cliente de Prueba',
   p_fulfillment_mode=>'pickup',
   p_items=>'[{"productId":"burger","quantity":2},{"productId":"soda","quantity":1}]'::jsonb,
   p_customer_confirmed=>true,p_expected_menu_revision=>1,
   p_payment_method=>'cash',p_payment_status=>'cash_on_delivery'
 );
 IF (v_order->>'total_cop')::int<>41000
   OR v_order->>'fulfillment_mode'<>'pickup' THEN
   RAISE EXCEPTION 'PICKUP_TOTAL_OR_MODE_FAILED'; END IF;

 v_retry:=public.restaurant_ops_create_order(
   p_company_id=>'delibocados',
   p_source=>'whatsapp',p_source_key=>'whatsapp-pickup-smoke-123',
   p_customer_phone=>'573001234567',p_customer_name=>'Cliente de Prueba',
   p_fulfillment_mode=>'pickup',
   p_items=>'[{"productId":"burger","quantity":2},{"productId":"soda","quantity":1}]'::jsonb,
   p_customer_confirmed=>true,p_expected_menu_revision=>1,
   p_payment_method=>'cash',p_payment_status=>'cash_on_delivery'
 );
 IF v_order->>'id'<>v_retry->>'id' THEN RAISE EXCEPTION 'IDEMPOTENCY_FAILED'; END IF;
 IF (SELECT count(*) FROM public.restaurant_ops_kitchen_tickets
   WHERE company_id='delibocados' AND order_id=(v_order->>'id')::uuid)<>1
 THEN RAISE EXCEPTION 'DUPLICATE_KITCHEN_TICKET'; END IF;
 IF (SELECT count(*) FROM public.restaurant_ops_order_items
   WHERE company_id='delibocados' AND order_id=(v_order->>'id')::uuid)<>2
 THEN RAISE EXCEPTION 'PICKUP_ITEMS_NOT_STORED'; END IF;
 v_order:=public.restaurant_ops_transition_order('delibocados',(v_order->>'id')::uuid,1,'preparing','qa','owner');
 v_order:=public.restaurant_ops_transition_order('delibocados',(v_order->>'id')::uuid,2,'ready','qa','owner');
 v_order:=public.restaurant_ops_transition_order('delibocados',(v_order->>'id')::uuid,3,'completed','qa','owner');
 IF v_order->>'status'<>'completed' THEN RAISE EXCEPTION 'PICKUP_NOT_COMPLETED'; END IF;

 INSERT INTO public.restaurant_ops_couriers(company_id,name,phone,vehicle,availability)
 VALUES('delibocados','Courier Test','573009876543','motorbike','available')
 RETURNING id INTO v_courier;
 v_delivery:=public.restaurant_ops_create_order(
   p_company_id=>'delibocados',
   p_source=>'whatsapp',p_source_key=>'whatsapp-delivery-smoke-456',
   p_customer_phone=>'573001234567',p_customer_name=>'Cliente de Prueba',
   p_fulfillment_mode=>'delivery',
   p_items=>'[{"productId":"burger","quantity":1}]'::jsonb,
   p_zone_id=>v_zone,p_address=>'Calle 15 # 8-20, Funza',
   p_customer_confirmed=>true,p_expected_menu_revision=>1,
   p_payment_method=>'cash',p_payment_status=>'cash_on_delivery'
 );
 IF (v_delivery->>'total_cop')::int<>19000 THEN RAISE EXCEPTION 'DELIVERY_FEE_FAILED'; END IF;
 v_delivery:=public.restaurant_ops_transition_order('delibocados',(v_delivery->>'id')::uuid,1,'preparing','qa','owner');
 v_delivery:=public.restaurant_ops_assign_courier('delibocados',(v_delivery->>'id')::uuid,v_courier,2,'qa','owner');
 v_version:=(v_delivery->>'version')::int;
 v_delivery:=public.restaurant_ops_transition_order('delibocados',(v_delivery->>'id')::uuid,v_version,'ready','qa','owner');
 v_version:=(v_delivery->>'version')::int;
 v_delivery:=public.restaurant_ops_transition_order('delibocados',(v_delivery->>'id')::uuid,v_version,'out_for_delivery','qa','owner');
 v_version:=(v_delivery->>'version')::int;
 v_delivery:=public.restaurant_ops_transition_order('delibocados',(v_delivery->>'id')::uuid,v_version,'completed','qa','owner');
 IF v_delivery->>'status'<>'completed' THEN RAISE EXCEPTION 'DELIVERY_NOT_COMPLETED'; END IF;
 IF (SELECT availability FROM public.restaurant_ops_couriers
     WHERE id=v_courier)<>'available' THEN RAISE EXCEPTION 'COURIER_NOT_RELEASED'; END IF;
 IF (SELECT count(*) FROM public.restaurant_ops_order_events
   WHERE company_id='delibocados' AND order_id=(v_delivery->>'id')::uuid)<5
 THEN RAISE EXCEPTION 'AUDIT_EVENTS_MISSING'; END IF;
 RAISE NOTICE 'RESTAURANT_OPS_SQL_SMOKE_SUCCESS';
END $$;
ROLLBACK;
