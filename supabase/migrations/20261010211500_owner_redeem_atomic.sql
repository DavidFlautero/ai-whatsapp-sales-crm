-- Canje atomico de invitaciones del portal de propietarios.

CREATE OR REPLACE FUNCTION public.crm_owner_redeem_invitation(
  p_invitation_hash text,
  p_session_hash text,
  p_session_expires_at timestamptz
)
RETURNS TABLE(company_id text, provider_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invitation public.crm_venue_owner_invitations%ROWTYPE;
BEGIN
  IF p_invitation_hash !~ '^[0-9a-f]{64}$'
     OR p_session_hash !~ '^[0-9a-f]{64}$'
     OR p_session_expires_at IS NULL
     OR p_session_expires_at <= now()
     OR p_session_expires_at > now() + interval '8 days'
  THEN
    RETURN;
  END IF;

  UPDATE public.crm_venue_owner_invitations AS i
  SET used_at = now()
  WHERE i.token_hash = p_invitation_hash
    AND i.used_at IS NULL
    AND i.revoked_at IS NULL
    AND i.expires_at > now()
  RETURNING i.* INTO v_invitation;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.crm_providers AS p
    WHERE p.id = v_invitation.provider_id
      AND p.company_id = v_invitation.company_id
      AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'PROVIDER_NOT_ACTIVE';
  END IF;

  INSERT INTO public.crm_venue_owner_sessions (
    company_id,
    provider_id,
    invitation_id,
    token_hash,
    expires_at
  )
  VALUES (
    v_invitation.company_id,
    v_invitation.provider_id,
    v_invitation.id,
    p_session_hash,
    p_session_expires_at
  );

  RETURN QUERY
  SELECT v_invitation.company_id, v_invitation.provider_id;
END;
$$;

REVOKE ALL ON FUNCTION
  public.crm_owner_redeem_invitation(text, text, timestamptz)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.crm_owner_redeem_invitation(text, text, timestamptz)
TO service_role;
