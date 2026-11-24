-- Delibocados: one-use Mesa 1 QR checkout gate.
-- Created DISABLED; does not enable public QR, claim jobs, or alter historic exports.
-- This RPC holds a row lock while creating the order and its POS360 outbox row,
-- so concurrent checkout attempts cannot consume more than one pilot admission.
BEGIN;

CREATE TABLE IF NOT EXISTS public.restaurant_ops_qr_single_use_pilot (
  singleton smallint PRIMARY KEY DEFAULT 1 CHECK (singleton = 1),
  company_id text NOT NULL DEFAULT 'delibocados'
    CHECK (company_id = 'delibocados'),
  table_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  valid_from timestamptz,
  expires_at timestamptz,
  consumed_at timestamptz,
  order_id uuid,
  source_key text,
  approved_by text,
  CONSTRAINT deli_qr_pilot_table_fk
    FOREIGN KEY(company_id,table_id)
    REFERENCES public.restaurant_ops_qr_tables(company_id,id),
  CONSTRAINT deli_qr_pilot_window_chk CHECK (
    NOT enabled OR
    (valid_from IS NOT NULL AND expires_at IS NOT NULL
     AND expires_at > valid_from)
  ),
  CONSTRAINT deli_qr_pilot_one_use_chk CHECK (
    (consumed_at IS NULL AND order_id IS NULL AND source_key IS NULL)
    OR
    (consumed_at IS NOT NULL AND order_id IS NOT NULL AND source_key IS NOT NULL)
  )
);
ALTER TABLE public.restaurant_ops_qr_single_use_pilot ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_ops_qr_single_use_pilot
  FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.restaurant_ops_qr_single_use_pilot
  TO service_role;

