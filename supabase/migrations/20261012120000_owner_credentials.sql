BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_venue_owner_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  provider_id uuid NOT NULL REFERENCES public.crm_providers(id),
  activation_invitation_id uuid NOT NULL
    REFERENCES public.crm_venue_owner_invitations(id),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider_id),
  CONSTRAINT owner_username_format
    CHECK (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$')
);

ALTER TABLE public.crm_venue_owner_accounts
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.crm_venue_owner_accounts
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.crm_venue_owner_accounts TO service_role;

-- Permitir varias sesiones por invitación de activación.
ALTER TABLE public.crm_venue_owner_sessions
  DROP CONSTRAINT IF EXISTS
  crm_venue_owner_sessions_invitation_id_key;

CREATE OR REPLACE FUNCTION public.crm_owner_register(
  p_invitation_hash text,
  p_username text,
  p_password_hash text,
  p_session_hash text,
  p_session_expires_at timestamptz
)
RETURNS TABLE (
  company_id text,
  provider_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.crm_venue_owner_invitations%ROWTYPE;
  existing_account uuid;
BEGIN
  SELECT * INTO inv
  FROM public.crm_venue_owner_invitations
  WHERE token_hash = p_invitation_hash
  FOR UPDATE;

  IF NOT FOUND
     OR inv.used_at IS NOT NULL
     OR inv.revoked_at IS NOT NULL
     OR inv.expires_at <= now()
  THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.crm_providers p
    WHERE p.id = inv.provider_id
      AND p.company_id = inv.company_id
      AND p.status = 'active'
  ) THEN
    RETURN;
  END IF;

  IF p_username !~ '^[a-z0-9][a-z0-9._-]{2,31}$'
     OR p_password_hash NOT LIKE 'scrypt$v1$%'
     OR p_session_expires_at <= now()
  THEN
    RETURN;
  END IF;

  SELECT id INTO existing_account
  FROM public.crm_venue_owner_accounts
  WHERE crm_venue_owner_accounts.company_id = inv.company_id
    AND crm_venue_owner_accounts.provider_id = inv.provider_id
  FOR UPDATE;

  IF existing_account IS NULL THEN
    INSERT INTO public.crm_venue_owner_accounts (
      company_id, provider_id, activation_invitation_id,
      username, password_hash
    ) VALUES (
      inv.company_id, inv.provider_id, inv.id,
      p_username, p_password_hash
    );
  ELSE
    -- Nueva invitación: recuperación de credenciales.
    UPDATE public.crm_venue_owner_accounts
    SET username = p_username,
        password_hash = p_password_hash,
        activation_invitation_id = inv.id,
        updated_at = now()
    WHERE id = existing_account;

    UPDATE public.crm_venue_owner_sessions
    SET revoked_at = now()
    WHERE crm_venue_owner_sessions.company_id = inv.company_id
      AND crm_venue_owner_sessions.provider_id = inv.provider_id
      AND revoked_at IS NULL;
  END IF;

  UPDATE public.crm_venue_owner_invitations
  SET used_at = now()
  WHERE id = inv.id;

  INSERT INTO public.crm_venue_owner_sessions (
    company_id, provider_id, invitation_id,
    token_hash, expires_at
  ) VALUES (
    inv.company_id, inv.provider_id, inv.id,
    p_session_hash, p_session_expires_at
  );

  RETURN QUERY SELECT inv.company_id, inv.provider_id;

EXCEPTION WHEN unique_violation THEN
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_owner_register(
  text, text, text, text, timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.crm_owner_register(
  text, text, text, text, timestamptz
) TO service_role;

COMMIT;
