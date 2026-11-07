-- Split transfer + cash (COP), with bank proof approval and cash collection audit.
-- All order totals remain server-priced from restaurant_menu_documents.
BEGIN;
CREATE TABLE IF NOT EXISTS public.restaurant_ops_split_payments (
  company_id text NOT NULL,
  order_id uuid NOT NULL,
  transfer_due_cop integer NOT NULL CHECK(transfer_due_cop > 0),
  cash_due_cop integer NOT NULL CHECK(cash_due_cop > 0),
  transfer_verified_cop integer NOT NULL DEFAULT 0 CHECK(transfer_verified_cop >= 0),
  cash_collected_cop integer NOT NULL DEFAULT 0 CHECK(cash_collected_cop >= 0),
  transfer_verified_by text,
  transfer_verified_at timestamptz,
  cash_collected_by text,
  cash_collected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(company_id,order_id),
  FOREIGN KEY(company_id,order_id)
    REFERENCES public.restaurant_ops_orders(company_id,id) ON DELETE CASCADE,
  CHECK(transfer_verified_cop IN (0,transfer_due_cop)),
  CHECK(cash_collected_cop IN (0,cash_due_cop))
);
ALTER TABLE public.restaurant_ops_split_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_ops_split_payments FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.restaurant_ops_split_payments TO service_role;

