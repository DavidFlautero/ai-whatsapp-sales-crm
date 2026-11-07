-- Tenant-isolated restaurant settings and supervised lessons from conversations.
BEGIN;
CREATE TABLE IF NOT EXISTS public.restaurant_agent_business_profiles (
 company_id text PRIMARY KEY REFERENCES public.commerce_companies(id) ON DELETE CASCADE,
 business_name text NOT NULL DEFAULT 'Delibocados' CHECK(length(trim(business_name)) BETWEEN 2 AND 120),
 description text NOT NULL DEFAULT '' CHECK(length(description) <= 1500),
 location_address text NOT NULL DEFAULT '' CHECK(length(location_address) <= 250),
 public_phone text NOT NULL DEFAULT '' CHECK(length(public_phone) <= 40),
 city text NOT NULL DEFAULT 'Funza' CHECK(length(trim(city)) BETWEEN 2 AND 100),
 timezone text NOT NULL DEFAULT 'America/Bogota' CHECK(timezone='America/Bogota'),
 coverage_summary text NOT NULL DEFAULT 'Sectores verificados de Funza y Mosquera. No Bogotá.' CHECK(length(coverage_summary)<=1000),
 opening_hours jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(opening_hours)='object'),
 special_hours_note text NOT NULL DEFAULT '' CHECK(length(special_hours_note)<=700),
 tone text NOT NULL DEFAULT 'natural' CHECK(tone IN ('natural','formal','friendly')),
 extra_instructions text NOT NULL DEFAULT '' CHECK(length(extra_instructions)<=2000),
 learning_enabled boolean NOT NULL DEFAULT false,
 updated_by text NOT NULL DEFAULT 'system',
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.restaurant_agent_business_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_agent_business_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.restaurant_agent_business_profiles TO service_role;
CREATE TABLE IF NOT EXISTS public.restaurant_agent_learnings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id text NOT NULL REFERENCES public.commerce_companies(id) ON DELETE CASCADE,
 category text NOT NULL CHECK(category IN ('faq','service_rule','product_question')),
 question text NOT NULL CHECK(length(trim(question)) BETWEEN 8 AND 300),
 answer text NOT NULL CHECK(length(trim(answer)) BETWEEN 8 AND 900),
 evidence text NOT NULL DEFAULT '' CHECK(length(evidence)<=500),
 source_type text NOT NULL CHECK(source_type IN ('conversation','manual')),
 status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 reviewed_by text,
 UNIQUE(company_id,category,question)
);
CREATE INDEX IF NOT EXISTS restaurant_agent_learnings_status_idx ON public.restaurant_agent_learnings(company_id,status,created_at DESC);
ALTER TABLE public.restaurant_agent_learnings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restaurant_agent_learnings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.restaurant_agent_learnings TO service_role;
INSERT INTO public.restaurant_agent_business_profiles(company_id)
 SELECT id FROM public.commerce_companies WHERE id='delibocados'
 ON CONFLICT(company_id) DO NOTHING;
INSERT INTO public.commerce_schema_migrations(version,description)
 VALUES('20261107103000','Restaurant AI business hours and owner-reviewed learning')
 ON CONFLICT(version) DO NOTHING;
COMMIT;