-- Restaurant OS v1. Independent from retail/stock workflows; no external POS writes.
BEGIN;

CREATE TABLE IF NOT EXISTS public.restaurant_ops_zones (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id text NOT NULL REFERENCES public.commerce_companies(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 100),
 fee_cop integer NOT NULL CHECK (fee_cop BETWEEN 0 AND 1000000),
 eta_minutes integer NOT NULL CHECK (eta_minutes BETWEEN 1 AND 240),
 priority integer NOT NULL DEFAULT 100,
 geojson jsonb,
 active boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,name),
 UNIQUE(company_id,id)
);
CREATE TABLE IF NOT EXISTS public.restaurant_ops_couriers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id text NOT NULL REFERENCES public.commerce_companies(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
 phone text NOT NULL CHECK (phone ~ '^[0-9]{8,15}$'),
 vehicle text NOT NULL CHECK (vehicle IN ('bike','motorbike')),
 availability text NOT NULL DEFAULT 'offline'
    CHECK (availability IN ('offline','available','busy')),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,phone),
 UNIQUE(company_id,id)
);
CREATE TABLE IF NOT EXISTS public.restaurant_ops_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 company_id text NOT NULL REFERENCES public.commerce_companies(id) ON DELETE CASCADE,
 source text NOT NULL CHECK(source IN ('whatsapp','panel','web','qr','external')),
 source_key text NOT NULL CHECK(length(trim(source_key)) BETWEEN 8 AND 200),
 customer_phone text NOT NULL CHECK(customer_phone ~ '^[0-9]{8,15}$'),
 customer_name text NOT NULL CHECK(length(trim(customer_name)) BETWEEN 2 AND 120),
 fulfillment_mode text NOT NULL CHECK(fulfillment_mode IN ('pickup','delivery')),
 status text NOT NULL DEFAULT 'confirmed'
    CHECK(status IN ('confirmed','preparing','ready','out_for_delivery','completed','cancelled')),
 payment_status text NOT NULL DEFAULT 'pending'
    CHECK(payment_status IN ('pending','proof_submitted','verified','cash_on_delivery','refunded')),
 payment_method text,
 subtotal_cop integer NOT NULL CHECK(subtotal_cop >= 0),
 delivery_fee_cop integer NOT NULL CHECK(delivery_fee_cop >= 0),
 total_cop integer GENERATED ALWAYS AS (subtotal_cop + delivery_fee_cop) STORED,
 zone_id uuid,
 address text,
 address_note text,
 pickup_due_at timestamptz,
 customer_note text,
 menu_revision integer,
 courier_id uuid,
 accepted_at timestamptz NOT NULL DEFAULT now(),
 preparing_at timestamptz,
 ready_at timestamptz,
 handed_off_at timestamptz,
 completed_at timestamptz,
 cancelled_at timestamptz,
 version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,source_key),
 UNIQUE(company_id,id),
 FOREIGN KEY(company_id,zone_id) REFERENCES public.restaurant_ops_zones(company_id,id),
 FOREIGN KEY(company_id,courier_id) REFERENCES public.restaurant_ops_couriers(company_id,id),
 CHECK(fulfillment_mode <> 'pickup' OR (delivery_fee_cop=0 AND zone_id IS NULL AND courier_id IS NULL)),
 CHECK(fulfillment_mode <> 'delivery' OR (zone_id IS NOT NULL AND length(trim(coalesce(address,''))) >= 8))
);
CREATE INDEX IF NOT EXISTS restaurant_ops_orders_queue_idx
 ON public.restaurant_ops_orders(company_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS restaurant_ops_orders_customer_idx
 ON public.restaurant_ops_orders(company_id,customer_phone,created_at DESC);

CREATE TABLE IF NOT EXISTS public.restaurant_ops_order_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id text NOT NULL,
 order_id uuid NOT NULL,
 product_id text NOT NULL,
 product_name text NOT NULL,
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 25),
 unit_price_cop integer NOT NULL CHECK(unit_price_cop >= 0),
 line_total_cop integer GENERATED ALWAYS AS (quantity * unit_price_cop) STORED,
 instructions text NOT NULL DEFAULT '',
 FOREIGN KEY(company_id,order_id) REFERENCES public.restaurant_ops_orders(company_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS restaurant_ops_items_order_idx
 ON public.restaurant_ops_order_items(company_id,order_id);

CREATE TABLE IF NOT EXISTS public.restaurant_ops_kitchen_tickets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id text NOT NULL,
 order_id uuid NOT NULL,
 station text NOT NULL DEFAULT 'general',
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','working','ready','cancelled')),
 queued_at timestamptz NOT NULL DEFAULT now(),
 started_at timestamptz,
 ready_at timestamptz,
 printed_at timestamptz,
 FOREIGN KEY(company_id,order_id) REFERENCES public.restaurant_ops_orders(company_id,id) ON DELETE CASCADE,
 UNIQUE(company_id,order_id)
);
CREATE TABLE IF NOT EXISTS public.restaurant_ops_order_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 company_id text NOT NULL,
 order_id uuid NOT NULL,
 event_type text NOT NULL,
 actor_id text NOT NULL,
 actor_role text NOT NULL,
 previous_status text,
 next_status text,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(company_id,order_id) REFERENCES public.restaurant_ops_orders(company_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS restaurant_ops_events_order_idx
 ON public.restaurant_ops_order_events(company_id,order_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.restaurant_ops_incidents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id text NOT NULL,
 order_id uuid NOT NULL,
 category text NOT NULL CHECK(category IN
  ('late','wrong_item','missing_item','allergy','payment','address','courier','technical','other')),
 severity text NOT NULL DEFAULT 'normal' CHECK(severity IN ('normal','high','critical')),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
 description text NOT NULL CHECK(length(trim(description)) BETWEEN 5 AND 2000),
 resolution text,
 actor_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz,
 FOREIGN KEY(company_id,order_id) REFERENCES public.restaurant_ops_orders(company_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS restaurant_ops_incidents_status_idx
 ON public.restaurant_ops_incidents(company_id,status,created_at DESC);
CREATE TABLE IF NOT EXISTS public.restaurant_ops_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id text NOT NULL,
 order_id uuid NOT NULL,
 kind text NOT NULL,
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed','suppressed')),
 attempts integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 FOREIGN KEY(company_id,order_id) REFERENCES public.restaurant_ops_orders(company_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS restaurant_ops_outbox_idx
 ON public.restaurant_ops_outbox(company_id,status,created_at);

-- Fail closed for browser clients; only the backend's service role accesses operational data.
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY[
 'restaurant_ops_zones','restaurant_ops_couriers','restaurant_ops_orders',
 'restaurant_ops_order_items','restaurant_ops_kitchen_tickets',
 'restaurant_ops_order_events','restaurant_ops_incidents','restaurant_ops_outbox'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated',t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role',t);
 END LOOP;
END $$;

-- Never mark zones as active from screenshots. Real polygons/addresses require verification.
INSERT INTO public.restaurant_ops_zones(company_id,name,fee_cop,eta_minutes,priority)
SELECT 'delibocados', x.name, x.fee, x.eta, x.priority
FROM (VALUES
 ('200M',1000,25,1),('400M',2000,30,2),('500M',2500,35,3),
 ('600M',3000,40,4),('1K',3500,45,5),('1.5K',4000,45,6),
 ('1.7K',4500,45,7),('3K',7000,50,8),('SIBERIA',10000,60,9)
) AS x(name,fee,eta,priority)
WHERE EXISTS (SELECT 1 FROM public.commerce_companies WHERE id='delibocados')
ON CONFLICT(company_id,name) DO NOTHING;

-- Single atomic, idempotent order create. Prices originate exclusively from the published restaurant menu.
CREATE OR REPLACE FUNCTION public.restaurant_ops_create_order(
 p_company_id text, p_source text, p_source_key text,
 p_customer_phone text, p_customer_name text,
 p_fulfillment_mode text, p_items jsonb,
 p_zone_id uuid DEFAULT NULL, p_address text DEFAULT NULL,
 p_address_note text DEFAULT NULL, p_customer_note text DEFAULT NULL,
 p_pickup_due_at timestamptz DEFAULT NULL,
 p_actor_id text DEFAULT 'system', p_actor_role text DEFAULT 'system',
 p_customer_confirmed boolean DEFAULT false
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
   OR coalesce(p_customer_phone,'') !~ '^[0-9]{8,15}$'
   OR length(trim(coalesce(p_customer_name,''))) NOT BETWEEN 2 AND 120
   OR p_fulfillment_mode NOT IN ('pickup','delivery')
   OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
   OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 60
 THEN RAISE EXCEPTION 'RESTAURANT_ORDER_INVALID'; END IF;
 SELECT * INTO v_existing FROM public.restaurant_ops_orders
 WHERE company_id=p_company_id AND source_key=p_source_key;
 IF FOUND THEN RETURN to_jsonb(v_existing); END IF;

 SELECT payload,revision INTO v_catalog,v_revision
 FROM public.restaurant_menu_documents WHERE company_id=p_company_id;
 IF v_catalog IS NULL THEN RAISE EXCEPTION 'RESTAURANT_MENU_NOT_AVAILABLE'; END IF;

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
   address_note,customer_note,pickup_due_at,menu_revision
 ) VALUES (
   p_company_id,p_source,p_source_key,p_customer_phone,trim(p_customer_name),
   p_fulfillment_mode,v_subtotal::integer,v_fee,
   CASE WHEN p_fulfillment_mode='delivery' THEN p_zone_id ELSE NULL END,
   CASE WHEN p_fulfillment_mode='delivery' THEN trim(p_address) ELSE NULL END,
   left(coalesce(p_address_note,''),500),left(coalesce(p_customer_note,''),2000),
   p_pickup_due_at,v_revision
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

CREATE OR REPLACE FUNCTION public.restaurant_ops_transition_order(
 p_company_id text,p_order_id uuid,p_expected_version integer,
 p_next_status text,p_actor_id text,p_actor_role text,p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order public.restaurant_ops_orders%ROWTYPE;
        v_previous_status text;
BEGIN
 SELECT * INTO v_order FROM public.restaurant_ops_orders
 WHERE id=p_order_id AND company_id=p_company_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
 IF v_order.version<>p_expected_version THEN RAISE EXCEPTION 'ORDER_VERSION_CONFLICT'; END IF;
 v_previous_status := v_order.status;
 IF NOT (
   (v_order.status='confirmed' AND p_next_status IN ('preparing','cancelled')) OR
   (v_order.status='preparing' AND p_next_status IN ('ready','cancelled')) OR
   (v_order.status='ready' AND v_order.fulfillment_mode='pickup' AND p_next_status='completed') OR
   (v_order.status='ready' AND v_order.fulfillment_mode='delivery' AND p_next_status='out_for_delivery') OR
   (v_order.status='out_for_delivery' AND p_next_status='completed')
 ) THEN RAISE EXCEPTION 'INVALID_ORDER_TRANSITION'; END IF;
 IF p_next_status='cancelled' AND length(trim(coalesce(p_reason,'')))<5
 THEN RAISE EXCEPTION 'CANCELLATION_REASON_REQUIRED'; END IF;
 IF p_next_status='out_for_delivery' AND v_order.courier_id IS NULL
 THEN RAISE EXCEPTION 'COURIER_ASSIGNMENT_REQUIRED'; END IF;
 UPDATE public.restaurant_ops_orders SET status=p_next_status,version=version+1,updated_at=now(),
   preparing_at=CASE WHEN p_next_status='preparing' THEN now() ELSE preparing_at END,
   ready_at=CASE WHEN p_next_status='ready' THEN now() ELSE ready_at END,
   handed_off_at=CASE WHEN p_next_status='out_for_delivery' THEN now() ELSE handed_off_at END,
   completed_at=CASE WHEN p_next_status='completed' THEN now() ELSE completed_at END,
   cancelled_at=CASE WHEN p_next_status='cancelled' THEN now() ELSE cancelled_at END
 WHERE id=p_order_id AND company_id=p_company_id RETURNING * INTO v_order;
 IF p_next_status IN ('preparing','ready','cancelled') THEN
  UPDATE public.restaurant_ops_kitchen_tickets
  SET status=CASE p_next_status WHEN 'preparing' THEN 'working'
    WHEN 'ready' THEN 'ready' ELSE 'cancelled' END,
    started_at=CASE WHEN p_next_status='preparing' THEN now() ELSE started_at END,
    ready_at=CASE WHEN p_next_status='ready' THEN now() ELSE ready_at END
  WHERE company_id=p_company_id AND order_id=p_order_id;
 END IF;
 IF p_next_status IN ('completed','cancelled') AND v_order.courier_id IS NOT NULL THEN
  UPDATE public.restaurant_ops_couriers SET availability='available'
  WHERE id=v_order.courier_id AND company_id=p_company_id;
 END IF;
 INSERT INTO public.restaurant_ops_order_events(company_id,order_id,event_type,actor_id,actor_role,previous_status,next_status,details)
 VALUES(p_company_id,p_order_id,'status_changed',p_actor_id,p_actor_role,
  v_previous_status,
  p_next_status,jsonb_build_object('reason',coalesce(p_reason,'')));
 INSERT INTO public.restaurant_ops_outbox(company_id,order_id,kind,payload)
 VALUES(p_company_id,p_order_id,'order_status_changed',jsonb_build_object('status',p_next_status));
 RETURN to_jsonb(v_order);
END $$;

CREATE OR REPLACE FUNCTION public.restaurant_ops_assign_courier(
 p_company_id text,p_order_id uuid,p_courier_id uuid,
 p_expected_version integer,p_actor_id text,p_actor_role text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order public.restaurant_ops_orders%ROWTYPE; v_courier public.restaurant_ops_couriers%ROWTYPE;
BEGIN
 SELECT * INTO v_order FROM public.restaurant_ops_orders
 WHERE company_id=p_company_id AND id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
 IF v_order.version<>p_expected_version THEN RAISE EXCEPTION 'ORDER_VERSION_CONFLICT'; END IF;
 IF v_order.fulfillment_mode<>'delivery' OR v_order.status NOT IN ('confirmed','preparing','ready')
 THEN RAISE EXCEPTION 'ORDER_NOT_ASSIGNABLE'; END IF;
 IF v_order.courier_id IS NOT NULL THEN RAISE EXCEPTION 'ORDER_ALREADY_ASSIGNED'; END IF;
 SELECT * INTO v_courier FROM public.restaurant_ops_couriers
 WHERE company_id=p_company_id AND id=p_courier_id FOR UPDATE;
 IF NOT FOUND OR NOT v_courier.active OR v_courier.availability<>'available'
 THEN RAISE EXCEPTION 'COURIER_NOT_AVAILABLE'; END IF;
 UPDATE public.restaurant_ops_orders SET courier_id=p_courier_id,version=version+1,updated_at=now()
 WHERE company_id=p_company_id AND id=p_order_id RETURNING * INTO v_order;
 UPDATE public.restaurant_ops_couriers SET availability='busy'
 WHERE company_id=p_company_id AND id=p_courier_id;
 INSERT INTO public.restaurant_ops_order_events(company_id,order_id,event_type,actor_id,actor_role,details)
 VALUES(p_company_id,p_order_id,'courier_assigned',p_actor_id,p_actor_role,
  jsonb_build_object('courier_id',p_courier_id));
 RETURN to_jsonb(v_order);
END $$;

CREATE OR REPLACE FUNCTION public.restaurant_ops_set_payment(
 p_company_id text,p_order_id uuid,p_expected_version integer,
 p_payment_status text,p_payment_method text,p_actor_id text,p_actor_role text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order public.restaurant_ops_orders%ROWTYPE;
BEGIN
 SELECT * INTO v_order FROM public.restaurant_ops_orders
 WHERE company_id=p_company_id AND id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
 IF v_order.version<>p_expected_version THEN RAISE EXCEPTION 'ORDER_VERSION_CONFLICT'; END IF;
 IF p_payment_status NOT IN ('pending','proof_submitted','verified','cash_on_delivery','refunded')
 THEN RAISE EXCEPTION 'INVALID_PAYMENT_STATUS'; END IF;
 IF v_order.payment_status='refunded' OR
   (p_payment_status='refunded' AND v_order.payment_status<>'verified') OR
   (v_order.status='cancelled' AND p_payment_status NOT IN ('refunded','pending'))
 THEN RAISE EXCEPTION 'PAYMENT_TRANSITION_FORBIDDEN'; END IF;
 IF p_payment_status='verified' AND p_actor_role NOT IN ('owner','admin')
 THEN RAISE EXCEPTION 'PAYMENT_VERIFICATION_REQUIRES_MANAGER'; END IF;
 UPDATE public.restaurant_ops_orders SET payment_status=p_payment_status,
  payment_method=left(coalesce(p_payment_method,''),50),
  version=version+1,updated_at=now()
 WHERE id=p_order_id AND company_id=p_company_id RETURNING * INTO v_order;
 INSERT INTO public.restaurant_ops_order_events(company_id,order_id,event_type,actor_id,actor_role,details)
 VALUES(p_company_id,p_order_id,'payment_status_changed',p_actor_id,p_actor_role,
 jsonb_build_object('status',p_payment_status,'method',p_payment_method));
 RETURN to_jsonb(v_order);
END $$;

-- RPCs callable only by service_role. Server enforces authenticated tenant + roles.
REVOKE ALL ON FUNCTION public.restaurant_ops_create_order(text,text,text,text,text,text,jsonb,uuid,text,text,text,timestamptz,text,text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.restaurant_ops_transition_order(text,uuid,integer,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.restaurant_ops_assign_courier(text,uuid,uuid,integer,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.restaurant_ops_set_payment(text,uuid,integer,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_ops_create_order(text,text,text,text,text,text,jsonb,uuid,text,text,text,timestamptz,text,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.restaurant_ops_transition_order(text,uuid,integer,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.restaurant_ops_assign_courier(text,uuid,uuid,integer,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.restaurant_ops_set_payment(text,uuid,integer,text,text,text,text) TO service_role;

INSERT INTO public.commerce_schema_migrations(version,description)
VALUES('20261106170000','Restaurant operations: confirmed orders, kitchen, dispatch, incidents, audit and outbox')
ON CONFLICT(version) DO NOTHING;
COMMIT;
