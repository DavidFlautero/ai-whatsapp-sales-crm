BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_venue_owner_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  provider_id uuid NOT NULL REFERENCES public.crm_providers(id),
  venue_id uuid NOT NULL REFERENCES public.crm_venues(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('image','video')),
  bucket text NOT NULL,
  path text NOT NULL,
  url text NOT NULL,
  is_cover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bucket, path)
);

CREATE INDEX IF NOT EXISTS owner_assets_lookup
  ON public.crm_venue_owner_assets(company_id, venue_id);

CREATE TABLE IF NOT EXISTS public.crm_venue_owner_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  provider_id uuid NOT NULL REFERENCES public.crm_providers(id),
  venue_id uuid NOT NULL REFERENCES public.crm_venues(id) ON DELETE CASCADE,
  title text NOT NULL,
  terms text,
  document_url text,
  status text NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','pending','signed','expired','cancelled')),
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_venue_owner_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  provider_id uuid NOT NULL REFERENCES public.crm_providers(id),
  venue_id uuid NOT NULL REFERENCES public.crm_venues(id) ON DELETE CASCADE,
  period_label text NOT NULL,
  gross_amount numeric(12,2) NOT NULL DEFAULT 0,
  commission_amount numeric(12,2) NOT NULL DEFAULT 0,
  net_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_venue_owner_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  provider_id uuid NOT NULL REFERENCES public.crm_providers(id),
  venue_id uuid NOT NULL REFERENCES public.crm_venues(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK(status IN ('open','reviewing','resolved','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS owner_contracts_lookup
  ON public.crm_venue_owner_contracts(company_id,venue_id);

CREATE INDEX IF NOT EXISTS owner_settlements_lookup
  ON public.crm_venue_owner_settlements(company_id,venue_id);

CREATE INDEX IF NOT EXISTS owner_incidents_lookup
  ON public.crm_venue_owner_incidents(company_id,venue_id);

ALTER TABLE public.crm_venue_owner_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_venue_owner_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_venue_owner_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_venue_owner_incidents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.crm_venue_owner_assets,
  public.crm_venue_owner_contracts,
  public.crm_venue_owner_settlements,
  public.crm_venue_owner_incidents
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.crm_venue_owner_assets,
  public.crm_venue_owner_contracts,
  public.crm_venue_owner_settlements,
  public.crm_venue_owner_incidents
TO service_role;

COMMIT;
