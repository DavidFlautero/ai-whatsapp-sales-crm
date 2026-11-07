-- Customer support extension: genuine purchase history and item-level WhatsApp claims.
BEGIN;
ALTER TABLE public.restaurant_ops_incidents
 ADD COLUMN IF NOT EXISTS customer_phone text,
 ADD COLUMN IF NOT EXISTS reported_item_id text,
 ADD COLUMN IF NOT EXISTS reported_item_name text,
 ADD COLUMN IF NOT EXISTS received_item_description text,
 ADD COLUMN IF NOT EXISTS source_message_id text,
 ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'panel';
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_ops_incident_source_idx
 ON public.restaurant_ops_incidents(company_id,source_message_id);
CREATE INDEX IF NOT EXISTS restaurant_ops_incident_phone_idx
 ON public.restaurant_ops_incidents(company_id,customer_phone,created_at DESC);

-- Restaurant dispatch starts from operator-verified coordinates, never a guessed address.
ALTER TABLE public.restaurant_agent_business_profiles
 ADD COLUMN IF NOT EXISTS origin_lat double precision,
 ADD COLUMN IF NOT EXISTS origin_lng double precision,
 ADD COLUMN IF NOT EXISTS origin_verified boolean NOT NULL DEFAULT false;
DO $
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='restaurant_origin_coordinates_valid') THEN
   ALTER TABLE public.restaurant_agent_business_profiles
   ADD CONSTRAINT restaurant_origin_coordinates_valid
   CHECK (NOT origin_verified OR (
     origin_lat BETWEEN -90 AND 90 AND origin_lng BETWEEN -180 AND 180
   ));
 END IF;
END $;

-- Every order remains the source of truth: no duplicate storage of private addresses.
CREATE OR REPLACE VIEW public.restaurant_ops_customer_order_profiles
 WITH (security_invoker = true) AS
 SELECT q.company_id,q.customer_phone,
   count(*)::integer AS order_count,
   count(*) FILTER(WHERE q.status='completed')::integer AS completed_orders,
   sum(q.total_cop) FILTER(WHERE q.status='completed') AS completed_spend_cop,
   max(q.created_at) AS last_order_at,
   (array_agg(q.customer_name ORDER BY q.created_at DESC))[1] AS confirmed_name,
   (array_agg(q.number ORDER BY q.created_at DESC))[1] AS last_order_number,
   (array_agg(q.address ORDER BY q.created_at DESC)
     FILTER(WHERE q.address IS NOT NULL))[1] AS last_confirmed_delivery_address,
   (array_agg(q.payment_method ORDER BY q.created_at DESC)
     FILTER(WHERE q.payment_method IS NOT NULL))[1] AS last_payment_method
 FROM public.restaurant_ops_orders q
 GROUP BY q.company_id,q.customer_phone;
REVOKE ALL ON public.restaurant_ops_customer_order_profiles FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.restaurant_ops_customer_order_profiles TO service_role;

INSERT INTO public.commerce_schema_migrations(version,description)
 VALUES('20261107124500','Restaurant verified customer history and item-level complaints')
 ON CONFLICT(version) DO NOTHING;
COMMIT;
