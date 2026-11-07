-- SQL smoke after 20261107103000 and 20261107124500. Nothing persists.
BEGIN;
DO $$
DECLARE
  v_order uuid; v_count integer;
BEGIN
  INSERT INTO public.restaurant_ops_orders(
    company_id,source,source_key,customer_phone,customer_name,
    fulfillment_mode,payment_status,payment_method,subtotal_cop,delivery_fee_cop
  ) VALUES(
    'delibocados','whatsapp','support-smoke-order-20261107','573111234567','QA Cliente',
    'pickup','cash_on_delivery','cash',38000,0
  ) RETURNING id INTO v_order;
  INSERT INTO public.restaurant_ops_order_items(
    company_id,order_id,product_id,product_name,quantity,unit_price_cop
  ) VALUES('delibocados',v_order,'burger','Hamburguesa Doble Mixta',2,19000);
  IF NOT EXISTS(
    SELECT 1 FROM public.restaurant_ops_customer_order_profiles
    WHERE company_id='delibocados' AND customer_phone='573111234567'
      AND last_confirmed_delivery_address IS NULL AND last_payment_method='cash'
  ) THEN RAISE EXCEPTION 'CUSTOMER_PROFILE_VIEW_INCORRECT'; END IF;

  INSERT INTO public.restaurant_ops_incidents(
    company_id,order_id,category,severity,description,actor_id,source,
    customer_phone,reported_item_id,reported_item_name,received_item_description,
    source_message_id
  ) VALUES(
    'delibocados',v_order,'wrong_item','high',
    'Cliente recibió un artículo diferente','restaurant-ai','whatsapp',
    '573111234567','burger','Hamburguesa Doble Mixta','Recibió salchipapas',
    'qa-whatsapp-message-1'
  );
  INSERT INTO public.restaurant_ops_incidents(
    company_id,order_id,category,severity,description,actor_id,source,
    customer_phone,reported_item_id,reported_item_name,source_message_id
  ) VALUES(
    'delibocados',v_order,'wrong_item','high','Intento duplicado','restaurant-ai',
    'whatsapp','573111234567','burger','Hamburguesa Doble Mixta',
    'qa-whatsapp-message-1'
  ) ON CONFLICT(company_id,source_message_id) DO NOTHING;
  SELECT count(*) INTO v_count FROM public.restaurant_ops_incidents
    WHERE company_id='delibocados' AND source_message_id='qa-whatsapp-message-1';
  IF v_count<>1 THEN RAISE EXCEPTION 'CLAIM_WEBHOOK_DUPLICATED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE
    oid='public.restaurant_ops_customer_order_profiles'::regclass) THEN
    RAISE EXCEPTION 'CUSTOMER_PROFILE_VIEW_MISSING';
  END IF;
  RAISE NOTICE 'RESTAURANT_CUSTOMER_HISTORY_CLAIMS_SQL_SMOKE_OK';
END $$;
ROLLBACK;
