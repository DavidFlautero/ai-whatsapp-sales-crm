-- Delibocados POS360 pilot. No existing outbox rows are altered.
-- The six historical pending exports are excluded unless explicitly allowlisted.
BEGIN;
CREATE TABLE IF NOT EXISTS public.restaurant_ops_pos360_pilot_allowlist (
 export_id uuid PRIMARY KEY,
 company_id text NOT NULL CHECK(company_id='delibocados'),
 enabled boolean NOT NULL DEFAULT false,
 approved_by text NOT NULL,
 approved_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 CONSTRAINT pos360_pilot_expiry CHECK (expires_at > approved_at)
);
REVOKE ALL ON public.restaurant_ops_pos360_pilot_allowlist FROM PUBLIC, anon, authenticated;
ALTER TABLE public.restaurant_ops_pos360_pilot_allowlist ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.restaurant_ops_pos360_claim_pilot(
 p_company_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE
 v_export public.restaurant_ops_pos_exports%ROWTYPE;
 v_order public.restaurant_ops_orders%ROWTYPE;
 v_label text;
 v_lines jsonb;
BEGIN
 IF p_company_id<>'delibocados' THEN RAISE EXCEPTION 'POS360_TENANT_DENIED'; END IF;
 SELECT e.* INTO v_export
 FROM public.restaurant_ops_pos_exports e
 JOIN public.restaurant_ops_orders o
   ON o.company_id=e.company_id AND o.id=e.order_id
 JOIN public.restaurant_ops_qr_tables t
   ON t.company_id=o.company_id AND t.id=o.qr_table_id
 WHERE e.company_id='delibocados' AND e.provider='pos360'
   AND e.status='pending' AND e.attempts=0
   AND EXISTS (SELECT 1 FROM public.restaurant_ops_pos360_pilot_allowlist a
      WHERE a.company_id=e.company_id AND a.export_id=e.id
        AND a.enabled=true AND a.expires_at > now())
   AND o.source='qr' AND o.fulfillment_mode='dine_in'
   AND o.qr_kind IN ('table','general') AND o.qr_table_id IS NOT NULL
   AND o.status='confirmed'
   AND o.payment_status IN ('verified','cash_on_delivery')
   AND EXISTS (
     SELECT 1 FROM public.company_integrations cfg
     WHERE cfg.company_id=e.company_id AND cfg.provider='pos360'
       AND cfg.status='connected' AND cfg.enabled=true
   )
   AND EXISTS (
     SELECT 1 FROM public.restaurant_ops_order_items i
     WHERE i.company_id=o.company_id AND i.order_id=o.id
   )
   AND NOT EXISTS (
     SELECT 1 FROM public.restaurant_ops_order_items i
     WHERE i.company_id=o.company_id AND i.order_id=o.id
       AND NOT EXISTS (
         SELECT 1 FROM public.restaurant_ops_pos_product_map m
         WHERE m.company_id=i.company_id AND m.provider='pos360'
           AND m.product_id=i.product_id
           AND m.active=true AND m.reviewed_at IS NOT NULL
           AND length(trim(m.external_product_code))>0
       )
   )
 ORDER BY e.created_at ASC
 LIMIT 1 FOR UPDATE OF e SKIP LOCKED;

 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO v_order FROM public.restaurant_ops_orders o
 WHERE o.company_id=v_export.company_id AND o.id=v_export.order_id;
 SELECT t.label INTO v_label FROM public.restaurant_ops_qr_tables t
 WHERE t.company_id=v_order.company_id AND t.id=v_order.qr_table_id;

 SELECT jsonb_agg(jsonb_build_object(
   'productId',i.product_id,
   'pos360Code',m.external_product_code,
   'name',i.product_name,
   'quantity',i.quantity,
   'unitPriceCOP',i.unit_price_cop,
   'lineTotalCOP',i.line_total_cop,
   'instructions',i.instructions
 ) ORDER BY i.id) INTO v_lines
 FROM public.restaurant_ops_order_items i
 JOIN public.restaurant_ops_pos_product_map m
   ON m.company_id=i.company_id AND m.product_id=i.product_id
   AND m.provider='pos360' AND m.active=true AND m.reviewed_at IS NOT NULL
 WHERE i.company_id=v_export.company_id AND i.order_id=v_export.order_id;

 IF v_lines IS NULL OR v_label IS NULL
 THEN RAISE EXCEPTION 'POS360_PAYLOAD_INCOMPLETE'; END IF;
 -- Atomic claim before handing the order to the Windows bridge. The
 -- externalRef is reused by the adapter for vendor-level idempotency.
 UPDATE public.restaurant_ops_pos_exports SET
   status='sending',attempts=1,last_attempt_at=now(),updated_at=now()
 WHERE id=v_export.id AND company_id=v_export.company_id;

 INSERT INTO public.restaurant_ops_order_events(
   company_id,order_id,event_type,actor_id,actor_role,details
 ) VALUES (
   'delibocados',v_order.id,'pos_export_claimed',
   'pos360-bridge','system',
   jsonb_build_object('provider','pos360','export_id',v_export.id)
 );
 RETURN jsonb_build_object(
   'exportId',v_export.id,
   'orderId',v_order.id,
   'orderNumber',v_order.number,
   'externalReference',v_export.external_reference,
   'tableId',v_order.qr_table_id,
   'tableLabel',v_label,
   'tableSessionId',v_order.table_session_id,
   'totalCOP',v_order.total_cop,
   'paymentMethod',v_order.payment_method,
   'customerNote',v_order.customer_note,
   'items',v_lines
 );
END $$;

REVOKE ALL ON FUNCTION public.restaurant_ops_pos360_claim_pilot(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_ops_pos360_claim_pilot(text) TO service_role;
INSERT INTO public.commerce_schema_migrations(version,description)
VALUES('20261122220000','POS360 pilot-only claim; existing queue stays untouched')
ON CONFLICT(version) DO NOTHING;
COMMIT;
