-- Delibocados: persistent open table checks + optional QR customer phone.
-- Adds no POS360 transport. Must be installed before deploying API changes.
BEGIN;

ALTER TABLE public.restaurant_ops_orders ALTER COLUMN customer_phone DROP NOT NULL;
ALTER TABLE public.restaurant_ops_orders
 ADD CONSTRAINT restaurant_ops_missing_phone_qr_only
 CHECK (customer_phone IS NOT NULL OR source='qr');

CREATE TABLE public.restaurant_ops_table_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id text NOT NULL REFERENCES public.commerce_companies(id) ON DELETE CASCADE,
 qr_table_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 opened_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 closed_at timestamptz,
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,qr_table_id)
   REFERENCES public.restaurant_ops_qr_tables(company_id,id),
 CHECK((status='open' AND closed_at IS NULL) OR
       (status='closed' AND closed_at IS NOT NULL))
);
CREATE UNIQUE INDEX restaurant_ops_one_open_session_per_table
 ON public.restaurant_ops_table_sessions(company_id,qr_table_id)
 WHERE status='open';
CREATE INDEX restaurant_ops_table_sessions_lookup
 ON public.restaurant_ops_table_sessions(company_id,qr_table_id,opened_at DESC);

ALTER TABLE public.restaurant_ops_orders ADD COLUMN table_session_id uuid;
ALTER TABLE public.restaurant_ops_orders ADD CONSTRAINT restaurant_ops_order_session_fk
 FOREIGN KEY(company_id,table_session_id)
 REFERENCES public.restaurant_ops_table_sessions(company_id,id);
CREATE INDEX restaurant_ops_orders_by_table_session
 ON public.restaurant_ops_orders(company_id,table_session_id,created_at DESC);

ALTER TABLE public.restaurant_ops_table_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_ops_table_sessions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.restaurant_ops_table_sessions TO service_role;

