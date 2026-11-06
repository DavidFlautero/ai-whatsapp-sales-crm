-- Executes on isolated PostgreSQL CI database only.
BEGIN;
DO $$
DECLARE
  v_order jsonb;
  v_proof jsonb;
  v_review jsonb;
  v_order_id uuid;
  v_proof_id uuid;
  v_paid text;
  v_kitchen text;
  v_zone uuid;
  v_courier uuid;
  v_delivery jsonb;
BEGIN
  v_order := public.restaurant_ops_create_order(
    p_company_id=>'delibocados',p_source=>'whatsapp',
    p_source_key=>'restaurant-transfer-qa-order-20261106',
    p_customer_phone=>'573001111222',p_customer_name=>'Cliente Transferencia',
    p_fulfillment_mode=>'pickup',
    p_items=>'[{"productId":"burger","quantity":1}]'::jsonb,
    p_customer_confirmed=>true,p_expected_menu_revision=>1,
    p_payment_method=>'transfer',p_payment_status=>'pending'
  );
  v_order_id := (v_order->>'id')::uuid;
  SELECT status INTO v_kitchen FROM public.restaurant_ops_kitchen_tickets
   WHERE company_id='delibocados' AND order_id=v_order_id;
  IF v_kitchen<>'on_hold' THEN RAISE EXCEPTION 'PAYMENT_NOT_HELD_FROM_KITCHEN'; END IF;
  BEGIN
    PERFORM public.restaurant_ops_set_payment(
      'delibocados',v_order_id,1,'verified','manual','manager','owner'
    );
    RAISE EXCEPTION 'UNVERIFIED_TRANSFER_BYPASSED';
  EXCEPTION WHEN others THEN
    IF SQLERRM<>'TRANSFER_REQUIRES_PROOF_REVIEW' THEN RAISE; END IF;
  END;

  v_proof:=public.restaurant_ops_submit_payment_proof(
    'delibocados',v_order_id,'whapi-proof-001','573001111222'
  );
  v_proof_id:=(v_proof->>'id')::uuid;
  IF v_proof->>'status'<>'pending_review' THEN RAISE EXCEPTION 'PROOF_NOT_QUEUED'; END IF;
  SELECT payment_status INTO v_paid FROM public.restaurant_ops_orders
   WHERE company_id='delibocados' AND id=v_order_id;
  IF v_paid<>'proof_submitted' THEN RAISE EXCEPTION 'ORDER_NOT_PENDING_REVIEW'; END IF;

  v_review:=public.restaurant_ops_review_payment_proof(
    'delibocados',v_proof_id,'reject','manager','owner','Comprobante ilegible'
  );
  IF v_review->>'payment_status'<>'pending' THEN RAISE EXCEPTION 'REJECTION_NOT_REOPENED'; END IF;
  SELECT status INTO v_kitchen FROM public.restaurant_ops_kitchen_tickets
   WHERE company_id='delibocados' AND order_id=v_order_id;
  IF v_kitchen<>'on_hold' THEN RAISE EXCEPTION 'REJECT_RELEASED_KITCHEN'; END IF;

  v_proof:=public.restaurant_ops_submit_payment_proof(
    'delibocados',v_order_id,'whapi-proof-002','573001111222'
  );
  v_proof_id:=(v_proof->>'id')::uuid;
  v_review:=public.restaurant_ops_review_payment_proof(
    'delibocados',v_proof_id,'approve','manager','owner'
  );
  IF v_review->>'payment_status'<>'verified' THEN RAISE EXCEPTION 'APPROVAL_NOT_VERIFIED'; END IF;
  SELECT status INTO v_kitchen FROM public.restaurant_ops_kitchen_tickets
   WHERE company_id='delibocados' AND order_id=v_order_id;
  IF v_kitchen<>'queued' THEN RAISE EXCEPTION 'APPROVAL_DID_NOT_RELEASE_KITCHEN'; END IF;
  IF (SELECT count(*) FROM public.restaurant_ops_payment_proofs
      WHERE company_id='delibocados' AND order_id=v_order_id)<>2
  THEN RAISE EXCEPTION 'PROOF_COUNT_INCORRECT'; END IF;
  IF (SELECT count(*) FROM public.restaurant_ops_outbox
      WHERE company_id='delibocados' AND order_id=v_order_id
        AND kind IN ('payment_proof_received','payment_verified','payment_rejected'))<>4
  THEN RAISE EXCEPTION 'MISSING_PAYMENT_NOTIFICATION_EVENTS'; END IF;
  SELECT id INTO v_zone FROM public.restaurant_ops_zones
    WHERE company_id='delibocados' AND name='200M';
  UPDATE public.restaurant_ops_zones SET active=true
    WHERE id=v_zone AND company_id='delibocados';
  INSERT INTO public.restaurant_ops_couriers(
    company_id,name,phone,vehicle,availability
  ) VALUES('delibocados','QA Courier','573001112233','motorbike','available')
    RETURNING id INTO v_courier;
  v_delivery:=public.restaurant_ops_create_order(
    p_company_id=>'delibocados',p_source=>'whatsapp',
    p_source_key=>'restaurant-payment-dispatch-smoke-246',
    p_customer_phone=>'573002222333',p_customer_name=>'Cliente Domicilio',
    p_fulfillment_mode=>'delivery',
    p_items=>'[{"productId":"burger","quantity":1}]'::jsonb,
    p_zone_id=>v_zone,p_address=>'Calle 15 # 8-20 Funza',
    p_customer_confirmed=>true,p_expected_menu_revision=>1,
    p_payment_method=>'cash',p_payment_status=>'cash_on_delivery'
  );
  PERFORM public.restaurant_ops_assign_courier(
    'delibocados',(v_delivery->>'id')::uuid,v_courier,1,'manager','owner'
  );
  IF (SELECT count(*) FROM public.restaurant_ops_outbox
    WHERE company_id='delibocados' AND order_id=(v_delivery->>'id')::uuid
      AND kind='courier_assigned')<>1
  THEN RAISE EXCEPTION 'COURIER_ASSIGNMENT_NOTIFICATION_MISSING'; END IF;
    RAISE NOTICE 'RESTAURANT_PAYMENT_REVIEW_SMOKE_SUCCESS';
END $$;
ROLLBACK;
