-- Run ONLY in isolated PostgreSQL CI database. Never run against live orders.
BEGIN;
DO $$
DECLARE
 v_table_id uuid;
 v_token text:='delibocados_MESA_7_token_1234567890abcdef';
 v_general_token text:='delibocados_GENERAL_token_abcdef1234567890';
 v_a jsonb;v_repeat jsonb;v_b jsonb;v_c jsonb;
 v_export public.restaurant_ops_pos_exports%ROWTYPE;
 v_failed boolean;
BEGIN
 INSERT INTO public.restaurant_ops_qr_tables(
  company_id,editor_table_id,label,qr_token_sha256,enabled
 ) VALUES (
  'delibocados','mesa_7','Mesa 7',
  encode(sha256(convert_to(v_token,'UTF8')),'hex'),true
 ) RETURNING id INTO v_table_id;
 INSERT INTO public.restaurant_ops_qr_general(company_id,qr_token_sha256,enabled)
 VALUES ('delibocados',encode(sha256(convert_to(v_general_token,'UTF8')),'hex'),true);
 v_a:=public.restaurant_ops_create_qr_order(
  p_company_id=>'delibocados',p_source_key=>'qr-checkout-unique-stage6-a',
  p_qr_kind=>'table',p_qr_token=>v_token,p_table_id=>v_table_id,
  p_customer_phone=>'573001234567',p_customer_name=>'Cliente QR',
  p_items=>'[{"productId":"burger","quantity":2}]'::jsonb,
  p_expected_menu_revision=>1,
  p_payment_method=>'cash',p_payment_status=>'cash_on_delivery',
  p_customer_confirmed=>true
 );
 IF v_a->>'fulfillment_mode'<>'dine_in' OR v_a->>'source'<>'qr'
   OR (v_a->>'qr_table_id')::uuid<>v_table_id
 THEN RAISE EXCEPTION 'QR_DINE_IN_NOT_PERSISTED'; END IF;
 v_repeat:=public.restaurant_ops_create_qr_order(
  p_company_id=>'delibocados',p_source_key=>'qr-checkout-unique-stage6-a',
  p_qr_kind=>'table',p_qr_token=>v_token,p_table_id=>v_table_id,
  p_customer_phone=>'573001234567',p_customer_name=>'Cliente QR',
  p_items=>'[{"productId":"burger","quantity":2}]'::jsonb,
  p_expected_menu_revision=>1,
  p_payment_method=>'cash',p_payment_status=>'cash_on_delivery',
  p_customer_confirmed=>true
 );
 IF v_repeat->>'id'<>v_a->>'id' THEN
   RAISE EXCEPTION 'QR_IDEMPOTENCY_FAILED'; END IF;
 IF v_a->>'qr_checkout_fingerprint' IS NULL
 THEN RAISE EXCEPTION 'QR_BASKET_FINGERPRINT_MISSING'; END IF;
 v_failed:=false;
 BEGIN
   PERFORM public.restaurant_ops_create_qr_order(
     p_company_id=>'delibocados',p_source_key=>'qr-checkout-unique-stage6-a',
     p_qr_kind=>'table',p_qr_token=>v_token,p_table_id=>v_table_id,
     p_customer_phone=>'573001234567',p_customer_name=>'Cliente QR',
     p_items=>'[{"productId":"burger","quantity":3}]'::jsonb,
     p_expected_menu_revision=>1,p_payment_method=>'cash',
     p_payment_status=>'cash_on_delivery',p_customer_confirmed=>true
   );
 EXCEPTION WHEN OTHERS THEN v_failed:=SQLERRM LIKE '%IDEMPOTENCY_CONFLICT%'; END;
 IF NOT v_failed THEN RAISE EXCEPTION 'QR_BASKET_REPLAY_CONFLICT_NOT_BLOCKED'; END IF;

 IF (SELECT count(*) FROM public.restaurant_ops_orders
   WHERE company_id='delibocados' AND source_key='qr-checkout-unique-stage6-a')<>1
 THEN RAISE EXCEPTION 'QR_DUPLICATE_ORDER'; END IF;
 IF (SELECT count(*) FROM public.restaurant_ops_kitchen_tickets
   WHERE order_id=(v_a->>'id')::uuid)<>1
 THEN RAISE EXCEPTION 'QR_DUPLICATE_KITCHEN_TICKET'; END IF;
 SELECT * INTO v_export FROM public.restaurant_ops_pos_exports
 WHERE order_id=(v_a->>'id')::uuid;
 IF v_export.provider<>'pos360' OR v_export.status<>'pending'
  OR v_export.attempts<>0
 THEN RAISE EXCEPTION 'QR_POS360_EXPORT_MISSING'; END IF;
 IF EXISTS(SELECT 1 FROM public.restaurant_ops_pos_exports
   WHERE order_id=(v_a->>'id')::uuid AND provider='toteat')
 THEN RAISE EXCEPTION 'QR_WRONG_POS_ROUTING'; END IF;
 v_failed:=false;
 BEGIN
  PERFORM public.restaurant_ops_create_qr_order(
   'delibocados','qr-checkout-unique-stage6-b','table',
   'delibocados_wrong_token_1234567890abcdef',
   v_table_id,'573001234567','Cliente QR',
   '[{"productId":"burger","quantity":1}]'::jsonb,
   1,'cash','cash_on_delivery',true,'');
 EXCEPTION WHEN OTHERS THEN v_failed:=true; END;
 IF NOT v_failed THEN RAISE EXCEPTION 'QR_TOKEN_FAIL_OPEN'; END IF;
 IF EXISTS(SELECT 1 FROM public.restaurant_ops_orders
    WHERE source_key='qr-checkout-unique-stage6-b')
 THEN RAISE EXCEPTION 'QR_INVALID_TOKEN_CREATED_ORDER'; END IF;
 v_b:=public.restaurant_ops_create_qr_order(
  p_company_id=>'delibocados',p_source_key=>'qr-checkout-unique-stage6-c',
  p_qr_kind=>'general',p_qr_token=>v_general_token,p_table_id=>v_table_id,
  p_customer_phone=>'573001234567',p_customer_name=>'Cliente QR General',
  p_items=>'[{"productId":"soda","quantity":1}]'::jsonb,
  p_expected_menu_revision=>1,p_payment_method=>'transfer',
  p_payment_status=>'pending',p_customer_confirmed=>true
 );
 IF (SELECT status FROM public.restaurant_ops_pos_exports
 WHERE order_id=(v_b->>'id')::uuid)<>'blocked'
 THEN RAISE EXCEPTION 'QR_PAYMENT_BLOCK_FAILED'; END IF;
 UPDATE public.restaurant_ops_orders SET payment_status='verified'
 WHERE id=(v_b->>'id')::uuid;
 IF (SELECT status FROM public.restaurant_ops_pos_exports
 WHERE order_id=(v_b->>'id')::uuid)<>'pending'
 THEN RAISE EXCEPTION 'QR_PAYMENT_APPROVAL_FAILED'; END IF;
 UPDATE public.restaurant_ops_orders SET status='cancelled'
 WHERE id=(v_b->>'id')::uuid;
 IF (SELECT status FROM public.restaurant_ops_pos_exports
 WHERE order_id=(v_b->>'id')::uuid)<>'suppressed'
 THEN RAISE EXCEPTION 'QR_CANCELLATION_NOT_SUPPRESSED'; END IF;
 UPDATE public.restaurant_ops_qr_tables SET enabled=false WHERE id=v_table_id;
 v_failed:=false;
 BEGIN
  PERFORM public.restaurant_ops_create_qr_order(
   'delibocados','qr-checkout-unique-stage6-d','table',
   v_token,v_table_id,'573001234567','Cliente QR',
   '[{"productId":"burger","quantity":1}]'::jsonb,
   1,'cash','cash_on_delivery',true,'');
 EXCEPTION WHEN OTHERS THEN v_failed:=true; END;
 IF NOT v_failed THEN RAISE EXCEPTION 'QR_DISABLED_TABLE_FAIL_OPEN'; END IF;
 RAISE NOTICE 'DELIBOCADOS_QR_DINE_IN_SQL_SMOKE_SUCCESS';
END $$;
ROLLBACK;
