-- Controlled Toteat export claim.
-- Does NOT send orders, flip integration enabled or requeue prior attempts.
-- Adds a cutover date, single-order pilot filter, and global lease.
BEGIN;
CREATE TABLE IF NOT EXISTS public.restaurant_ops_toteat_export_lease(
 company_id text PRIMARY KEY REFERENCES public.commerce_companies(id),
 last_claim_at timestamptz,
 lease_until timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.restaurant_ops_toteat_export_lease ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_ops_toteat_export_lease FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.restaurant_ops_toteat_export_lease TO service_role;

CREATE OR REPLACE FUNCTION public.restaurant_ops_pos_claim_toteat_controlled(
 p_company_id text, p_cutover timestamptz, p_only_order_id uuid DEFAULT NULL,
 p_allow_delivery boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE v_export public.restaurant_ops_pos_exports%ROWTYPE;
        v_lease public.restaurant_ops_toteat_export_lease%ROWTYPE;
BEGIN
 IF p_company_id<>'delibocados' THEN
   RAISE EXCEPTION 'POS_TENANT_NOT_ALLOWED';
 END IF;
 IF p_cutover IS NULL OR p_cutover > now() OR
    p_cutover < now()-interval '30 days'
 THEN RAISE EXCEPTION 'POS_EXPORT_CUTOVER_INVALID'; END IF;
 -- Avoid accidental bulk export. To start broader release, only new orders
 -- created after this explicit cutover are eligible.
 INSERT INTO public.restaurant_ops_toteat_export_lease(company_id)
 VALUES(p_company_id) ON CONFLICT DO NOTHING;
 SELECT * INTO v_lease FROM public.restaurant_ops_toteat_export_lease
 WHERE company_id=p_company_id FOR UPDATE;
 IF v_lease.lease_until IS NOT NULL AND v_lease.lease_until>now()
 THEN RETURN NULL; END IF;
 SELECT e.* INTO v_export
 FROM public.restaurant_ops_pos_exports e
 JOIN public.restaurant_ops_orders o
   ON o.company_id=e.company_id AND o.id=e.order_id
 WHERE e.company_id=p_company_id AND e.provider='toteat'
   AND e.status='pending' AND e.attempts=0
   AND e.created_at>=p_cutover AND o.created_at>=p_cutover
   AND (p_only_order_id IS NULL OR e.order_id=p_only_order_id)
   AND o.source='whatsapp' AND o.status='confirmed'
   AND (o.fulfillment_mode='pickup' OR
        (o.fulfillment_mode='delivery' AND p_allow_delivery IS TRUE))
   AND o.payment_status IN ('verified','cash_on_delivery')
   AND EXISTS(
     SELECT 1 FROM public.company_integrations i
     WHERE i.company_id=e.company_id AND i.provider='toteat'
       AND i.enabled=true AND i.status='connected'
   )
   AND EXISTS(
     SELECT 1 FROM public.restaurant_ops_order_items item
     WHERE item.company_id=o.company_id AND item.order_id=o.id
   )
   AND NOT EXISTS(
     SELECT 1 FROM public.restaurant_ops_order_items item
     WHERE item.company_id=o.company_id AND item.order_id=o.id
       AND NOT EXISTS(
         SELECT 1 FROM public.restaurant_ops_pos_product_map m
         WHERE m.company_id=item.company_id AND m.provider='toteat'
           AND m.product_id=item.product_id
           AND m.active=true AND m.reviewed_at IS NOT NULL
       )
   )
 ORDER BY e.created_at ASC LIMIT 1 FOR UPDATE OF e SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE public.restaurant_ops_toteat_export_lease
 SET last_claim_at=now(),lease_until=now()+interval '30 seconds',
     updated_at=now()
 WHERE company_id=p_company_id;
 UPDATE public.restaurant_ops_pos_exports
 SET status='sending',attempts=1,last_attempt_at=now(),updated_at=now()
 WHERE id=v_export.id
 RETURNING * INTO v_export;
 RETURN to_jsonb(v_export);
END $$;

REVOKE ALL ON FUNCTION
 public.restaurant_ops_pos_claim_toteat_controlled(text,timestamptz,uuid,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION
 public.restaurant_ops_pos_claim_toteat_controlled(text,timestamptz,uuid,boolean)
 TO service_role;

INSERT INTO public.commerce_schema_migrations(version,description)
VALUES('20261110210000','Delibocados controlled Toteat export cutover and global provider lease')
ON CONFLICT(version) DO NOTHING;
COMMIT;