-- Server-authoritative and idempotent creation: creates order + financial split
-- in one transaction; any failure rolls both back.
CREATE OR REPLACE FUNCTION public.restaurant_ops_create_split_order(
 p_company_id text,p_source text,p_source_key text,
 p_customer_phone text,p_customer_name text,
 p_fulfillment_mode text,p_items jsonb,p_transfer_cop integer,
 p_zone_id uuid DEFAULT NULL,p_address text DEFAULT NULL,
 p_address_note text DEFAULT NULL,p_customer_note text DEFAULT NULL,
 p_pickup_due_at timestamptz DEFAULT NULL,
 p_actor_id text DEFAULT 'system',p_actor_role text DEFAULT 'system',
 p_customer_confirmed boolean DEFAULT false,
 p_expected_menu_revision integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order jsonb; v_id uuid; v_total integer;
        v_split public.restaurant_ops_split_payments%ROWTYPE;
BEGIN
 IF p_company_id<>'delibocados' OR p_customer_confirmed IS DISTINCT FROM true
   OR p_transfer_cop IS NULL OR p_transfer_cop<1
 THEN RAISE EXCEPTION 'SPLIT_ORDER_INVALID'; END IF;
 -- The base RPC verifies menu availability, current official price, zone
 -- delivery fee, customer confirmation and idempotency key.
 v_order:=public.restaurant_ops_create_order(
   p_company_id=>p_company_id,p_source=>p_source,
   p_source_key=>p_source_key,p_customer_phone=>p_customer_phone,
   p_customer_name=>p_customer_name,p_fulfillment_mode=>p_fulfillment_mode,
   p_items=>p_items,p_zone_id=>p_zone_id,p_address=>p_address,
   p_address_note=>p_address_note,p_customer_note=>p_customer_note,
   p_pickup_due_at=>p_pickup_due_at,p_actor_id=>p_actor_id,
   p_actor_role=>p_actor_role,p_customer_confirmed=>true,
   p_expected_menu_revision=>p_expected_menu_revision,
   p_payment_method=>'mixed',p_payment_status=>'pending'
 );
 v_id:=(v_order->>'id')::uuid;
 v_total:=(v_order->>'total_cop')::integer;
 IF p_transfer_cop>=v_total THEN RAISE EXCEPTION 'SPLIT_REQUIRES_POSITIVE_CASH_BALANCE'; END IF;
 INSERT INTO public.restaurant_ops_split_payments(
   company_id,order_id,transfer_due_cop,cash_due_cop
 ) VALUES (p_company_id,v_id,p_transfer_cop,v_total-p_transfer_cop)
 ON CONFLICT(company_id,order_id) DO NOTHING;
 SELECT * INTO v_split FROM public.restaurant_ops_split_payments
 WHERE company_id=p_company_id AND order_id=v_id;
 IF v_split.transfer_due_cop IS DISTINCT FROM p_transfer_cop OR
    v_split.cash_due_cop IS DISTINCT FROM (v_total-p_transfer_cop)
 THEN RAISE EXCEPTION 'SPLIT_IDEMPOTENCY_CONFLICT'; END IF;
 RETURN v_order;
END $$;

-- Holds mixed-payment orders until bank transfer verification.
CREATE OR REPLACE FUNCTION public.restaurant_ops_kitchen_hold_new()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_method text; v_status text;
BEGIN
  SELECT payment_method,payment_status INTO v_method,v_status
    FROM public.restaurant_ops_orders
    WHERE company_id=NEW.company_id AND id=NEW.order_id;
  IF v_method IN ('transfer','mixed') AND v_status NOT IN ('verified','cash_on_delivery') THEN
    NEW.status:='on_hold';
  END IF;
  RETURN NEW;
END $$;

UPDATE public.restaurant_ops_kitchen_tickets k
SET status='on_hold'
FROM public.restaurant_ops_orders o
WHERE k.company_id=o.company_id AND k.order_id=o.id
  AND o.company_id='delibocados' AND o.payment_method='mixed'
  AND o.payment_status NOT IN ('cash_on_delivery','verified')
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
 SELECT * INTO v_proof FROM public.restaurant_ops_payment_proofs
  WHERE company_id=p_company_id AND source_message_id=p_source_message_id;
 IF FOUND THEN
   IF v_proof.order_id<>p_order_id THEN RAISE EXCEPTION 'PROOF_ALREADY_ASSOCIATED'; END IF;
   RETURN to_jsonb(v_proof);
 END IF;
 IF v_order.payment_method NOT IN ('transfer','mixed') OR v_order.status='cancelled'
   OR v_order.payment_status NOT IN ('pending','proof_submitted')
 THEN RAISE EXCEPTION 'ORDER_NOT_AWAITING_TRANSFER'; END IF;
 IF EXISTS(
   SELECT 1 FROM public.restaurant_ops_payment_proofs
   WHERE company_id=p_company_id AND order_id=p_order_id AND status='pending_review'
 ) THEN RAISE EXCEPTION 'PROOF_ALREADY_PENDING_REVIEW'; END IF;

 IF v_order.payment_method='mixed' AND NOT EXISTS (
    SELECT 1 FROM public.restaurant_ops_split_payments
     WHERE company_id=p_company_id AND order_id=p_order_id
       AND transfer_verified_cop=0
 ) THEN RAISE EXCEPTION 'SPLIT_LEDGER_NOT_READY'; END IF;

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
 IF v_order.payment_method NOT IN ('transfer','mixed') OR v_order.payment_status<>'proof_submitted'
 THEN RAISE EXCEPTION 'ORDER_PAYMENT_STATE_CHANGED'; END IF;

 IF v_order.payment_method='mixed' AND NOT EXISTS (
   SELECT 1 FROM public.restaurant_ops_split_payments
    WHERE company_id=p_company_id AND order_id=v_order.id
      AND transfer_verified_cop=0
 ) THEN RAISE EXCEPTION 'SPLIT_LEDGER_MISSING_OR_ALREADY_VERIFIED'; END IF;

 UPDATE public.restaurant_ops_payment_proofs
 SET status=CASE WHEN p_decision='approve' THEN 'approved' ELSE 'rejected' END,
  reviewed_by=p_actor_id,reviewed_at=now(),
  rejection_reason=CASE WHEN p_decision='reject' THEN trim(p_reason) ELSE NULL END
 WHERE id=p_proof_id AND company_id=p_company_id RETURNING * INTO v_proof;
 IF v_order.payment_method='mixed' AND p_decision='approve' THEN
   UPDATE public.restaurant_ops_split_payments
   SET transfer_verified_cop=transfer_due_cop,updated_at=now(),
       transfer_verified_by=p_actor_id,transfer_verified_at=now()
   WHERE company_id=p_company_id AND order_id=v_order.id;
 END IF;
 UPDATE public.restaurant_ops_orders
 SET payment_status=CASE WHEN p_decision='approve' AND v_order.payment_method='mixed'
                           THEN 'cash_on_delivery'
                         WHEN p_decision='approve' THEN 'verified' ELSE 'pending' END,
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
  jsonb_build_object('proof_id',v_proof.id,'reason',coalesce(p_reason,''),
   'stage',CASE WHEN v_order.payment_method='mixed' AND p_decision='approve'
     THEN 'partial_transfer_approved' ELSE 'standard' END,
   'transfer_due_cop',(SELECT transfer_due_cop FROM public.restaurant_ops_split_payments
     WHERE company_id=p_company_id AND order_id=v_order.id),
   'cash_due_cop',(SELECT cash_due_cop FROM public.restaurant_ops_split_payments
     WHERE company_id=p_company_id AND order_id=v_order.id)));
 INSERT INTO public.restaurant_ops_outbox(company_id,order_id,kind,payload)
 VALUES(p_company_id,v_order.id,
  CASE WHEN p_decision='approve' THEN 'payment_verified' ELSE 'payment_rejected' END,
  jsonb_build_object('proof_id',v_proof.id,'reason',coalesce(p_reason,'')));
 RETURN jsonb_build_object('proof',to_jsonb(v_proof),'order_id',v_order.id,
   'payment_status',CASE WHEN p_decision='approve' AND v_order.payment_method='mixed'
     THEN 'cash_on_delivery' WHEN p_decision='approve' THEN 'verified' ELSE 'pending' END);
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
 IF v_order.payment_method='mixed' THEN RAISE EXCEPTION 'SPLIT_REQUIRES_AUDITED_PAYMENT_FLOW'; END IF;
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

