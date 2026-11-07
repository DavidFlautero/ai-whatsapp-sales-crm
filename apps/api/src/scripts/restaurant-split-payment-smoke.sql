-- PostgreSQL 17 split-payment regression: fixtures are rolled back.
BEGIN;
DO $$
DECLARE v_order jsonb;v_id uuid;v_proof jsonb;v_review jsonb;
        v_split public.restaurant_ops_split_payments%ROWTYPE;
        v_kitchen text;v_paid text;v_version integer;
BEGIN
 v_order:=public.restaurant_ops_create_split_order(
   p_company_id=>'delibocados',p_source=>'whatsapp',
   p_source_key=>'qa-split-order-20261107190000',
   p_customer_phone=>'573001111333',p_customer_name=>'Cliente Prueba Split',
   p_fulfillment_mode=>'pickup',
   p_items=>'[{"productId":"burger","quantity":1},{"productId":"soda","quantity":1}]'::jsonb,
   p_transfer_cop=>18000,p_customer_confirmed=>true,
   p_expected_menu_revision=>1
 );
 v_id:=(v_order->>'id')::uuid;
 SELECT * INTO v_split FROM public.restaurant_ops_split_payments
 WHERE company_id='delibocados' AND order_id=v_id;
 IF v_split.transfer_due_cop<>18000 OR v_split.cash_due_cop<>5000 THEN
   RAISE EXCEPTION 'SPLIT_AMOUNT_DID_NOT_MATCH_SERVER_TOTAL';END IF;
 SELECT status INTO v_kitchen FROM public.restaurant_ops_kitchen_tickets
 WHERE company_id='delibocados' AND order_id=v_id;
 IF v_kitchen<>'on_hold' THEN RAISE EXCEPTION 'SPLIT_NOT_HELD_BEFORE_BANK_PROOF';END IF;
 -- A replay cannot change the customer's split amount.
 BEGIN
   PERFORM public.restaurant_ops_create_split_order(
    p_company_id=>'delibocados',p_source=>'whatsapp',
    p_source_key=>'qa-split-order-20261107190000',
    p_customer_phone=>'573001111333',p_customer_name=>'Cliente Prueba Split',
    p_fulfillment_mode=>'pickup',
    p_items=>'[{"productId":"burger","quantity":1},{"productId":"soda","quantity":1}]'::jsonb,
    p_transfer_cop=>17000,p_customer_confirmed=>true,p_expected_menu_revision=>1
   );
   RAISE EXCEPTION 'SPLIT_IDEMPOTENCY_WAS_BYPASSED';
 EXCEPTION WHEN others THEN
   IF SQLERRM<>'SPLIT_IDEMPOTENCY_CONFLICT' THEN RAISE;END IF;
 END;
 BEGIN
   PERFORM public.restaurant_ops_set_payment(
    'delibocados',v_id,1,'verified','mixed','manager','owner');
   RAISE EXCEPTION 'SPLIT_GENERAL_PAYMENT_BYPASS';
 EXCEPTION WHEN others THEN
   IF SQLERRM<>'SPLIT_REQUIRES_AUDITED_PAYMENT_FLOW' THEN RAISE;END IF;
 END;
 v_proof:=public.restaurant_ops_submit_payment_proof(
   'delibocados',v_id,'qa-split-proof-001','573001111333'
 );
 v_review:=public.restaurant_ops_review_payment_proof(
   'delibocados',(v_proof->>'id')::uuid,'approve','manager','owner'
 );
 IF v_review->>'payment_status'<>'cash_on_delivery'
 THEN RAISE EXCEPTION 'PARTIAL_BANK_PROOF_MISLABELLED_PAID'; END IF;
 SELECT * INTO v_split FROM public.restaurant_ops_split_payments
  WHERE company_id='delibocados' AND order_id=v_id;
 IF v_split.transfer_verified_cop<>18000 OR v_split.cash_collected_cop<>0
 THEN RAISE EXCEPTION 'PARTIAL_TRANSFER_AUDIT_INCORRECT';END IF;
 SELECT payment_status,version INTO v_paid,v_version
  FROM public.restaurant_ops_orders
  WHERE company_id='delibocados' AND id=v_id;
 IF v_paid<>'cash_on_delivery' THEN RAISE EXCEPTION 'ORDER_WRONGLY_FULLY_PAID';END IF;
 SELECT status INTO v_kitchen FROM public.restaurant_ops_kitchen_tickets
 WHERE company_id='delibocados' AND order_id=v_id;
 IF v_kitchen<>'queued' THEN RAISE EXCEPTION 'APPROVAL_DID_NOT_RELEASE_KITCHEN';END IF;
 BEGIN
   UPDATE public.restaurant_ops_orders SET status='completed'
    WHERE company_id='delibocados' AND id=v_id;
   RAISE EXCEPTION 'ORDER_COMPLETED_WITH_UNCOLLECTED_CASH';
 EXCEPTION WHEN others THEN
   IF SQLERRM<>'SPLIT_CASH_NOT_FULLY_COLLECTED' THEN RAISE;END IF;
 END;
 BEGIN
   PERFORM public.restaurant_ops_collect_split_cash(
    'delibocados',v_id,v_version,4000,'cashier','admin');
   RAISE EXCEPTION 'UNDERPAYMENT_WAS_RECORDED';
 EXCEPTION WHEN others THEN
   IF SQLERRM<>'CASH_AMOUNT_MISMATCH' THEN RAISE;END IF;
 END;
 PERFORM public.restaurant_ops_collect_split_cash(
  'delibocados',v_id,v_version,5000,'cashier','admin');
 SELECT * INTO v_split FROM public.restaurant_ops_split_payments
 WHERE company_id='delibocados' AND order_id=v_id;
 SELECT payment_status INTO v_paid FROM public.restaurant_ops_orders
 WHERE company_id='delibocados' AND id=v_id;
 IF v_paid<>'verified' OR v_split.cash_collected_cop<>5000
 THEN RAISE EXCEPTION 'CASH_SETTLEMENT_NOT_FULLY_RECONCILED';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.restaurant_ops_order_events
  WHERE company_id='delibocados' AND order_id=v_id
    AND event_type='split_cash_collected')
 THEN RAISE EXCEPTION 'MISSING_AUDIT_EVENT'; END IF;
 RAISE NOTICE 'SPLIT_ORDER_PROOF_KITCHEN_AND_CASH_RECONCILIATION_OK';
END $$;
ROLLBACK;
