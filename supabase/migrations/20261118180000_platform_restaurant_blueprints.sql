-- Neuromind reusable restaurant blueprint.
-- Additive and disabled by default: no POS claims, no QR publishing, no invoices.
BEGIN;

-- A DIAN connector describes a fiscal capability, not a DIAN certification.
ALTER TABLE public.company_integrations
  DROP CONSTRAINT IF EXISTS company_integrations_provider_check;
ALTER TABLE public.company_integrations
  ADD CONSTRAINT company_integrations_provider_check
  CHECK (provider IN ('ninox','toteat','pos360','whapi','native','dian'));

CREATE TABLE IF NOT EXISTS public.platform_restaurant_blueprints (
  company_id text PRIMARY KEY REFERENCES public.commerce_companies(id) ON DELETE CASCADE,
  template_key text NOT NULL DEFAULT 'restaurant',
  template_version integer NOT NULL DEFAULT 1 CHECK (template_version > 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','configured','suspended')),
  qr_enabled boolean NOT NULL DEFAULT false,
  pos_bridge_enabled boolean NOT NULL DEFAULT false,
  fiscal_enabled boolean NOT NULL DEFAULT false,
  kitchen_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blueprint_template_key_valid CHECK (template_key='restaurant')
);

CREATE TABLE IF NOT EXISTS public.platform_restaurant_setup_steps (
  company_id text NOT NULL REFERENCES public.platform_restaurant_blueprints(company_id)
    ON DELETE CASCADE,
  step_key text NOT NULL CHECK (step_key IN (
    'identity','modules','catalog','tables_qr','whatsapp',
    'pos360','kitchen','fiscal','acceptance'
  )),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','configured','verified','blocked')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id,step_key)
);

ALTER TABLE public.platform_restaurant_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_restaurant_setup_steps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_restaurant_blueprints FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.platform_restaurant_setup_steps FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.platform_restaurant_blueprints TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.platform_restaurant_setup_steps TO service_role;

-- Can be retried safely; never replaces tenant configuration or credentials.
CREATE OR REPLACE FUNCTION public.platform_prepare_restaurant_blueprint(p_company_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_sector text; v_steps integer;
BEGIN
  IF p_company_id IS NULL OR
     p_company_id !~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$'
  THEN RAISE EXCEPTION 'INVALID_COMPANY_ID'; END IF;

  SELECT sector INTO v_sector
  FROM public.platform_company_onboarding
  WHERE company_id=p_company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMPANY_NOT_PROVISIONED'; END IF;
  IF v_sector<>'restaurant' THEN RAISE EXCEPTION 'COMPANY_NOT_RESTAURANT'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_company_id));

  INSERT INTO public.platform_restaurant_blueprints(company_id)
  VALUES(p_company_id) ON CONFLICT (company_id) DO NOTHING;

  INSERT INTO public.platform_restaurant_setup_steps(company_id,step_key)
  SELECT p_company_id,k FROM unnest(ARRAY[
    'identity','modules','catalog','tables_qr','whatsapp',
    'pos360','kitchen','fiscal','acceptance'
  ]) AS k
  ON CONFLICT (company_id,step_key) DO NOTHING;

  INSERT INTO public.company_integrations(company_id,provider,status,enabled)
  SELECT p_company_id,p,'pending',false
  FROM unnest(ARRAY['native','whapi','toteat','pos360','dian']) AS p
  ON CONFLICT(company_id,provider) DO NOTHING;

  SELECT count(*) INTO v_steps FROM public.platform_restaurant_setup_steps
  WHERE company_id=p_company_id;

  RETURN jsonb_build_object(
    'companyId',p_company_id,
    'template','restaurant',
    'version',1,
    'setupSteps',v_steps,
    'activated',false
  );
END $$;

REVOKE ALL ON FUNCTION public.platform_prepare_restaurant_blueprint(text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_prepare_restaurant_blueprint(text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.platform_seed_restaurant_blueprint()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.sector='restaurant' THEN
    PERFORM public.platform_prepare_restaurant_blueprint(NEW.company_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS platform_company_restaurant_blueprint_seed
  ON public.platform_company_onboarding;
CREATE TRIGGER platform_company_restaurant_blueprint_seed
AFTER INSERT ON public.platform_company_onboarding
FOR EACH ROW EXECUTE FUNCTION public.platform_seed_restaurant_blueprint();

REVOKE ALL ON FUNCTION public.platform_seed_restaurant_blueprint()
  FROM PUBLIC,anon,authenticated;

INSERT INTO public.commerce_schema_migrations(version,description)
VALUES('20261118180000','Reusable inactive restaurant blueprint for Super Admin')
ON CONFLICT(version) DO NOTHING;

COMMIT;
