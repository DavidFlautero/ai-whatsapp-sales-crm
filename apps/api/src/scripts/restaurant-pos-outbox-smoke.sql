-- RUN ONLY in temporary PostgreSQL CI database: rollback all fixtures.
BEGIN;
DO $$
DECLARE
  v_a jsonb;v_again jsonb;v_b jsonb;v_c jsonb;v_d jsonb;
  v_export public.restaurant_ops_pos_exports%ROWTYPE;
  v_claim jsonb;v_result jsonb;
BEGIN
  v_a:=public.restaurant_ops_create_order(
    p_company_id=>'delibocados',p_source=>'whatsapp',
    p_source_key=>'whatsapp-toteat-a-unique-20261108',
    p_customer_phone=>'573001234567',p_customer_name=>'Cliente Test A',
    p_fulfillment_mode=>'pickup',
    p_items=>'[{"productId":"burger","quantity":1}]'::jsonb,
    p_customer_confirmed=>true,p_expected_menu_revision=>1,
    p_payment_method=>'cash',p_payment_status=>'cash_on_delivery'
  );
  v_again:=public.restaurant_ops_create_order(
    p_company_id=>'delibocados',p_source=>'whatsapp',
    p_source_key=>'whatsapp-toteat-a-unique-20261108',
    p_customer_phone=>'573001234567',p_customer_name=>'Cliente Test A',
    p_fulfillment_mode=>'pickup',
    p_items=>'[{"productId":"burger","quantity":1}]'::jsonb,
    p_customer_confirmed=>true,p_expected_menu_revision=>1,
    p_payment_method=>'cash',p_payment_status=>'cash_on_delivery'
  );
  IF v_a->>'id'<>v_again->>'id' THEN
    RAISE EXCEPTION 'POS_DUPLICATE_CREATED_ORDER'; END IF;
  IF (SELECT count(*) FROM public.restaurant_ops_pos_exports
    WHERE company_id='delibocados' AND order_id=(v_a->>'id')::uuid)<>1
  THEN RAISE EXCEPTION 'POS_DUPLICATE_EXPORT'; END IF;
  SELECT * INTO v_export FROM public.restaurant_ops_pos_exports
  WHERE order_id=(v_a->>'id')::uuid;
  IF v_export.provider<>'toteat' OR v_export.status<>'pending'
    OR v_export.attempts<>0 OR v_export.external_reference<>'delibocados-'||(v_a->>'id')
  THEN RAISE EXCEPTION 'POS_CASH_ORDER_NOT_PENDING'; END IF;

  v_b:=public.restaurant_ops_create_order(
    p_company_id=>'delibocados',p_source=>'whatsapp',
    p_source_key=>'whatsapp-toteat-b-unique-20261108',
    p_customer_phone=>'573001234567',p_customer_name=>'Cliente Test B',
    p_fulfillment_mode=>'pickup',
    p_items=>'[{"productId":"burger","quantity":1}]'::jsonb,
    p_customer_confirmed=>true,p_expected_menu_revision=>1,
    p_payment_method=>'transfer',p_payment_status=>'pending'
  );
  IF (SELECT status FROM public.restaurant_ops_pos_exports
    WHERE order_id=(v_b->>'id')::uuid)<>'blocked'
  THEN RAISE EXCEPTION 'POS_PENDING_TRANSFER_NOT_BLOCKED'; END IF;

  v_c:=public.restaurant_ops_create_order(
    p_company_id=>'delibocados',p_source=>'qr',
    p_source_key=>'qr-toteat-should-not-export-20261108',
    p_customer_phone=>'573001234567',p_customer_name=>'Cliente Test C',
    p_fulfillment_mode=>'pickup',
    p_items=>'[{"productId":"burger","quantity":1}]'::jsonb,
    p_customer_confirmed=>true,p_expected_menu_revision=>1,
    p_payment_method=>'cash',p_payment_status=>'cash_on_delivery'
  );
  IF EXISTS(SELECT 1 FROM public.restaurant_ops_pos_exports
    WHERE order_id=(v_c->>'id')::uuid)
  THEN RAISE EXCEPTION 'QR_WRONGLY_EXPORTED_TO_TOTEAT'; END IF;

  IF public.restaurant_ops_pos_claim_toteat('delibocados') IS NOT NULL
  THEN RAISE EXCEPTION 'POS_CLAIM_WITHOUT_CONFIG'; END IF;

  INSERT INTO public.company_integrations(company_id,provider,status,enabled)
  VALUES('delibocados','toteat','connected',true)
  ON CONFLICT(company_id,provider) DO UPDATE SET status='connected',enabled=true;
  IF public.restaurant_ops_pos_claim_toteat('delibocados') IS NOT NULL
  THEN RAISE EXCEPTION 'POS_CLAIM_WITHOUT_MAPPING'; END IF;

  INSERT INTO public.restaurant_ops_pos_product_map(
    company_id,provider,product_id,external_product_code,active,reviewed_at
  ) VALUES('delibocados','toteat','burger','TOTEAT-TEST-BURGER',true,now());
  v_claim:=public.restaurant_ops_pos_claim_toteat('delibocados');
  IF v_claim IS NULL OR v_claim->>'order_id'<>v_a->>'id' OR v_claim->>'status'<>'sending'
    OR (v_claim->>'attempts')::integer<>1
  THEN RAISE EXCEPTION 'POS_CLAIM_FAILED'; END IF;
  v_result:=public.restaurant_ops_pos_finish_toteat('delibocados',
    (v_claim->>'id')::uuid,'unknown',NULL);
  IF v_result->>'status'<>'unknown' THEN
    RAISE EXCEPTION 'POS_AMBIGUOUS_RESULT_NOT_RETAINED'; END IF;
  IF public.restaurant_ops_pos_claim_toteat('delibocados') IS NOT NULL
  THEN RAISE EXCEPTION 'POS_UNKNOWN_RETRIED'; END IF;

  UPDATE public.restaurant_ops_orders SET payment_status='verified'
  WHERE id=(v_b->>'id')::uuid;
  IF (SELECT status FROM public.restaurant_ops_pos_exports
    WHERE order_id=(v_b->>'id')::uuid)<>'pending'
  THEN RAISE EXCEPTION 'POS_BANK_APPROVAL_NOT_RELEASING'; END IF;
  v_claim:=public.restaurant_ops_pos_claim_toteat('delibocados');
  IF v_claim->>'order_id'<>v_b->>'id'
  THEN RAISE EXCEPTION 'POS_WRONG_ORDER_CLAIMED'; END IF;
  v_result:=public.restaurant_ops_pos_finish_toteat('delibocados',
    (v_claim->>'id')::uuid,'accepted','7123456789012345');
  IF v_result->>'status'<>'accepted'
    OR v_result->>'external_order_id'<>'7123456789012345'
    OR v_result->>'accepted_at' IS NULL
  THEN RAISE EXCEPTION 'POS_EXTERNAL_RECEIPT_NOT_SAVED'; END IF;

  v_d:=public.restaurant_ops_create_order(
    p_company_id=>'delibocados',p_source=>'whatsapp',
    p_source_key=>'whatsapp-toteat-d-unique-20261108',
    p_customer_phone=>'573001234567',p_customer_name=>'Cliente Test D',
    p_fulfillment_mode=>'pickup',
    p_items=>'[{"productId":"burger","quantity":1}]'::jsonb,
    p_customer_confirmed=>true,p_expected_menu_revision=>1,
    p_payment_method=>'cash',p_payment_status=>'cash_on_delivery'
  );
  UPDATE public.restaurant_ops_orders SET status='cancelled'
  WHERE id=(v_d->>'id')::uuid;
  IF (SELECT status FROM public.restaurant_ops_pos_exports
    WHERE order_id=(v_d->>'id')::uuid)<>'suppressed'
  THEN RAISE EXCEPTION 'POS_CANCELLED_ORDER_NOT_SUPPRESSED'; END IF;
  IF (SELECT count(*) FROM public.restaurant_ops_order_events
    WHERE order_id=(v_b->>'id')::uuid AND event_type='pos_export_accepted')<>1
  THEN RAISE EXCEPTION 'POS_ACCEPTED_AUDIT_EVENT_MISSING'; END IF;
  RAISE NOTICE 'DELIBOCADOS_POS_OUTBOX_SQL_SMOKE_SUCCESS';
END $$;
ROLLBACK;