-- Same contract as restaurant_ops_create_qr_order, but scope is immutable:
-- verified Mesa 1 token, one deli-006 x1, exactly 14,000 COP, cash, no modifiers.
-- A prior sourceKey may be replayed idempotently; another sourceKey cannot.
CREATE OR REPLACE FUNCTION public.restaurant_ops_create_qr_order_pilot(
  p_company_id text,p_source_key text,p_qr_kind text,p_qr_token text,
  p_table_id uuid,p_customer_phone text,p_customer_name text,
  p_items jsonb,p_expected_menu_revision integer,
  p_payment_method text,p_payment_status text,
  p_customer_confirmed boolean,p_customer_note text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE
  v_gate public.restaurant_ops_qr_single_use_pilot%ROWTYPE;
  v_order jsonb;
  v_id uuid;
  v_sku_count integer;
  v_export_id uuid;
BEGIN
  IF p_company_id IS DISTINCT FROM 'delibocados'
    OR p_source_key IS NULL OR p_source_key !~*
      '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    OR p_qr_kind IS DISTINCT FROM 'table'
    OR p_payment_method IS DISTINCT FROM 'cash'
    OR p_payment_status IS DISTINCT FROM 'cash_on_delivery'
    OR p_customer_confirmed IS DISTINCT FROM true
    OR p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_items) <> 1
    OR p_items->0->>'productId' IS DISTINCT FROM 'deli-006'
    OR p_items->0->'quantity' IS DISTINCT FROM '1'::jsonb
    OR length(btrim(coalesce(p_items->0->>'instructions',''))) > 0
    OR length(coalesce(p_customer_note,'')) > 220
  THEN RAISE EXCEPTION 'QR_PILOT_SCOPE_DENIED'; END IF;

  SELECT * INTO v_gate FROM public.restaurant_ops_qr_single_use_pilot
    WHERE singleton=1 AND company_id='delibocados' FOR UPDATE;
  IF NOT FOUND OR v_gate.table_id IS DISTINCT FROM p_table_id
    THEN RAISE EXCEPTION 'QR_PILOT_TABLE_DENIED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurant_ops_qr_tables t
    WHERE t.company_id='delibocados' AND t.id=p_table_id
      AND t.label='Mesa 1' AND t.enabled=true
  ) THEN RAISE EXCEPTION 'QR_PILOT_MESA1_DISABLED'; END IF;

  -- Allow an idempotent replay of the same admitted order after the window.
  -- The underlying QR RPC re-verifies token, table, and checkout fingerprint.
  IF v_gate.consumed_at IS NOT NULL THEN
    IF v_gate.source_key IS DISTINCT FROM p_source_key
      THEN RAISE EXCEPTION 'QR_PILOT_ALREADY_CONSUMED'; END IF;
    RETURN public.restaurant_ops_create_qr_order(
      p_company_id,p_source_key,p_qr_kind,p_qr_token,p_table_id,
      p_customer_phone,p_customer_name,p_items,p_expected_menu_revision,
      p_payment_method,p_payment_status,p_customer_confirmed,p_customer_note
    );
  END IF;
  IF v_gate.enabled IS DISTINCT FROM true
    OR v_gate.valid_from IS NULL OR v_gate.expires_at IS NULL
    OR now() < v_gate.valid_from OR now() >= v_gate.expires_at
    THEN RAISE EXCEPTION 'QR_PILOT_EXPIRED_OR_DISABLED'; END IF;

  -- Ensure this exact menu revision is still selling deli-006 for 14,000 COP.
  SELECT count(*) INTO v_sku_count
  FROM public.restaurant_menu_documents m
  CROSS JOIN LATERAL jsonb_array_elements(
    coalesce(m.payload->'products','[]'::jsonb)
  ) AS p(item)
  WHERE m.company_id='delibocados'
    AND m.revision=p_expected_menu_revision
    AND p.item->>'id'='deli-006'
    AND p.item->>'priceCOP'='14000'
    AND p.item->>'available' IS DISTINCT FROM 'false'
    AND p.item->>'priceNeedsReview' IS DISTINCT FROM 'true';
  IF v_sku_count <> 1 THEN
    RAISE EXCEPTION 'QR_PILOT_MENU_CHANGED'; END IF;

  -- Never create a client-facing pilot order if the POS connector is OFF.
  IF NOT EXISTS (
    SELECT 1 FROM public.company_integrations cfg
    WHERE cfg.company_id='delibocados' AND cfg.provider='pos360'
      AND cfg.enabled=true AND cfg.status='connected'
  ) THEN RAISE EXCEPTION 'QR_PILOT_POS360_NOT_CONNECTED'; END IF;

  v_order:=public.restaurant_ops_create_qr_order(
    p_company_id,p_source_key,p_qr_kind,p_qr_token,p_table_id,
    p_customer_phone,p_customer_name,p_items,p_expected_menu_revision,
    p_payment_method,p_payment_status,p_customer_confirmed,p_customer_note
  );
  v_id:=(v_order->>'id')::uuid;

  -- The outbox insertion happens in the same DB transaction. If absent,
  -- roll back the customer order rather than promise phantom kitchen delivery.
  SELECT e.id INTO v_export_id FROM public.restaurant_ops_pos_exports e
  WHERE e.company_id='delibocados' AND e.provider='pos360'
    AND e.order_id=v_id AND e.status='pending' AND e.attempts=0;
  IF v_export_id IS NULL
    THEN RAISE EXCEPTION 'QR_PILOT_OUTBOX_NOT_PENDING'; END IF;

  UPDATE public.restaurant_ops_qr_single_use_pilot SET
    consumed_at=now(),order_id=v_id,source_key=p_source_key,
    enabled=false
  WHERE singleton=1 AND company_id='delibocados';

  RETURN v_order;
END $$;

REVOKE ALL ON FUNCTION public.restaurant_ops_create_qr_order_pilot(
  text,text,text,text,uuid,text,text,jsonb,integer,text,text,boolean,text
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_ops_create_qr_order_pilot(
  text,text,text,text,uuid,text,text,jsonb,integer,text,text,boolean,text
) TO service_role;

INSERT INTO public.commerce_schema_migrations(version,description)
VALUES('20261124150000','Delibocados single-use Mesa1 QR pilot checkout; defaults disabled')
ON CONFLICT(version) DO NOTHING;
COMMIT;
