-- Delibocados QR: verifiable dining tables and atomic dine-in checkout.
-- Does NOT activate any public endpoint or connect to POS360.
BEGIN;
CREATE TABLE public.restaurant_ops_qr_tables (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id text NOT NULL REFERENCES public.commerce_companies(id) ON DELETE CASCADE,
 editor_table_id text NOT NULL CHECK(length(trim(editor_table_id)) BETWEEN 1 AND 120),
 label text NOT NULL CHECK(length(trim(label)) BETWEEN 1 AND 120),
 qr_token_sha256 char(64) NOT NULL CHECK(qr_token_sha256 ~ '^[0-9a-f]{64}$'),
 enabled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,id),
 UNIQUE(company_id,editor_table_id),
 UNIQUE(company_id,qr_token_sha256)
);
CREATE TABLE public.restaurant_ops_qr_general (
 company_id text PRIMARY KEY REFERENCES public.commerce_companies(id) ON DELETE CASCADE,
 qr_token_sha256 char(64) NOT NULL CHECK(qr_token_sha256 ~ '^[0-9a-f]{64}$'),
 enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX restaurant_ops_qr_tables_active_idx
 ON public.restaurant_ops_qr_tables(company_id,enabled);
ALTER TABLE public.restaurant_ops_qr_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_ops_qr_general ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_ops_qr_tables,
 public.restaurant_ops_qr_general FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.restaurant_ops_qr_tables TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.restaurant_ops_qr_general TO service_role;

-- Keep all historic pickup and delivery orders unchanged.
ALTER TABLE public.restaurant_ops_orders ADD COLUMN qr_table_id uuid;
ALTER TABLE public.restaurant_ops_orders ADD COLUMN qr_kind text;
ALTER TABLE public.restaurant_ops_orders
 DROP CONSTRAINT restaurant_ops_orders_fulfillment_mode_check;
ALTER TABLE public.restaurant_ops_orders
 ADD CONSTRAINT restaurant_ops_orders_fulfillment_mode_check
 CHECK(fulfillment_mode IN ('pickup','delivery','dine_in'));
ALTER TABLE public.restaurant_ops_orders
 ADD CONSTRAINT restaurant_ops_orders_qr_table_fk
 FOREIGN KEY(company_id,qr_table_id)
 REFERENCES public.restaurant_ops_qr_tables(company_id,id);
ALTER TABLE public.restaurant_ops_orders
 ADD CONSTRAINT restaurant_ops_dine_in_identity_check CHECK(
   (fulfillment_mode='dine_in'
     AND source='qr' AND qr_table_id IS NOT NULL
     AND qr_kind IN ('table','general')
     AND delivery_fee_cop=0 AND zone_id IS NULL
     AND courier_id IS NULL AND address IS NULL)
   OR
   (fulfillment_mode<>'dine_in' AND qr_table_id IS NULL AND qr_kind IS NULL)
 );
CREATE INDEX restaurant_ops_dine_in_queue_idx
 ON public.restaurant_ops_orders(company_id,qr_table_id,created_at DESC)
 WHERE fulfillment_mode='dine_in';

-- Backend RPC only. Tokens live only in the request and hashed comparison;
-- never stored raw or echoed. Uses existing verified menu/price RPC.
CREATE FUNCTION public.restaurant_ops_create_qr_order(
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
 v_hash text;
BEGIN
 IF p_company_id<>'delibocados' OR p_qr_kind NOT IN ('table','general')
   OR p_customer_confirmed IS DISTINCT FROM true
   OR p_qr_token IS NULL OR length(p_qr_token) NOT BETWEEN 32 AND 200
   OR p_qr_token !~ '^[A-Za-z0-9_-]+$'
 THEN RAISE EXCEPTION 'QR_CHECKOUT_NOT_AUTHORIZED'; END IF;
 v_hash:=encode(sha256(convert_to(p_qr_token,'UTF8')),'hex');
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
    OR v_existing.customer_phone<>p_customer_phone
    OR v_existing.customer_name<>trim(p_customer_name)
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
 UPDATE public.restaurant_ops_orders SET
   fulfillment_mode='dine_in',qr_table_id=p_table_id,qr_kind=p_qr_kind,
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

REVOKE ALL ON FUNCTION public.restaurant_ops_create_qr_order(
 text,text,text,text,uuid,text,text,jsonb,integer,text,text,boolean,text
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_ops_create_qr_order(
 text,text,text,text,uuid,text,text,jsonb,integer,text,text,boolean,text
) TO service_role;

INSERT INTO public.commerce_schema_migrations(version,description)
VALUES('20261108210000','Delibocados secure QR table identity and dine-in order RPC')
ON CONFLICT(version) DO NOTHING;
COMMIT;