-- Base validator historically requires a phone for every order, including
-- a QR order temporarily inserted as pickup inside its atomic transaction.
-- Accept NULL for source='qr' only; other sources retain their prior rules.
CREATE OR REPLACE FUNCTION public.restaurant_ops_create_order(
 p_company_id text, p_source text, p_source_key text,
 p_customer_phone text, p_customer_name text,
 p_fulfillment_mode text, p_items jsonb,
 p_zone_id uuid DEFAULT NULL, p_address text DEFAULT NULL,
 p_address_note text DEFAULT NULL, p_customer_note text DEFAULT NULL,
 p_pickup_due_at timestamptz DEFAULT NULL,
 p_actor_id text DEFAULT 'system', p_actor_role text DEFAULT 'system',
 p_customer_confirmed boolean DEFAULT false,
 p_expected_menu_revision integer DEFAULT NULL,
 p_payment_method text DEFAULT NULL,
 p_payment_status text DEFAULT 'pending'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 v_existing public.restaurant_ops_orders%ROWTYPE;
 v_order public.restaurant_ops_orders%ROWTYPE;
 v_product jsonb; v_line jsonb; v_catalog jsonb;
 v_revision integer; v_qty integer; v_price integer; v_subtotal bigint:=0;
 v_fee integer:=0; v_count integer:=0;
 v_name text; v_product_id text;
BEGIN
 IF p_customer_confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'CUSTOMER_CONFIRMATION_REQUIRED'; END IF;
 IF p_company_id IS NULL OR p_source NOT IN ('whatsapp','panel','web','qr','external')
   OR length(trim(coalesce(p_source_key,''))) NOT BETWEEN 8 AND 200
   OR (p_source<>'qr' AND coalesce(p_customer_phone,'') !~ '^[0-9]{8,15}
   OR length(trim(coalesce(p_customer_name,''))) NOT BETWEEN 2 AND 120
   OR p_fulfillment_mode NOT IN ('pickup','delivery')
   OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
   OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 60
 THEN RAISE EXCEPTION 'RESTAURANT_ORDER_INVALID'; END IF;
 SELECT * INTO v_existing FROM public.restaurant_ops_orders
 WHERE company_id=p_company_id AND source_key=p_source_key;
 IF FOUND THEN
   IF v_existing.customer_phone IS DISTINCT FROM p_customer_phone
    OR v_existing.customer_name <> trim(p_customer_name)
    OR v_existing.fulfillment_mode <> p_fulfillment_mode
   THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
   RETURN to_jsonb(v_existing);
 END IF;

 SELECT payload,revision INTO v_catalog,v_revision
 FROM public.restaurant_menu_documents WHERE company_id=p_company_id;
 IF v_catalog IS NULL THEN RAISE EXCEPTION 'RESTAURANT_MENU_NOT_AVAILABLE'; END IF;
 IF p_expected_menu_revision IS NOT NULL AND v_revision IS DISTINCT FROM p_expected_menu_revision
 THEN RAISE EXCEPTION 'MENU_REVISION_CHANGED'; END IF;
 IF p_payment_status NOT IN ('pending','cash_on_delivery')
   OR (p_payment_status='cash_on_delivery' AND p_payment_method <> 'cash')
 THEN RAISE EXCEPTION 'INVALID_INITIAL_PAYMENT'; END IF;


 IF p_fulfillment_mode='delivery' THEN
   IF length(trim(coalesce(p_address,''))) < 8 OR p_zone_id IS NULL
   THEN RAISE EXCEPTION 'DELIVERY_ADDRESS_AND_ZONE_REQUIRED'; END IF;
   SELECT fee_cop INTO v_fee FROM public.restaurant_ops_zones
     WHERE company_id=p_company_id AND id=p_zone_id AND active=true;
   IF NOT FOUND THEN RAISE EXCEPTION 'DELIVERY_ZONE_UNVERIFIED'; END IF;
 ELSE
   IF p_zone_id IS NOT NULL THEN RAISE EXCEPTION 'PICKUP_MUST_NOT_HAVE_ZONE'; END IF;
 END IF;

 FOR v_line IN SELECT value FROM jsonb_array_elements(p_items) LOOP
   v_product_id:=v_line->>'productId';
   IF v_product_id IS NULL OR length(v_product_id)>100 OR
      coalesce(v_line->>'quantity','') !~ '^[0-9]+$'
   THEN RAISE EXCEPTION 'INVALID_MENU_LINE'; END IF;
   v_qty:=(v_line->>'quantity')::integer;
   IF v_qty NOT BETWEEN 1 AND 25 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
   IF length(coalesce(v_line->>'instructions',''))>500
   THEN RAISE EXCEPTION 'INSTRUCTIONS_TOO_LONG'; END IF;
   SELECT value INTO v_product FROM jsonb_array_elements(v_catalog->'products')
   WHERE value->>'id'=v_product_id LIMIT 1;
   IF NOT FOUND OR v_product->>'available'='false'
      OR v_product->>'priceNeedsReview'='true'
      OR coalesce(v_product->>'priceCOP','') !~ '^[0-9]+$'
   THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE_OR_PRICE_UNVERIFIED'; END IF;
   v_price:=(v_product->>'priceCOP')::integer;
   v_name:=v_product->>'name';
   IF v_price>999999999 OR length(trim(coalesce(v_name,'')))=0
   THEN RAISE EXCEPTION 'INVALID_CATALOG_PRICE'; END IF;
   v_subtotal:=v_subtotal+v_qty::bigint*v_price;
   v_count:=v_count+1;
 END LOOP;
 IF v_subtotal>999999999 THEN RAISE EXCEPTION 'ORDER_TOTAL_TOO_LARGE'; END IF;

 INSERT INTO public.restaurant_ops_orders(
   company_id,source,source_key,customer_phone,customer_name,
   fulfillment_mode,subtotal_cop,delivery_fee_cop,zone_id,address,
   address_note,customer_note,pickup_due_at,menu_revision,payment_method,payment_status
 ) VALUES (
   p_company_id,p_source,p_source_key,p_customer_phone,trim(p_customer_name),
   p_fulfillment_mode,v_subtotal::integer,v_fee,
   CASE WHEN p_fulfillment_mode='delivery' THEN p_zone_id ELSE NULL END,
   CASE WHEN p_fulfillment_mode='delivery' THEN trim(p_address) ELSE NULL END,
   left(coalesce(p_address_note,''),500),left(coalesce(p_customer_note,''),2000),
   p_pickup_due_at,v_revision,p_payment_method,p_payment_status
 ) ON CONFLICT (company_id,source_key) DO NOTHING RETURNING * INTO v_order;
 IF v_order.id IS NULL THEN
   SELECT * INTO v_order FROM public.restaurant_ops_orders
   WHERE company_id=p_company_id AND source_key=p_source_key;
   RETURN to_jsonb(v_order);
 END IF;
 FOR v_line IN SELECT value FROM jsonb_array_elements(p_items) LOOP
   v_product_id:=v_line->>'productId';
   SELECT value INTO v_product FROM jsonb_array_elements(v_catalog->'products')
   WHERE value->>'id'=v_product_id LIMIT 1;
   INSERT INTO public.restaurant_ops_order_items(
     company_id,order_id,product_id,product_name,quantity,unit_price_cop,instructions
   ) VALUES(
     p_company_id,v_order.id,v_product_id,v_product->>'name',
     (v_line->>'quantity')::integer,(v_product->>'priceCOP')::integer,
     coalesce(v_line->>'instructions','')
   );
 END LOOP;
 INSERT INTO public.restaurant_ops_kitchen_tickets(company_id,order_id)
 VALUES(p_company_id,v_order.id);
 INSERT INTO public.restaurant_ops_order_events(company_id,order_id,event_type,actor_id,actor_role,next_status,details)
 VALUES(p_company_id,v_order.id,'order_confirmed',p_actor_id,p_actor_role,'confirmed',
 jsonb_build_object('source',p_source,'items',v_count,'fulfillment',p_fulfillment_mode));
 INSERT INTO public.restaurant_ops_outbox(company_id,order_id,kind,payload)
 VALUES(p_company_id,v_order.id,'order_confirmed',jsonb_build_object('order_id',v_order.id));
 RETURN to_jsonb(v_order);
END $$;

)
   OR (p_source='qr' AND p_customer_phone IS NOT NULL AND p_customer_phone !~ '^[0-9]{8,15}
   OR length(trim(coalesce(p_customer_name,''))) NOT BETWEEN 2 AND 120
   OR p_fulfillment_mode NOT IN ('pickup','delivery')
   OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
   OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 60
 THEN RAISE EXCEPTION 'RESTAURANT_ORDER_INVALID'; END IF;
 SELECT * INTO v_existing FROM public.restaurant_ops_orders
 WHERE company_id=p_company_id AND source_key=p_source_key;
 IF FOUND THEN
   IF v_existing.customer_phone <> p_customer_phone
    OR v_existing.customer_name <> trim(p_customer_name)
    OR v_existing.fulfillment_mode <> p_fulfillment_mode
   THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
   RETURN to_jsonb(v_existing);
 END IF;

 SELECT payload,revision INTO v_catalog,v_revision
 FROM public.restaurant_menu_documents WHERE company_id=p_company_id;
 IF v_catalog IS NULL THEN RAISE EXCEPTION 'RESTAURANT_MENU_NOT_AVAILABLE'; END IF;
 IF p_expected_menu_revision IS NOT NULL AND v_revision IS DISTINCT FROM p_expected_menu_revision
 THEN RAISE EXCEPTION 'MENU_REVISION_CHANGED'; END IF;
 IF p_payment_status NOT IN ('pending','cash_on_delivery')
   OR (p_payment_status='cash_on_delivery' AND p_payment_method <> 'cash')
 THEN RAISE EXCEPTION 'INVALID_INITIAL_PAYMENT'; END IF;


 IF p_fulfillment_mode='delivery' THEN
   IF length(trim(coalesce(p_address,''))) < 8 OR p_zone_id IS NULL
   THEN RAISE EXCEPTION 'DELIVERY_ADDRESS_AND_ZONE_REQUIRED'; END IF;
   SELECT fee_cop INTO v_fee FROM public.restaurant_ops_zones
     WHERE company_id=p_company_id AND id=p_zone_id AND active=true;
   IF NOT FOUND THEN RAISE EXCEPTION 'DELIVERY_ZONE_UNVERIFIED'; END IF;
 ELSE
   IF p_zone_id IS NOT NULL THEN RAISE EXCEPTION 'PICKUP_MUST_NOT_HAVE_ZONE'; END IF;
 END IF;

 FOR v_line IN SELECT value FROM jsonb_array_elements(p_items) LOOP
   v_product_id:=v_line->>'productId';
   IF v_product_id IS NULL OR length(v_product_id)>100 OR
      coalesce(v_line->>'quantity','') !~ '^[0-9]+$'
   THEN RAISE EXCEPTION 'INVALID_MENU_LINE'; END IF;
   v_qty:=(v_line->>'quantity')::integer;
   IF v_qty NOT BETWEEN 1 AND 25 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
   IF length(coalesce(v_line->>'instructions',''))>500
   THEN RAISE EXCEPTION 'INSTRUCTIONS_TOO_LONG'; END IF;
   SELECT value INTO v_product FROM jsonb_array_elements(v_catalog->'products')
   WHERE value->>'id'=v_product_id LIMIT 1;
   IF NOT FOUND OR v_product->>'available'='false'
      OR v_product->>'priceNeedsReview'='true'
      OR coalesce(v_product->>'priceCOP','') !~ '^[0-9]+$'
   THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE_OR_PRICE_UNVERIFIED'; END IF;
   v_price:=(v_product->>'priceCOP')::integer;
   v_name:=v_product->>'name';
   IF v_price>999999999 OR length(trim(coalesce(v_name,'')))=0
   THEN RAISE EXCEPTION 'INVALID_CATALOG_PRICE'; END IF;
   v_subtotal:=v_subtotal+v_qty::bigint*v_price;
   v_count:=v_count+1;
 END LOOP;
 IF v_subtotal>999999999 THEN RAISE EXCEPTION 'ORDER_TOTAL_TOO_LARGE'; END IF;

 INSERT INTO public.restaurant_ops_orders(
   company_id,source,source_key,customer_phone,customer_name,
   fulfillment_mode,subtotal_cop,delivery_fee_cop,zone_id,address,
   address_note,customer_note,pickup_due_at,menu_revision,payment_method,payment_status
 ) VALUES (
   p_company_id,p_source,p_source_key,p_customer_phone,trim(p_customer_name),
   p_fulfillment_mode,v_subtotal::integer,v_fee,
   CASE WHEN p_fulfillment_mode='delivery' THEN p_zone_id ELSE NULL END,
   CASE WHEN p_fulfillment_mode='delivery' THEN trim(p_address) ELSE NULL END,
   left(coalesce(p_address_note,''),500),left(coalesce(p_customer_note,''),2000),
   p_pickup_due_at,v_revision,p_payment_method,p_payment_status
 ) ON CONFLICT (company_id,source_key) DO NOTHING RETURNING * INTO v_order;
 IF v_order.id IS NULL THEN
   SELECT * INTO v_order FROM public.restaurant_ops_orders
   WHERE company_id=p_company_id AND source_key=p_source_key;
   RETURN to_jsonb(v_order);
 END IF;
 FOR v_line IN SELECT value FROM jsonb_array_elements(p_items) LOOP
   v_product_id:=v_line->>'productId';
   SELECT value INTO v_product FROM jsonb_array_elements(v_catalog->'products')
   WHERE value->>'id'=v_product_id LIMIT 1;
   INSERT INTO public.restaurant_ops_order_items(
     company_id,order_id,product_id,product_name,quantity,unit_price_cop,instructions
   ) VALUES(
     p_company_id,v_order.id,v_product_id,v_product->>'name',
     (v_line->>'quantity')::integer,(v_product->>'priceCOP')::integer,
     coalesce(v_line->>'instructions','')
   );
 END LOOP;
 INSERT INTO public.restaurant_ops_kitchen_tickets(company_id,order_id)
 VALUES(p_company_id,v_order.id);
 INSERT INTO public.restaurant_ops_order_events(company_id,order_id,event_type,actor_id,actor_role,next_status,details)
 VALUES(p_company_id,v_order.id,'order_confirmed',p_actor_id,p_actor_role,'confirmed',
 jsonb_build_object('source',p_source,'items',v_count,'fulfillment',p_fulfillment_mode));
 INSERT INTO public.restaurant_ops_outbox(company_id,order_id,kind,payload)
 VALUES(p_company_id,v_order.id,'order_confirmed',jsonb_build_object('order_id',v_order.id));
 RETURN to_jsonb(v_order);
END $$;

)
   OR length(trim(coalesce(p_customer_name,''))) NOT BETWEEN 2 AND 120
   OR p_fulfillment_mode NOT IN ('pickup','delivery')
   OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
   OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 60
 THEN RAISE EXCEPTION 'RESTAURANT_ORDER_INVALID'; END IF;
 SELECT * INTO v_existing FROM public.restaurant_ops_orders
 WHERE company_id=p_company_id AND source_key=p_source_key;
 IF FOUND THEN
   IF v_existing.customer_phone <> p_customer_phone
    OR v_existing.customer_name <> trim(p_customer_name)
    OR v_existing.fulfillment_mode <> p_fulfillment_mode
   THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
   RETURN to_jsonb(v_existing);
 END IF;

 SELECT payload,revision INTO v_catalog,v_revision
 FROM public.restaurant_menu_documents WHERE company_id=p_company_id;
 IF v_catalog IS NULL THEN RAISE EXCEPTION 'RESTAURANT_MENU_NOT_AVAILABLE'; END IF;
 IF p_expected_menu_revision IS NOT NULL AND v_revision IS DISTINCT FROM p_expected_menu_revision
 THEN RAISE EXCEPTION 'MENU_REVISION_CHANGED'; END IF;
 IF p_payment_status NOT IN ('pending','cash_on_delivery')
   OR (p_payment_status='cash_on_delivery' AND p_payment_method <> 'cash')
 THEN RAISE EXCEPTION 'INVALID_INITIAL_PAYMENT'; END IF;


 IF p_fulfillment_mode='delivery' THEN
   IF length(trim(coalesce(p_address,''))) < 8 OR p_zone_id IS NULL
   THEN RAISE EXCEPTION 'DELIVERY_ADDRESS_AND_ZONE_REQUIRED'; END IF;
   SELECT fee_cop INTO v_fee FROM public.restaurant_ops_zones
     WHERE company_id=p_company_id AND id=p_zone_id AND active=true;
   IF NOT FOUND THEN RAISE EXCEPTION 'DELIVERY_ZONE_UNVERIFIED'; END IF;
 ELSE
   IF p_zone_id IS NOT NULL THEN RAISE EXCEPTION 'PICKUP_MUST_NOT_HAVE_ZONE'; END IF;
 END IF;

 FOR v_line IN SELECT value FROM jsonb_array_elements(p_items) LOOP
   v_product_id:=v_line->>'productId';
   IF v_product_id IS NULL OR length(v_product_id)>100 OR
      coalesce(v_line->>'quantity','') !~ '^[0-9]+$'
   THEN RAISE EXCEPTION 'INVALID_MENU_LINE'; END IF;
   v_qty:=(v_line->>'quantity')::integer;
   IF v_qty NOT BETWEEN 1 AND 25 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
   IF length(coalesce(v_line->>'instructions',''))>500
   THEN RAISE EXCEPTION 'INSTRUCTIONS_TOO_LONG'; END IF;
   SELECT value INTO v_product FROM jsonb_array_elements(v_catalog->'products')
   WHERE value->>'id'=v_product_id LIMIT 1;
   IF NOT FOUND OR v_product->>'available'='false'
      OR v_product->>'priceNeedsReview'='true'
      OR coalesce(v_product->>'priceCOP','') !~ '^[0-9]+$'
   THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE_OR_PRICE_UNVERIFIED'; END IF;
   v_price:=(v_product->>'priceCOP')::integer;
   v_name:=v_product->>'name';
   IF v_price>999999999 OR length(trim(coalesce(v_name,'')))=0
   THEN RAISE EXCEPTION 'INVALID_CATALOG_PRICE'; END IF;
   v_subtotal:=v_subtotal+v_qty::bigint*v_price;
   v_count:=v_count+1;
 END LOOP;
 IF v_subtotal>999999999 THEN RAISE EXCEPTION 'ORDER_TOTAL_TOO_LARGE'; END IF;

 INSERT INTO public.restaurant_ops_orders(
   company_id,source,source_key,customer_phone,customer_name,
   fulfillment_mode,subtotal_cop,delivery_fee_cop,zone_id,address,
   address_note,customer_note,pickup_due_at,menu_revision,payment_method,payment_status
 ) VALUES (
   p_company_id,p_source,p_source_key,p_customer_phone,trim(p_customer_name),
   p_fulfillment_mode,v_subtotal::integer,v_fee,
   CASE WHEN p_fulfillment_mode='delivery' THEN p_zone_id ELSE NULL END,
   CASE WHEN p_fulfillment_mode='delivery' THEN trim(p_address) ELSE NULL END,
   left(coalesce(p_address_note,''),500),left(coalesce(p_customer_note,''),2000),
   p_pickup_due_at,v_revision,p_payment_method,p_payment_status
 ) ON CONFLICT (company_id,source_key) DO NOTHING RETURNING * INTO v_order;
 IF v_order.id IS NULL THEN
   SELECT * INTO v_order FROM public.restaurant_ops_orders
   WHERE company_id=p_company_id AND source_key=p_source_key;
   RETURN to_jsonb(v_order);
 END IF;
 FOR v_line IN SELECT value FROM jsonb_array_elements(p_items) LOOP
   v_product_id:=v_line->>'productId';
   SELECT value INTO v_product FROM jsonb_array_elements(v_catalog->'products')
   WHERE value->>'id'=v_product_id LIMIT 1;
   INSERT INTO public.restaurant_ops_order_items(
     company_id,order_id,product_id,product_name,quantity,unit_price_cop,instructions
   ) VALUES(
     p_company_id,v_order.id,v_product_id,v_product->>'name',
     (v_line->>'quantity')::integer,(v_product->>'priceCOP')::integer,
     coalesce(v_line->>'instructions','')
   );
 END LOOP;
 INSERT INTO public.restaurant_ops_kitchen_tickets(company_id,order_id)
 VALUES(p_company_id,v_order.id);
 INSERT INTO public.restaurant_ops_order_events(company_id,order_id,event_type,actor_id,actor_role,next_status,details)
 VALUES(p_company_id,v_order.id,'order_confirmed',p_actor_id,p_actor_role,'confirmed',
 jsonb_build_object('source',p_source,'items',v_count,'fulfillment',p_fulfillment_mode));
 INSERT INTO public.restaurant_ops_outbox(company_id,order_id,kind,payload)
 VALUES(p_company_id,v_order.id,'order_confirmed',jsonb_build_object('order_id',v_order.id));
 RETURN to_jsonb(v_order);
END $$;



-- Every new QR order joins the current table session; repeat visits create
-- another order/ticket without reprinting earlier items. No public PII.
CREATE OR REPLACE FUNCTION public.restaurant_ops_create_qr_order(
 p_company_id text,p_source_key text,p_qr_kind text,p_qr_token text,
 p_table_id uuid,p_customer_phone text,p_customer_name text,
 p_items jsonb,p_expected_menu_revision integer,
 p_payment_method text,p_payment_status text,
 p_customer_confirmed boolean,p_customer_note text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_order jsonb;
 v_existing public.restaurant_ops_orders%ROWTYPE;
 v_table public.restaurant_ops_qr_tables%ROWTYPE;
 v_hash text;v_fingerprint text;
 v_session_id uuid;
BEGIN
 IF p_company_id<>'delibocados' OR p_qr_kind NOT IN ('table','general')
   OR p_customer_confirmed IS DISTINCT FROM true
   OR p_qr_token IS NULL OR length(p_qr_token) NOT BETWEEN 32 AND 200
   OR p_qr_token !~ '^[A-Za-z0-9_-]+$'
 THEN RAISE EXCEPTION 'QR_CHECKOUT_NOT_AUTHORIZED'; END IF;
 v_hash:=encode(sha256(convert_to(p_qr_token,'UTF8')),'hex');
 v_fingerprint:=encode(sha256(convert_to(jsonb_build_object(
   'items',p_items,'note',p_customer_note,
   'payment_method',p_payment_method,'payment_status',p_payment_status,
   'revision',p_expected_menu_revision
 )::text,'UTF8')),'hex');
 SELECT * INTO v_table FROM public.restaurant_ops_qr_tables
 WHERE company_id=p_company_id AND id=p_table_id AND enabled=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'QR_TABLE_DISABLED'; END IF;
 IF p_qr_kind='table' THEN
   IF v_table.qr_token_sha256<>v_hash THEN
     RAISE EXCEPTION 'QR_TOKEN_INVALID'; END IF;
 ELSE
   IF NOT EXISTS(SELECT 1 FROM public.restaurant_ops_qr_general
      WHERE company_id=p_company_id AND enabled=true AND qr_token_sha256=v_hash)
   THEN RAISE EXCEPTION 'QR_GENERAL_DISABLED_OR_TOKEN_INVALID'; END IF;
 END IF;
 -- Per-tenant/per-source-key serialization prevents concurrent duplicate
 -- calls from racing between the existing-order check and native checkout.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_company_id||':qr:'||
   coalesce(p_source_key,''),0));
 SELECT * INTO v_existing FROM public.restaurant_ops_orders
 WHERE company_id=p_company_id AND source_key=p_source_key FOR UPDATE;
 IF FOUND THEN
   IF v_existing.source<>'qr' OR v_existing.fulfillment_mode<>'dine_in'
    OR v_existing.qr_table_id<>p_table_id OR v_existing.qr_kind<>p_qr_kind
    OR v_existing.customer_phone IS DISTINCT FROM p_customer_phone
    OR v_existing.customer_name<>trim(p_customer_name)
    OR v_existing.qr_checkout_fingerprint<>v_fingerprint
   THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
   RETURN to_jsonb(v_existing);
 END IF;
 -- Existing menu validator only supports pickup/delivery. Create as
 -- pickup, then bind the validated table inside THE SAME transaction.
 -- Any error after the creation rolls back the ticket, event and order.
 v_order:=public.restaurant_ops_create_order(
   p_company_id=>p_company_id,p_source=>'qr',p_source_key=>p_source_key,
   p_customer_phone=>p_customer_phone,p_customer_name=>p_customer_name,
   p_fulfillment_mode=>'pickup',p_items=>p_items,p_zone_id=>NULL,
   p_address=>NULL,p_address_note=>NULL,p_customer_note=>p_customer_note,
   p_pickup_due_at=>NULL,p_actor_id=>'qr-checkout',p_actor_role=>'system',
   p_customer_confirmed=>true,
   p_expected_menu_revision=>p_expected_menu_revision,
   p_payment_method=>p_payment_method,p_payment_status=>p_payment_status
 );
 -- Upsert the one OPEN check for this verified table. Different QR orders
 -- create separate kitchen tickets but share this check until staff closes it.
 INSERT INTO public.restaurant_ops_table_sessions(company_id,qr_table_id,status)
 VALUES(p_company_id,p_table_id,'open')
 ON CONFLICT(company_id,qr_table_id) WHERE status='open'
 DO UPDATE SET updated_at=now()
 RETURNING id INTO v_session_id;
 UPDATE public.restaurant_ops_orders SET
   table_session_id=v_session_id,
   fulfillment_mode='dine_in',qr_table_id=p_table_id,qr_kind=p_qr_kind,
   qr_checkout_fingerprint=v_fingerprint,
   updated_at=now()
 WHERE company_id=p_company_id AND id=(v_order->>'id')::uuid
 RETURNING to_jsonb(restaurant_ops_orders.*) INTO v_order;
 INSERT INTO public.restaurant_ops_order_events(
  company_id,order_id,event_type,actor_id,actor_role,details)
 VALUES(p_company_id,(v_order->>'id')::uuid,
  'qr_dine_in_verified','qr-checkout','system',
  jsonb_build_object('qr_kind',p_qr_kind,'qr_table_id',p_table_id));
 RETURN v_order;
