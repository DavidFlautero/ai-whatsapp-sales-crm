-- Alta de empresas atómica e idempotente. Instalar antes del backend.
BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_company_onboarding (
  company_id text PRIMARY KEY REFERENCES public.commerce_companies(id) ON DELETE CASCADE,
  owner_email text NOT NULL,
  sector text NOT NULL CHECK (sector IN ('restaurant','events','services','retail','other')),
  plan text NOT NULL CHECK (plan IN ('starter','professional','enterprise')),
  status text NOT NULL DEFAULT 'pending_owner' CHECK (status IN ('pending_owner','active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_company_onboarding ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_company_onboarding FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.platform_provision_company(
  p_company_id text,
  p_name text,
  p_owner_email text,
  p_sector text,
  p_plan text,
  p_currency text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  existing_name text;
  registered_owner text;
  registered_sector text;
  registered_plan text;
  registered_currency text;
BEGIN
  IF p_company_id !~ '^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$' OR length(p_company_id)>64 THEN
    RAISE EXCEPTION 'INVALID_COMPANY_ID';
  END IF;
  IF length(trim(p_name)) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'INVALID_COMPANY_NAME';
  END IF;
  IF p_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'INVALID_CURRENCY';
  END IF;
  IF p_sector NOT IN ('restaurant','events','services','retail','other') THEN
    RAISE EXCEPTION 'INVALID_SECTOR';
  END IF;
  IF p_plan NOT IN ('starter','professional','enterprise') THEN
    RAISE EXCEPTION 'INVALID_PLAN';
  END IF;
  IF length(p_owner_email) > 200 OR position('@' IN p_owner_email) < 2 THEN
    RAISE EXCEPTION 'INVALID_OWNER_EMAIL';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_company_id));
  SELECT name INTO existing_name FROM public.commerce_companies WHERE id = p_company_id;
  IF FOUND THEN
    SELECT owner_email, sector, plan
    INTO registered_owner, registered_sector, registered_plan
    FROM public.platform_company_onboarding WHERE company_id = p_company_id;
    IF NOT FOUND OR existing_name <> p_name
       OR registered_owner <> lower(p_owner_email)
       OR registered_sector <> p_sector
       OR registered_plan <> p_plan THEN
      RAISE EXCEPTION 'COMPANY_ALREADY_EXISTS' USING ERRCODE = '23505';
    END IF;
    SELECT currency INTO registered_currency
    FROM public.commerce_business_settings WHERE company_id = p_company_id;
    IF FOUND AND registered_currency <> p_currency THEN
      RAISE EXCEPTION 'COMPANY_ALREADY_EXISTS' USING ERRCODE = '23505';
    END IF;
  ELSE
    INSERT INTO public.commerce_companies(id, name, active)
    VALUES (p_company_id, p_name, false);
  END IF;

  INSERT INTO public.platform_company_onboarding(company_id,owner_email,sector,plan)
  VALUES (p_company_id,lower(p_owner_email),p_sector,p_plan)
  ON CONFLICT(company_id) DO NOTHING;

  INSERT INTO public.commerce_business_settings(company_id,currency,order_prefix)
  VALUES (p_company_id,p_currency,upper(left(regexp_replace(p_company_id,'[^a-z0-9]','','g'),3)))
  ON CONFLICT(company_id) DO NOTHING;

  INSERT INTO public.crm_company_settings(company_id,currency)
  VALUES (p_company_id,p_currency)
  ON CONFLICT(company_id) DO NOTHING;

  RETURN jsonb_build_object('company_id',p_company_id,'status','pending_owner');
END;
$$;

REVOKE ALL ON FUNCTION public.platform_provision_company(text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_provision_company(text,text,text,text,text,text) TO service_role;

COMMIT;
