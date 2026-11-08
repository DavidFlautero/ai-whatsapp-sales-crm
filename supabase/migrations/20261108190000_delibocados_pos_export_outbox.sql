-- Delibocados: independent POS export delivery ledger.
-- Does not send network requests and does not backfill old orders.
BEGIN;

CREATE TABLE IF NOT EXISTS public.restaurant_ops_pos_product_map (
  company_id text NOT NULL REFERENCES public.commerce_companies(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK(provider IN ('toteat','pos360')),
  product_id text NOT NULL,
  external_product_code text NOT NULL CHECK(length(trim(external_product_code)) BETWEEN 1 AND 150),
  active boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(company_id,provider,product_id),
  CHECK(length(trim(product_id)) BETWEEN 1 AND 150)
);

CREATE TABLE IF NOT EXISTS public.restaurant_ops_pos_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  order_id uuid NOT NULL,
  provider text NOT NULL CHECK(provider IN ('toteat','pos360')),
  external_reference text NOT NULL CHECK(length(trim(external_reference)) BETWEEN 8 AND 160),
  status text NOT NULL DEFAULT 'blocked'
    CHECK(status IN ('blocked','pending','sending','accepted','unknown','rejected','suppressed')),
  reason text NOT NULL DEFAULT '',
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 1),
  external_order_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  accepted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_exports_one_destination UNIQUE(company_id,order_id),
  CONSTRAINT pos_exports_reference_unique UNIQUE(company_id,provider,external_reference),
  CONSTRAINT pos_exports_order_fk FOREIGN KEY(company_id,order_id)
    REFERENCES public.restaurant_ops_orders(company_id,id) ON DELETE CASCADE,
  CONSTRAINT pos_exports_accepted_id CHECK(status <> 'accepted' OR
    (length(trim(coalesce(external_order_id,''))) > 0 AND accepted_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS pos_exports_queue_idx
  ON public.restaurant_ops_pos_exports(company_id,provider,status,created_at);

ALTER TABLE public.restaurant_ops_pos_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_ops_pos_product_map ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_ops_pos_exports,
  public.restaurant_ops_pos_product_map FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.restaurant_ops_pos_exports TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.restaurant_ops_pos_product_map TO service_role;

-- Exactly one Toteat export registration per newly created WhatsApp order.
-- This is part of the existing atomic restaurant_ops_create_order transaction.
CREATE OR REPLACE FUNCTION public.restaurant_ops_pos_enqueue_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.company_id='delibocados' AND NEW.source='whatsapp' THEN
    INSERT INTO public.restaurant_ops_pos_exports(
      company_id,order_id,provider,external_reference,status,reason
    ) VALUES (
      NEW.company_id,NEW.id,'toteat','delibocados-'||NEW.id::text,
      CASE WHEN NEW.status='confirmed' AND NEW.payment_status IN ('verified','cash_on_delivery')
        THEN 'pending' ELSE 'blocked' END,
      CASE WHEN NEW.status='confirmed' AND NEW.payment_status IN ('verified','cash_on_delivery')
        THEN '' ELSE 'PAYMENT_REVIEW_REQUIRED' END
    ) ON CONFLICT (company_id,order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS restaurant_ops_pos_enqueue_created
  ON public.restaurant_ops_orders;
CREATE TRIGGER restaurant_ops_pos_enqueue_created
AFTER INSERT ON public.restaurant_ops_orders
FOR EACH ROW EXECUTE FUNCTION public.restaurant_ops_pos_enqueue_order();

-- Payment reconciliation can release a blocked order, but NEVER automatically
-- retry one previously attempted, rejected, unknown or already accepted.
CREATE OR REPLACE FUNCTION public.restaurant_ops_pos_sync_hold()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.company_id='delibocados' AND NEW.source='whatsapp'
     AND (NEW.status IS DISTINCT FROM OLD.status OR
          NEW.payment_status IS DISTINCT FROM OLD.payment_status) THEN
    UPDATE public.restaurant_ops_pos_exports e
    SET status=CASE
        WHEN NEW.status IN ('cancelled','completed') THEN 'suppressed'
        WHEN NEW.status<>'confirmed' THEN 'blocked'
        WHEN NEW.payment_status IN ('verified','cash_on_delivery') THEN 'pending'
        ELSE 'blocked' END,
      reason=CASE
        WHEN NEW.status IN ('cancelled','completed') THEN 'ORDER_FINISHED_BEFORE_EXPORT'
        WHEN NEW.status<>'confirmed' THEN 'ORDER_NOT_CONFIRMABLE'
        WHEN NEW.payment_status IN ('verified','cash_on_delivery') THEN ''
        ELSE 'PAYMENT_REVIEW_REQUIRED' END,
      updated_at=now()
    WHERE e.company_id=NEW.company_id AND e.order_id=NEW.id
      AND e.provider='toteat'
      AND e.status IN ('blocked','pending') AND e.attempts=0;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS restaurant_ops_pos_sync_on_order_update
  ON public.restaurant_ops_orders;
CREATE TRIGGER restaurant_ops_pos_sync_on_order_update
AFTER UPDATE OF status,payment_status ON public.restaurant_ops_orders
FOR EACH ROW EXECUTE FUNCTION public.restaurant_ops_pos_sync_hold();

-- Claim: one worker can take one order at a time, only when the tenant
-- integration is enabled AND every ordered product has a reviewed code.
-- Claim alone does not call Toteat. No automatic retries ever occur.
CREATE OR REPLACE FUNCTION public.restaurant_ops_pos_claim_toteat(
  p_company_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_export public.restaurant_ops_pos_exports%ROWTYPE;
BEGIN
  IF p_company_id<>'delibocados' THEN RAISE EXCEPTION 'POS_TENANT_NOT_ALLOWED'; END IF;
  SELECT e.* INTO v_export
  FROM public.restaurant_ops_pos_exports e
  JOIN public.restaurant_ops_orders o
    ON o.company_id=e.company_id AND o.id=e.order_id
  WHERE e.company_id=p_company_id
    AND e.provider='toteat' AND e.status='pending' AND e.attempts=0
    AND o.source='whatsapp' AND o.status='confirmed'
    AND o.payment_status IN ('verified','cash_on_delivery')
    AND EXISTS(SELECT 1 FROM public.company_integrations i
      WHERE i.company_id=e.company_id AND i.provider='toteat'
        AND i.enabled=true AND i.status='connected')
    AND EXISTS(SELECT 1 FROM public.restaurant_ops_order_items item
      WHERE item.company_id=o.company_id AND item.order_id=o.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.restaurant_ops_order_items item
      WHERE item.company_id=o.company_id AND item.order_id=o.id
        AND NOT EXISTS (
          SELECT 1 FROM public.restaurant_ops_pos_product_map m
          WHERE m.company_id=item.company_id AND m.provider='toteat'
            AND m.product_id=item.product_id AND m.active=true
            AND m.reviewed_at IS NOT NULL
        )
    )
  ORDER BY e.created_at ASC
  LIMIT 1 FOR UPDATE OF e SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.restaurant_ops_pos_exports
     SET status='sending',attempts=1,last_attempt_at=now(),updated_at=now()
  WHERE id=v_export.id RETURNING * INTO v_export;
  RETURN to_jsonb(v_export);
END $$;

-- A transport must report an explicit result; any ambiguous result is UNKNOWN.
-- UNKNOWN orders require reconciliation with Toteat before considering a retry.
CREATE OR REPLACE FUNCTION public.restaurant_ops_pos_finish_toteat(
  p_company_id text,p_export_id uuid,p_outcome text,p_external_order_id text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_export public.restaurant_ops_pos_exports%ROWTYPE;
BEGIN
  IF p_company_id<>'delibocados' OR p_outcome NOT IN ('accepted','unknown','rejected')
  THEN RAISE EXCEPTION 'POS_FINISH_INVALID'; END IF;
  SELECT * INTO v_export FROM public.restaurant_ops_pos_exports
  WHERE company_id=p_company_id AND id=p_export_id AND provider='toteat'
  FOR UPDATE;
  IF NOT FOUND OR v_export.status<>'sending' OR v_export.attempts<>1
  THEN RAISE EXCEPTION 'POS_EXPORT_NOT_SENDING'; END IF;
  IF p_outcome='accepted' AND length(trim(coalesce(p_external_order_id,'')))=0
  THEN RAISE EXCEPTION 'POS_EXTERNAL_RECEIPT_REQUIRED'; END IF;
  UPDATE public.restaurant_ops_pos_exports
  SET status=p_outcome,
      reason=CASE p_outcome WHEN 'accepted' THEN ''
        WHEN 'unknown' THEN 'RECONCILE_WITH_TOTEAT_BEFORE_RETRY'
        ELSE 'REVIEW_REJECTED_REQUEST' END,
      external_order_id=CASE WHEN p_outcome='accepted'
        THEN left(trim(p_external_order_id),150) ELSE NULL END,
      accepted_at=CASE WHEN p_outcome='accepted' THEN now() ELSE NULL END,
      updated_at=now()
  WHERE id=p_export_id RETURNING * INTO v_export;
  INSERT INTO public.restaurant_ops_order_events(
    company_id,order_id,event_type,actor_id,actor_role,details
  ) VALUES(
    p_company_id,v_export.order_id,'pos_export_'||p_outcome,
    'pos-export-worker','system',
    jsonb_build_object('provider','toteat','export_id',v_export.id,
      'external_reference',v_export.external_reference,
      'external_order_id',v_export.external_order_id)
  );
  RETURN to_jsonb(v_export);
END $$;

-- Keep unresolved attempts visible even if the worker crashed after POST.
-- Explicit intervention, not an automatic resend, is the safe recovery.
REVOKE ALL ON FUNCTION public.restaurant_ops_pos_enqueue_order() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.restaurant_ops_pos_sync_hold() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.restaurant_ops_pos_claim_toteat(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.restaurant_ops_pos_finish_toteat(text,uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_ops_pos_claim_toteat(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.restaurant_ops_pos_finish_toteat(text,uuid,text,text) TO service_role;

INSERT INTO public.commerce_schema_migrations(version,description)
VALUES('20261108190000','Delibocados Toteat durable outbox and reviewed product mapping')
ON CONFLICT(version) DO NOTHING;
COMMIT;
