BEGIN;

CREATE TABLE IF NOT EXISTS public.company_integrations (
  company_id text NOT NULL
    REFERENCES public.commerce_companies(id)
    ON DELETE CASCADE,

  provider text NOT NULL
    CHECK (provider IN (
      'ninox',
      'toteat',
      'pos360',
      'whapi',
      'native'
    )),

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'connected',
      'disabled'
    )),

  enabled boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (company_id, provider)
);

ALTER TABLE public.company_integrations
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.company_integrations
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.company_integrations
  TO service_role;

INSERT INTO public.commerce_schema_migrations (
  version,
  description
)
VALUES (
  '20261104020000',
  'Company-scoped integration registry'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
