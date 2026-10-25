-- Portal privado de propietarios - Eventos Mediterraneo

CREATE TABLE IF NOT EXISTS public.crm_venue_owner_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  provider_id uuid NOT NULL REFERENCES public.crm_providers(id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_venue_owner_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  provider_id uuid NOT NULL REFERENCES public.crm_providers(id),
  invitation_id uuid NOT NULL UNIQUE
    REFERENCES public.crm_venue_owner_invitations(id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_invites_provider
ON public.crm_venue_owner_invitations
(company_id, provider_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_owner_sessions_provider
ON public.crm_venue_owner_sessions
(company_id, provider_id, expires_at);

ALTER TABLE public.crm_venue_owner_invitations
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_venue_owner_sessions
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.crm_venue_owner_invitations
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON public.crm_venue_owner_sessions
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.crm_venue_owner_invitations
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.crm_venue_owner_sessions
TO service_role;
