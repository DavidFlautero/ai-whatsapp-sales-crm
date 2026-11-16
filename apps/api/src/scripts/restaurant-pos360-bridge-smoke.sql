-- One-off PostgreSQL 17 CI-only test. Never apply to live restaurant.
BEGIN;
DO $$
DECLARE
 v_table uuid;
 v_token text:='dlb_test_pos360_bridge_1234567890abcdef';
 v_order jsonb;
 v_other jsonb;
 v_claim jsonb;
 v_receipt jsonb;
 v_failed boolean;
BEGIN
 INSERT INTO public.restaurant_ops_qr_tables(
   company_id,editor_table_id,label,qr_token_sha256,enabled
 ) VALUES (
   'delibocados','mesa_bridge_ci','Mesa 2',
   encode(sha256(convert_to(v_token,'UTF8')),'hex'),true
 ) RETURNING id INTO v_table;

 v_order:=public.restaurant_ops_create_qr_order(
   'delibocados',gen_random_uuid()::text,'table',v_token,v_table,
   NULL,'Prueba POS360','[{"productId":"burger","quantity":1}]'::jsonb,
   1,'cash','cash_on_delivery',true,'sin cebolla'
 );
 -- No integration enabled, no claims.
 IF public.restaurant_ops_pos360_claim('delibocados') IS NOT NULL
 THEN RAISE EXCEPTION 'CLAIM_WITHOUT_INTEGRATION'; END IF;
 INSERT INTO public.company_integrations(company_id,provider,status,enabled)
 VALUES('delibocados','pos360','connected',true)
 ON CONFLICT(company_id,provider) DO UPDATE SET status='connected',enabled=true;
 IF public.restaurant_ops_pos360_claim('delibocados') IS NOT NULL
 THEN RAISE EXCEPTION 'CLAIM_WITHOUT_REVIEWED_MAPPING'; END IF;
 INSERT INTO public.restaurant_ops_pos_product_map(
  company_id,provider,product_id,external_product_code,active,reviewed_at
 ) VALUES('delibocados','pos360','burger','DLB-0004',true,now());

 v_claim:=public.restaurant_ops_pos360_claim('delibocados');
 RAISE NOTICE 'POS360_TEST_CLAIM: %',v_claim;
 IF v_claim IS NULL
   OR v_claim->>'orderId'<>v_order->>'id'
   OR v_claim->>'externalReference'<>'delibocados-qr-'||(v_order->>'id')
   OR v_claim->>'tableLabel'<>'Mesa 2'
   OR jsonb_array_length(v_claim->'items')<>1
   OR v_claim->'items'->0->>'pos360Code'<>'DLB-0004'
 THEN RAISE EXCEPTION 'CLAIM_PAYLOAD_INVALID'; END IF;
 IF public.restaurant_ops_pos360_claim('delibocados') IS NOT NULL
 THEN RAISE EXCEPTION 'DUPLICATE_CLAIM'; END IF;

 v_receipt:=public.restaurant_ops_pos360_finish(
   'delibocados',(v_claim->>'exportId')::uuid,'unknown',NULL
 );
 IF v_receipt->>'status'<>'unknown'
 THEN RAISE EXCEPTION 'UNKNOWN_NOT_PERSISTED'; END IF;
 IF public.restaurant_ops_pos360_claim('delibocados') IS NOT NULL
 THEN RAISE EXCEPTION 'UNKNOWN_RETRIED_AUTOMATICALLY'; END IF;

 -- Second incremental order is a separate outbox entry for same table.
 v_other:=public.restaurant_ops_create_qr_order(
   'delibocados',gen_random_uuid()::text,'table',v_token,v_table,
   NULL,'Prueba POS360','[{"productId":"burger","quantity":2}]'::jsonb,
   1,'cash','cash_on_delivery',true,''
 );
 IF v_order->>'table_session_id'<>v_other->>'table_session_id'
 THEN RAISE EXCEPTION 'TABLE_SESSION_NOT_SHARED'; END IF;
 v_claim:=public.restaurant_ops_pos360_claim('delibocados');
 IF v_claim->>'orderId'<>v_other->>'id' THEN
   RAISE EXCEPTION 'SECOND_COMANDA_NOT_SEPARATE'; END IF;
 v_failed:=false;
 BEGIN
   PERFORM public.restaurant_ops_pos360_finish(
     'delibocados',(v_claim->>'exportId')::uuid,'accepted',NULL);
 EXCEPTION WHEN OTHERS THEN
   v_failed:=SQLERRM LIKE '%POS360_RECEIPT_REQUIRED%';
 END;
 IF NOT v_failed THEN RAISE EXCEPTION 'ACCEPTED_WITHOUT_RECEIPT'; END IF;
 v_receipt:=public.restaurant_ops_pos360_finish(
   'delibocados',(v_claim->>'exportId')::uuid,'accepted','smartpos-order-001'
 );
 IF v_receipt->>'externalOrderId'<>'smartpos-order-001'
   OR v_receipt->>'status'<>'accepted'
 THEN RAISE EXCEPTION 'ACCEPTANCE_NOT_RECORDED'; END IF;
 IF public.restaurant_ops_pos360_claim('delibocados') IS NOT NULL
 THEN RAISE EXCEPTION 'POS360_ALREADY_ACCEPTED_RECLAIMED'; END IF;
 IF (SELECT count(*) FROM public.restaurant_ops_order_events
     WHERE company_id='delibocados' AND order_id=(v_other->>'id')::uuid
     AND event_type='pos_export_accepted')<>1
 THEN RAISE EXCEPTION 'POS360_ACCEPT_EVENT_MISSING'; END IF;
 RAISE NOTICE 'POS360_BRIDGE_OUTBOX_CLAIM_ONCE_UNKNOWN_RECONCILE_OK';
END $$;
ROLLBACK;
