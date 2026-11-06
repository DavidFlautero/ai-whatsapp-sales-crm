CREATE TABLE IF NOT EXISTS public.platform_company_modules (
  company_id text NOT NULL,
  module_key text NOT NULL CHECK (module_key IN (
    'whatsapp','ai','orders','customers','catalog','qr','floorplan','integrations'
  )),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id,module_key)
);
ALTER TABLE public.platform_company_modules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_company_modules FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON public.platform_company_modules TO service_role;
