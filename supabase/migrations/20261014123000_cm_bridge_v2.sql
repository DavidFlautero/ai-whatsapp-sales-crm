BEGIN;

CREATE TABLE IF NOT EXISTS public.cm_bridge_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  candidate_key text NOT NULL CHECK (length(candidate_key)=64),
  identity_id uuid NOT NULL,
  case_id uuid,
  target_table text NOT NULL,
  target_id text NOT NULL,
  match_basis text NOT NULL,
  confidence numeric(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','accepted','rejected')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE(company_id,candidate_key),
  FOREIGN KEY(company_id,identity_id)
    REFERENCES public.crm_memory_identities(company_id,id),
  FOREIGN KEY(company_id,case_id)
    REFERENCES public.crm_memory_cases(company_id,id)
);

CREATE INDEX IF NOT EXISTS cm_bridge_identity_idx
ON public.cm_bridge_candidates(company_id,identity_id,status);

CREATE INDEX IF NOT EXISTS cm_bridge_case_idx
ON public.cm_bridge_candidates(company_id,case_id,status);

CREATE TABLE IF NOT EXISTS public.cm_operation_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  link_key text NOT NULL CHECK(length(link_key)=64),
  case_id uuid NOT NULL,
  identity_id uuid NOT NULL,
  partner_role text NOT NULL
    CHECK(partner_role IN ('owner','supplier','organizer')),
  source_message_id uuid NOT NULL,
  confidence numeric(4,3) NOT NULL CHECK(confidence BETWEEN 0 AND 1),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'proposed'
    CHECK(status IN ('proposed','accepted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE(company_id,link_key),
  FOREIGN KEY(company_id,case_id)
    REFERENCES public.crm_memory_cases(company_id,id),
  FOREIGN KEY(company_id,identity_id)
    REFERENCES public.crm_memory_identities(company_id,id)
);

CREATE INDEX IF NOT EXISTS cm_partners_case_idx
ON public.cm_operation_partners(company_id,case_id,status);

CREATE TABLE IF NOT EXISTS public.cm_identity_role_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  identity_id uuid NOT NULL,
  role text NOT NULL
    CHECK(role IN ('customer','owner','supplier','organizer')),
  source_message_id uuid NOT NULL,
  confidence numeric(4,3) NOT NULL
    CHECK(confidence BETWEEN 0 AND 1),
  extractor_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,identity_id,role,source_message_id),
  FOREIGN KEY(company_id,identity_id)
    REFERENCES public.crm_memory_identities(company_id,id)
);

CREATE TABLE IF NOT EXISTS public.cm_commercial_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  action text NOT NULL,
  actor text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.cm_bridge_catalog()
RETURNS TABLE(table_name text, columns text[])
LANGUAGE sql
SECURITY INVOKER
SET search_path=public
AS $$
  SELECT c.relname::text,
         array_agg(a.attname::text ORDER BY a.attnum)
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
  WHERE n.nspname='public'
    AND c.relkind IN ('r','p')
    AND a.attnum>0
    AND NOT a.attisdropped
    AND c.relname IN (
      'crm_lead_requests',
      'crm_contacts',
      'crm_customers',
      'crm_owners',
      'crm_suppliers',
      'crm_providers',
      'crm_venues',
      'crm_events',
      'contacts'
    )
  GROUP BY c.relname;
$$;

CREATE OR REPLACE FUNCTION public.cm_review_link(
  p_company text,
  p_kind text,
  p_id uuid,
  p_decision text,
  p_actor text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=public
AS $$
DECLARE
  affected integer;
BEGIN
  IF p_decision NOT IN ('accepted','rejected')
     OR p_kind NOT IN ('bridge','partner')
     OR length(trim(coalesce(p_actor,'')))<3 THEN
    RAISE EXCEPTION 'INVALID_REVIEW_REQUEST';
  END IF;

  IF p_kind='bridge' THEN
    UPDATE public.cm_bridge_candidates
    SET status=p_decision, reviewed_at=now()
    WHERE company_id=p_company AND id=p_id
      AND status='proposed';
  ELSE
    UPDATE public.cm_operation_partners
    SET status=p_decision, reviewed_at=now()
    WHERE company_id=p_company AND id=p_id
      AND status='proposed';
  END IF;

  GET DIAGNOSTICS affected=ROW_COUNT;

  IF affected<>1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.cm_commercial_audit(
    company_id,target_type,target_id,action,actor
  ) VALUES (
    p_company,p_kind,p_id,p_decision,p_actor
  );

  RETURN true;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cm_bridge_candidates',
    'cm_operation_partners',
    'cm_identity_role_evidence',
    'cm_commercial_audit'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t
    );
    EXECUTE format(
      'REVOKE ALL ON public.%I FROM anon,authenticated',t
    );
    EXECUTE format(
      'GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t
    );
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.cm_bridge_catalog()
FROM PUBLIC;

REVOKE ALL ON FUNCTION
public.cm_review_link(text,text,uuid,text,text)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.cm_bridge_catalog()
TO service_role;

GRANT EXECUTE ON FUNCTION
public.cm_review_link(text,text,uuid,text,text)
TO service_role;

COMMIT;
