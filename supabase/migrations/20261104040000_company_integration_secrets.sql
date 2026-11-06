BEGIN;

CREATE TABLE IF NOT EXISTS public.company_integration_secrets (
  company_id text NOT NULL,
  provider text NOT NULL,

  ciphertext bytea NOT NULL,
  iv bytea NOT NULL,
  auth_tag bytea NOT NULL,

  key_version integer NOT NULL DEFAULT 1
    CHECK (key_version > 0),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (company_id, provider),

  CONSTRAINT company_secret_integration_fk
    FOREIGN KEY (company_id, provider)
    REFERENCES public.company_integrations(company_id, provider)
    ON DELETE CASCADE,

  CONSTRAINT company_secret_iv_length
    CHECK (octet_length(iv) = 12),

  CONSTRAINT company_secret_auth_tag_length
    CHECK (octet_length(auth_tag) = 16),

  CONSTRAINT company_secret_ciphertext_length
    CHECK (octet_length(ciphertext) > 0)
);

ALTER TABLE public.company_integration_secrets
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.company_integration_secrets
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.company_integration_secrets
  TO service_role;

INSERT INTO public.commerce_schema_migrations (
  version,
  description
)
VALUES (
  '20261104040000',
  'Encrypted company integration secrets storage'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
