-- SQL-only verification of open QR table checks and nullable contact.
-- Runs against disposable CI PostgreSQL only. Not for production.
DO $$
DECLARE
  v_table uuid:=gen_random_uuid();
  v_source1 text:=gen_random_uuid()::text;
  v_source2 text:=gen_random_uuid()::text;
  v_order1 jsonb;
  v_order1_again jsonb;
  v_order2 jsonb;
  v_session uuid;
  v_version int;
  v_new jsonb;
  v_count int;
  v_status text;
BEGIN
  INSERT INTO public.restaurant_ops_qr_tables(
    id,company_id,editor_table_id,label,qr_token_sha256,enabled
  ) VALUES(
    v_table,'delibocados','mesa_test_open_bill','Mesa Prueba Cuenta',
    encode(sha256(convert_to(repeat('B',40),'UTF8')),'hex'),true
  );

  v_order1:=public.restaurant_ops_create_qr_order(
    'delibocados',v_source1,'table',repeat('B',40),v_table,NULL,
    'Cliente Mesa','[{"productId":"burger","quantity":1}]'::jsonb,
    1,'cash','cash_on_delivery',true,''
  );
  v_order1_again:=public.restaurant_ops_create_qr_order(
    'delibocados',v_source1,'table',repeat('B',40),v_table,NULL,
    'Cliente Mesa','[{"productId":"burger","quantity":1}]'::jsonb,
    1,'cash','cash_on_delivery',true,''
  );
  IF v_order1->>'id' IS DISTINCT FROM v_order1_again->>'id'
  THEN RAISE EXCEPTION 'QR_RETRY_DUPLICATED'; END IF;

  v_order2:=public.restaurant_ops_create_qr_order(
    'delibocados',v_source2,'table',repeat('B',40),v_table,NULL,
    'Cliente Mesa','[{"productId":"soda","quantity":2}]'::jsonb,
    1,'cash','cash_on_delivery',true,'sin hielo'
  );
  v_session:=(v_order1->>'table_session_id')::uuid;
  IF v_session IS NULL OR v_session IS DISTINCT FROM (v_order2->>'table_session_id')::uuid
  THEN RAISE EXCEPTION 'TABLE_ACCOUNT_NOT_SHARED'; END IF;
  SELECT count(*) INTO v_count FROM public.restaurant_ops_table_sessions
    WHERE company_id='delibocados' AND qr_table_id=v_table AND status='open';
  IF v_count<>1 THEN RAISE EXCEPTION 'MULTIPLE_OPEN_TABLES'; END IF;
  SELECT count(*) INTO v_count FROM public.restaurant_ops_kitchen_tickets
    WHERE company_id='delibocados' AND order_id IN (
      (v_order1->>'id')::uuid,(v_order2->>'id')::uuid
    );
  IF v_count<>2 THEN RAISE EXCEPTION 'KITCHEN_TICKETS_NOT_INCREMENTAL'; END IF;
  SELECT count(*) INTO v_count FROM public.restaurant_ops_pos_exports
    WHERE company_id='delibocados' AND provider='pos360' AND order_id IN (
      (v_order1->>'id')::uuid,(v_order2->>'id')::uuid
    );
  IF v_count<>2 THEN RAISE EXCEPTION 'POS360_OUTBOX_NOT_INCREMENTAL'; END IF;
  SELECT count(*) INTO v_count FROM public.restaurant_ops_orders
    WHERE company_id='delibocados' AND table_session_id=v_session AND customer_phone IS NULL;
  IF v_count<>2 THEN RAISE EXCEPTION 'PHONE_NOT_OPTIONAL_FOR_QR'; END IF;

  -- An unpaid or unfinished bill must never be closed.
  BEGIN
    PERFORM public.restaurant_ops_close_table_session('delibocados',v_session,'owner-test');
    RAISE EXCEPTION 'CLOSE_BYPASSED_UNPAID_CHECK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%TABLE_HAS_UNFINISHED_OR_UNPAID_ORDERS%'
    THEN RAISE; END IF;
  END;

  FOR v_new IN SELECT jsonb_build_object('id',id) FROM public.restaurant_ops_orders
    WHERE company_id='delibocados' AND table_session_id=v_session LOOP
    SELECT version INTO v_version FROM public.restaurant_ops_orders WHERE id=(v_new->>'id')::uuid;
    PERFORM public.restaurant_ops_transition_order(
      'delibocados',(v_new->>'id')::uuid,v_version,'preparing','owner-test','owner',NULL
    );
    SELECT version INTO v_version FROM public.restaurant_ops_orders WHERE id=(v_new->>'id')::uuid;
    PERFORM public.restaurant_ops_transition_order(
      'delibocados',(v_new->>'id')::uuid,v_version,'ready','owner-test','owner',NULL
    );
    SELECT version INTO v_version FROM public.restaurant_ops_orders WHERE id=(v_new->>'id')::uuid;
    PERFORM public.restaurant_ops_transition_order(
      'delibocados',(v_new->>'id')::uuid,v_version,'completed','owner-test','owner',NULL
    );
    SELECT version INTO v_version FROM public.restaurant_ops_orders WHERE id=(v_new->>'id')::uuid;
    PERFORM public.restaurant_ops_set_payment(
      'delibocados',(v_new->>'id')::uuid,v_version,'verified','cash','owner-test','owner'
    );
  END LOOP;

  PERFORM public.restaurant_ops_close_table_session('delibocados',v_session,'owner-test');
  SELECT status INTO v_status FROM public.restaurant_ops_table_sessions WHERE id=v_session;
  IF v_status<>'closed' THEN RAISE EXCEPTION 'TABLE_CLOSE_FAILED'; END IF;

  -- Next diner on the same QR creates a NEW table session.
  v_order2:=public.restaurant_ops_create_qr_order(
    'delibocados',gen_random_uuid()::text,'table',repeat('B',40),v_table,NULL,
    'Cliente Nuevo','[{"productId":"burger","quantity":1}]'::jsonb,
    1,'cash','cash_on_delivery',true,''
  );
  IF v_session=(v_order2->>'table_session_id')::uuid
  THEN RAISE EXCEPTION 'TABLE_SESSION_NOT_REOPENED'; END IF;
  RAISE NOTICE 'PASS: optional phone; one running table check; incremental kitchen/outbox; close; reopen';
END $$;
