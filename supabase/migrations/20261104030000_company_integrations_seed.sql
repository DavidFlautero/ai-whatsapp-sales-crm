BEGIN;

CREATE OR REPLACE FUNCTION public.platform_seed_integrations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.company_integrations (
    company_id,
    provider,
    status,
    enabled
  )
  SELECT
    NEW.company_id,
    p.provider,
    'pending',
    false
  FROM unnest(
    CASE NEW.sector
      WHEN 'restaurant' THEN
        ARRAY['native', 'whapi', 'toteat', 'pos360']
      WHEN 'retail' THEN
        ARRAY['native', 'whapi', 'ninox']
      ELSE
        ARRAY['native', 'whapi']
    END
  ) AS p(provider)
  ON CONFLICT (company_id, provider) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  platform_company_integrations_seed
  ON public.platform_company_onboarding;

CREATE TRIGGER platform_company_integrations_seed
AFTER INSERT ON public.platform_company_onboarding
FOR EACH ROW
EXECUTE FUNCTION public.platform_seed_integrations();

REVOKE ALL ON FUNCTION
  public.platform_seed_integrations()
  FROM PUBLIC, anon, authenticated;

INSERT INTO public.commerce_schema_migrations (
  version,
  description
)
VALUES (
  '20261104030000',
  'Automatic company integration provisioning'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