-- Disallow completing a mixed order before the remaining cash is recorded.
CREATE OR REPLACE FUNCTION public.restaurant_ops_require_split_cash_to_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.company_id='delibocados' AND NEW.payment_method='mixed' AND
    NEW.status='completed' AND OLD.status IS DISTINCT FROM NEW.status AND
    EXISTS(SELECT 1 FROM public.restaurant_ops_split_payments s
      WHERE s.company_id=NEW.company_id AND s.order_id=NEW.id
        AND (s.transfer_verified_cop<s.transfer_due_cop OR
          s.cash_collected_cop<s.cash_due_cop))
 THEN RAISE EXCEPTION 'SPLIT_CASH_NOT_FULLY_COLLECTED'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS restaurant_ops_complete_requires_cash
  ON public.restaurant_ops_orders;
CREATE TRIGGER restaurant_ops_complete_requires_cash
BEFORE UPDATE OF status ON public.restaurant_ops_orders
FOR EACH ROW EXECUTE FUNCTION public.restaurant_ops_require_split_cash_to_complete();

-- Exact settlement for the outstanding cash portion; idempotent amount check.
CREATE OR REPLACE FUNCTION public.restaurant_ops_collect_split_cash(
 p_company_id text,p_order_id uuid,p_expected_version integer,
 p_amount_cop integer,p_actor_id text,p_actor_role text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order public.restaurant_ops_orders%ROWTYPE;
        v_split public.restaurant_ops_split_payments%ROWTYPE;
BEGIN
 IF p_company_id<>'delibocados' OR p_actor_role NOT IN ('owner','admin','supervisor')
   OR length(trim(coalesce(p_actor_id,'')))=0
 THEN RAISE EXCEPTION 'SPLIT_CASH_FORBIDDEN'; END IF;
 SELECT * INTO v_order FROM public.restaurant_ops_orders
 WHERE company_id=p_company_id AND id=p_order_id FOR UPDATE;
 IF NOT FOUND OR v_order.payment_method<>'mixed' OR v_order.status='cancelled'
 THEN RAISE EXCEPTION 'SPLIT_ORDER_NOT_FOUND'; END IF;
 IF v_order.version<>p_expected_version THEN RAISE EXCEPTION 'ORDER_VERSION_CONFLICT'; END IF;
 SELECT * INTO v_split FROM public.restaurant_ops_split_payments
 WHERE company_id=p_company_id AND order_id=p_order_id FOR UPDATE;
 IF NOT FOUND OR v_split.transfer_verified_cop<>v_split.transfer_due_cop
   OR v_order.payment_status<>'cash_on_delivery'
 THEN RAISE EXCEPTION 'PARTIAL_TRANSFER_NOT_VERIFIED'; END IF;
 IF v_split.cash_collected_cop<>0
 THEN RAISE EXCEPTION 'CASH_ALREADY_COLLECTED'; END IF;
 IF p_amount_cop IS DISTINCT FROM v_split.cash_due_cop
 THEN RAISE EXCEPTION 'CASH_AMOUNT_MISMATCH'; END IF;
 UPDATE public.restaurant_ops_split_payments
 SET cash_collected_cop=cash_due_cop,cash_collected_by=p_actor_id,
   cash_collected_at=now(),updated_at=now()
 WHERE company_id=p_company_id AND order_id=p_order_id;
 UPDATE public.restaurant_ops_orders
 SET payment_status='verified',version=version+1,updated_at=now()
 WHERE company_id=p_company_id AND id=p_order_id RETURNING * INTO v_order;
 INSERT INTO public.restaurant_ops_order_events(
   company_id,order_id,event_type,actor_id,actor_role,details
 ) VALUES(p_company_id,p_order_id,'split_cash_collected',p_actor_id,p_actor_role,
   jsonb_build_object('cash_collected_cop',p_amount_cop,
     'transfer_verified_cop',v_split.transfer_due_cop));
 INSERT INTO public.restaurant_ops_outbox(company_id,order_id,kind,payload)
 VALUES(p_company_id,p_order_id,'payment_verified',
   jsonb_build_object('stage','split_settled','cash_collected_cop',p_amount_cop));
 RETURN jsonb_build_object('order',to_jsonb(v_order),
   'transfer_verified_cop',v_split.transfer_due_cop,
   'cash_collected_cop',p_amount_cop);
END $$;

-- Definer RPCs are service-role only.
REVOKE ALL ON FUNCTION public.restaurant_ops_create_split_order(
 text,text,text,text,text,text,jsonb,integer,uuid,text,text,text,timestamptz,text,text,boolean,integer
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_ops_create_split_order(
 text,text,text,text,text,text,jsonb,integer,uuid,text,text,text,timestamptz,text,text,boolean,integer
) TO service_role;
REVOKE ALL ON FUNCTION public.restaurant_ops_collect_split_cash(
 text,uuid,integer,integer,text,text
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_ops_collect_split_cash(
 text,uuid,integer,integer,text,text
) TO service_role;
REVOKE ALL ON FUNCTION public.restaurant_ops_set_payment(
 text,uuid,integer,text,text,text,text
) FROM PUBLIC,anon,authenticated;

-- Restaurant bank proof audit and authorisation still exclusively manager-approved.
INSERT INTO public.commerce_schema_migrations(version,description)
 VALUES('20261107190000','Restaurant split payments with transfer verification and cash collection audit')
 ON CONFLICT(version) DO NOTHING;
COMMIT;
