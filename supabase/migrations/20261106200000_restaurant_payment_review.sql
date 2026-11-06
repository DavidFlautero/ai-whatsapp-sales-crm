-- Independent restaurant payment review workflow. Does not touch Fulanitas retail payment submissions.
BEGIN;

CREATE TABLE IF NOT EXISTS public.restaurant_ops_payment_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  order_id uuid NOT NULL,
  source_message_id text NOT NULL CHECK (length(source_message_id) BETWEEN 4 AND 255),
  customer_phone text NOT NULL CHECK (customer_phone ~ '^[0-9]{8,15}$'),
  status text NOT NULL DEFAULT 'pending_review'
    CHECK(status IN ('pending_review','approved','rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(company_id,order_id) REFERENCES public.restaurant_ops_orders(company_id,id) ON DELETE CASCADE,
  UNIQUE(company_id,source_message_id),
  UNIQUE(company_id,id)
);
CREATE INDEX IF NOT EXISTS restaurant_payment_review_queue_idx
  ON public.restaurant_ops_payment_proofs(company_id,status,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_payment_one_pending_per_order
  ON public.restaurant_ops_payment_proofs(company_id,order_id)
  WHERE status='pending_review';

ALTER TABLE public.restaurant_ops_payment_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_ops_payment_proofs FROM PUBLIC,anon,authenticated;
GRANT SELECT, INSERT, UPDATE ON public.restaurant_ops_payment_proofs TO service_role;

-- Kitchen tickets for transfers stay on hold until independent payment approval.
ALTER TABLE public.restaurant_ops_kitchen_tickets
  DROP CONSTRAINT IF EXISTS restaurant_ops_kitchen_tickets_status_check;
ALTER TABLE public.restaurant_ops_kitchen_tickets
  ADD CONSTRAINT restaurant_ops_kitchen_tickets_status_check
  CHECK(status IN ('on_hold','queued','working','ready','cancelled'));

CREATE OR REPLACE FUNCTION public.restaurant_ops_kitchen_hold_new()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_method text; v_status text;
BEGIN
  SELECT payment_method,payment_status INTO v_method,v_status
    FROM public.restaurant_ops_orders
    WHERE company_id=NEW.company_id AND id=NEW.order_id;
  IF v_method='transfer' AND v_status NOT IN ('verified','cash_on_delivery') THEN
    NEW.status:='on_hold';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS restaurant_ops_kitchen_hold_on_insert ON public.restaurant_ops_kitchen_tickets;
CREATE TRIGGER restaurant_ops_kitchen_hold_on_insert BEFORE INSERT
ON public.restaurant_ops_kitchen_tickets FOR EACH ROW
EXECUTE FUNCTION public.restaurant_ops_kitchen_hold_new();
UPDATE public.restaurant_ops_kitchen_tickets k
SET status='on_hold'
FROM public.restaurant_ops_orders o
WHERE k.company_id=o.company_id AND k.order_id=o.id
  AND o.company_id='delibocados' AND o.payment_method='transfer'
  AND o.payment_status NOT IN ('verified','cash_on_delivery')
  AND o.status='confirmed' AND k.status='queued';

CREATE OR REPLACE FUNCTION public.restaurant_ops_submit_payment_proof(
 p_company_id text,p_order_id uuid,p_source_message_id text,p_customer_phone text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order public.restaurant_ops_orders%ROWTYPE;
        v_proof public.restaurant_ops_payment_proofs%ROWTYPE;
BEGIN
 IF p_company_id<>'delibocados'
   OR length(trim(coalesce(p_source_message_id,''))) NOT BETWEEN 4 AND 255
   OR coalesce(p_customer_phone,'') !~ '^[0-9]{8,15}$'
 THEN RAISE EXCEPTION 'PROOF_INPUT_INVALID'; END IF;
 SELECT * INTO v_order FROM public.restaurant_ops_orders
  WHERE company_id=p_company_id AND id=p_order_id FOR UPDATE;
 IF NOT FOUND OR v_order.customer_phone<>p_customer_phone
 THEN RAISE EXCEPTION 'ORDER_NOT_FOUND_FOR_CUSTOMER'; END IF;
 IF v_order.payment_method<>'transfer' OR v_order.status='cancelled'
   OR v_order.payment_status NOT IN ('pending','proof_submitted')
 THEN RAISE EXCEPTION 'ORDER_NOT_AWAITING_TRANSFER'; END IF;
 SELECT * INTO v_proof FROM public.restaurant_ops_payment_proofs
  WHERE company_id=p_company_id AND source_message_id=p_source_message_id;
 IF FOUND THEN
   IF v_proof.order_id<>p_order_id THEN RAISE EXCEPTION 'PROOF_ALREADY_ASSOCIATED'; END IF;
   RETURN to_jsonb(v_proof);
 END IF;
 IF EXISTS(
   SELECT 1 FROM public.restaurant_ops_payment_proofs
   WHERE company_id=p_company_id AND order_id=p_order_id AND status='pending_review'
 ) THEN RAISE EXCEPTION 'PROOF_ALREADY_PENDING_REVIEW'; END IF;

 INSERT INTO public.restaurant_ops_payment_proofs(
  company_id,order_id,source_message_id,customer_phone
 ) VALUES(p_company_id,p_order_id,p_source_message_id,p_customer_phone)
 RETURNING * INTO v_proof;
 UPDATE public.restaurant_ops_orders
 SET payment_status='proof_submitted',updated_at=now(),version=version+1
 WHERE company_id=p_company_id AND id=p_order_id;
 INSERT INTO public.restaurant_ops_order_events(
  company_id,order_id,event_type,actor_id,actor_role,details
 ) VALUES(p_company_id,p_order_id,'payment_proof_received',
   'whatsapp','customer',jsonb_build_object('proof_id',v_proof.id));
 INSERT INTO public.restaurant_ops_outbox(company_id,order_id,kind,payload)
 VALUES(p_company_id,p_order_id,'payment_proof_received',
   jsonb_build_object('proof_id',v_proof.id));
 RETURN to_jsonb(v_proof);
END $$;

CREATE OR REPLACE FUNCTION public.restaurant_ops_review_payment_proof(
 p_company_id text,p_proof_id uuid,p_decision text,p_actor_id text,
 p_actor_role text,p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_proof public.restaurant_ops_payment_proofs%ROWTYPE;
        v_order public.restaurant_ops_orders%ROWTYPE;
BEGIN
 IF p_company_id<>'delibocados' OR p_actor_role NOT IN ('owner','admin')
   OR length(trim(coalesce(p_actor_id,'')))<1
 THEN RAISE EXCEPTION 'PAYMENT_REVIEW_FORBIDDEN'; END IF;
 IF p_decision NOT IN ('approve','reject')
 THEN RAISE EXCEPTION 'INVALID_PAYMENT_REVIEW_DECISION'; END IF;
 IF p_decision='reject' AND length(trim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500
 THEN RAISE EXCEPTION 'REJECTION_REASON_REQUIRED'; END IF;
 SELECT * INTO v_proof FROM public.restaurant_ops_payment_proofs
 WHERE company_id=p_company_id AND id=p_proof_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROOF_NOT_FOUND'; END IF;
 SELECT * INTO v_order FROM public.restaurant_ops_orders
 WHERE company_id=p_company_id AND id=v_proof.order_id FOR UPDATE;
 IF NOT FOUND OR v_order.status='cancelled'
 THEN RAISE EXCEPTION 'ORDER_NOT_REVIEWABLE'; END IF;
 SELECT * INTO v_proof FROM public.restaurant_ops_payment_proofs
 WHERE company_id=p_company_id AND id=p_proof_id FOR UPDATE;
 IF v_proof.status<>'pending_review' THEN
   RAISE EXCEPTION 'PROOF_ALREADY_REVIEWED';
 END IF;
 IF v_order.payment_method<>'transfer' OR v_order.payment_status<>'proof_submitted'
 THEN RAISE EXCEPTION 'ORDER_PAYMENT_STATE_CHANGED'; END IF;

 UPDATE public.restaurant_ops_payment_proofs
 SET status=CASE WHEN p_decision='approve' THEN 'approved' ELSE 'rejected' END,
  reviewed_by=p_actor_id,reviewed_at=now(),
  rejection_reason=CASE WHEN p_decision='reject' THEN trim(p_reason) ELSE NULL END
 WHERE id=p_proof_id AND company_id=p_company_id RETURNING * INTO v_proof;
 UPDATE public.restaurant_ops_orders
 SET payment_status=CASE WHEN p_decision='approve' THEN 'verified' ELSE 'pending' END,
  version=version+1,updated_at=now()
 WHERE company_id=p_company_id AND id=v_order.id;
 IF p_decision='approve' THEN
   UPDATE public.restaurant_ops_kitchen_tickets
   SET status='queued',queued_at=now()
   WHERE company_id=p_company_id AND order_id=v_order.id AND status='on_hold';
 END IF;
 INSERT INTO public.restaurant_ops_order_events(
  company_id,order_id,event_type,actor_id,actor_role,details
 ) VALUES(p_company_id,v_order.id,
  CASE WHEN p_decision='approve' THEN 'payment_verified' ELSE 'payment_rejected' END,
  p_actor_id,p_actor_role,
  jsonb_build_object('proof_id',v_proof.id,'reason',coalesce(p_reason,'')));
 INSERT INTO public.restaurant_ops_outbox(company_id,order_id,kind,payload)
 VALUES(p_company_id,v_order.id,
  CASE WHEN p_decision='approve' THEN 'payment_verified' ELSE 'payment_rejected' END,
  jsonb_build_object('proof_id',v_proof.id,'reason',coalesce(p_reason,'')));
 RETURN jsonb_build_object('proof',to_jsonb(v_proof),'order_id',v_order.id,
   'payment_status',CASE WHEN p_decision='approve' THEN 'verified' ELSE 'pending' END);
END $$;

-- Forbid bypassing transfer review via the general admin "mark paid" RPC.
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
 IF v_order.payment_method='transfer' AND
    p_payment_status IN ('verified','cash_on_delivery','refunded')
 THEN RAISE EXCEPTION 'TRANSFER_REQUIRES_PROOF_REVIEW'; END IF;
 IF p_payment_status NOT IN ('pending','proof_submitted','verified','cash_on_delivery','refunded')
 THEN RAISE EXCEPTION 'INVALID_PAYMENT_STATUS'; END IF;
 IF v_order.payment_status='refunded' OR
   (p_payment_status='refunded' AND v_order.payment_status<>'verified') OR
   (v_order.status='cancelled' AND p_payment_status NOT IN ('refunded','pending'))
 THEN RAISE EXCEPTION 'PAYMENT_TRANSITION_FORBIDDEN'; END IF;
 IF p_payment_status='verified' AND p_actor_role NOT IN ('owner','admin')
 THEN RAISE EXCEPTION 'PAYMENT_VERIFICATION_REQUIRES_MANAGER'; END IF;
 UPDATE public.restaurant_ops_orders SET payment_status=p_payment_status,
  payment_method=CASE WHEN v_order.payment_method='transfer' THEN 'transfer'
                      ELSE left(coalesce(p_payment_method,''),50) END,
  version=version+1,updated_at=now()
 WHERE id=p_order_id AND company_id=p_company_id RETURNING * INTO v_order;
 INSERT INTO public.restaurant_ops_order_events(company_id,order_id,event_type,actor_id,actor_role,details)
 VALUES(p_company_id,p_order_id,'payment_status_changed',p_actor_id,p_actor_role,
 jsonb_build_object('status',p_payment_status,'method',p_payment_method));
 RETURN to_jsonb(v_order);
END $$;

REVOKE ALL ON FUNCTION public.restaurant_ops_submit_payment_proof(text,uuid,text,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.restaurant_ops_review_payment_proof(text,uuid,text,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_ops_submit_payment_proof(text,uuid,text,text)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.restaurant_ops_review_payment_proof(text,uuid,text,text,text,text)
 TO service_role;
INSERT INTO public.commerce_schema_migrations(version,description)
 VALUES('20261106200000','Restaurant payment proof review, verification, kitchen hold and audit')
 ON CONFLICT(version) DO NOTHING;
COMMIT;