END $$;



CREATE FUNCTION public.restaurant_ops_close_table_session(
 p_company_id text, p_session_id uuid, p_actor_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_session public.restaurant_ops_table_sessions%ROWTYPE;
 v_unpaid integer;
 v_unfinished integer;
BEGIN
 IF p_company_id<>'delibocados' OR p_session_id IS NULL OR
    length(trim(coalesce(p_actor_id,'')))<1 THEN
   RAISE EXCEPTION 'INVALID_TABLE_CLOSE_REQUEST';
 END IF;
 SELECT * INTO v_session FROM public.restaurant_ops_table_sessions
 WHERE company_id=p_company_id AND id=p_session_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TABLE_SESSION_NOT_FOUND'; END IF;
 IF v_session.status='closed' THEN RETURN to_jsonb(v_session); END IF;
 SELECT count(*) FILTER(WHERE status NOT IN ('completed','cancelled')),
        count(*) FILTER(WHERE status<>'cancelled' AND payment_status<>'verified')
 INTO v_unfinished,v_unpaid
 FROM public.restaurant_ops_orders
 WHERE company_id=p_company_id AND table_session_id=p_session_id;
 IF coalesce(v_unfinished,0)>0 OR coalesce(v_unpaid,0)>0
 THEN RAISE EXCEPTION 'TABLE_HAS_UNFINISHED_OR_UNPAID_ORDERS'; END IF;
 UPDATE public.restaurant_ops_table_sessions
 SET status='closed',closed_at=now(),updated_at=now()
 WHERE company_id=p_company_id AND id=p_session_id
 RETURNING * INTO v_session;
 RETURN to_jsonb(v_session);
END $$;
REVOKE ALL ON FUNCTION public.restaurant_ops_close_table_session(text,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_ops_close_table_session(text,uuid,text)
 TO service_role;

INSERT INTO public.commerce_schema_migrations(version,description)
VALUES('20261116103000','Delibocados optional QR phone and open table sessions')
ON CONFLICT(version) DO NOTHING;
COMMIT;
