-- Delibocados: durable, authenticated Toteat status events.
-- This migration neither sends an order nor activates a webhook or printing.
BEGIN;

CREATE TABLE IF NOT EXISTS public.restaurant_ops_toteat_webhook_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES public.commerce_companies(id) ON DELETE CASCADE,
  event_key text NOT NULL CHECK (event_key ~ '^[0-9a-f]{64}$'),
  external_reference text NOT NULL CHECK(length(external_reference) BETWEEN 8 AND 160),
  external_order_id text NOT NULL,
  order_status text NOT NULL DEFAULT '',
  delivery_status_id integer,
  modification_date timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','processing','applied','ignored','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 1),
  reason text NOT NULL DEFAULT '',
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE(company_id,event_key)
);
CREATE INDEX IF NOT EXISTS toteat_webhook_pending_idx
  ON public.restaurant_ops_toteat_webhook_inbox(company_id,status,received_at);
ALTER TABLE public.restaurant_ops_toteat_webhook_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_ops_toteat_webhook_inbox FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.restaurant_ops_toteat_webhook_inbox TO service_role;

-- Exactly one worker can claim an event; no automatic re-delivery of unknown effects.
CREATE OR REPLACE FUNCTION public.restaurant_ops_toteat_claim_event(p_company_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v public.restaurant_ops_toteat_webhook_inbox%ROWTYPE;
BEGIN
  IF p_company_id<>'delibocados' THEN RAISE EXCEPTION 'TENANT_NOT_ALLOWED'; END IF;
  SELECT * INTO v FROM public.restaurant_ops_toteat_webhook_inbox
  WHERE company_id=p_company_id AND status='pending' AND attempts=0
  ORDER BY received_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.restaurant_ops_toteat_webhook_inbox
  SET status='processing',attempts=1
  WHERE id=v.id RETURNING * INTO v;
  RETURN to_jsonb(v);
END $$;

CREATE OR REPLACE FUNCTION public.restaurant_ops_toteat_finish_event(
  p_company_id text,p_event_id uuid,p_status text,p_reason text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v public.restaurant_ops_toteat_webhook_inbox%ROWTYPE;
BEGIN
  IF p_company_id<>'delibocados' OR
    p_status NOT IN ('applied','ignored','failed')
    THEN RAISE EXCEPTION 'TOTEAT_EVENT_FINISH_INVALID'; END IF;
  UPDATE public.restaurant_ops_toteat_webhook_inbox
    SET status=p_status,reason=left(coalesce(p_reason,''),250),processed_at=now()
  WHERE company_id=p_company_id AND id=p_event_id
    AND status='processing' AND attempts=1
  RETURNING * INTO v;
  IF NOT FOUND THEN RAISE EXCEPTION 'TOTEAT_EVENT_NOT_PROCESSING'; END IF;
  RETURN to_jsonb(v);
END $$;

REVOKE ALL ON FUNCTION public.restaurant_ops_toteat_claim_event(text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.restaurant_ops_toteat_finish_event(text,uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_ops_toteat_claim_event(text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.restaurant_ops_toteat_finish_event(text,uuid,text,text)
  TO service_role;

INSERT INTO public.commerce_schema_migrations(version,description)
VALUES('20261109120000','Delibocados authenticated Toteat status webhook inbox')
ON CONFLICT(version) DO NOTHING;
COMMIT;
