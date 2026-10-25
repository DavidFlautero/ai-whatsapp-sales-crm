BEGIN;

CREATE TABLE IF NOT EXISTS public.cm_intel_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  message_id uuid NOT NULL,
  processor_version text NOT NULL,
  model_name text NOT NULL,
  identity_id uuid,
  observation jsonb NOT NULL,
  evidence_quote text,
  confidence numeric(4,3) NOT NULL
    CHECK(confidence BETWEEN 0 AND 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,message_id,processor_version),
  FOREIGN KEY(company_id,identity_id)
    REFERENCES public.crm_memory_identities(company_id,id)
);

CREATE INDEX IF NOT EXISTS cm_intel_identity_idx
ON public.cm_intel_observations(
  company_id,identity_id,created_at DESC
);

CREATE TABLE IF NOT EXISTS public.cm_intel_receipts (
  company_id text NOT NULL,
  message_id uuid NOT NULL,
  processor_version text NOT NULL,
  result text NOT NULL
    CHECK(result IN ('analyzed','skipped','unsupported')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(company_id,message_id,processor_version)
);

CREATE TABLE IF NOT EXISTS public.cm_intel_cursors (
  company_id text NOT NULL,
  processor_version text NOT NULL,
  last_created_at timestamptz NOT NULL,
  last_message_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(company_id,processor_version)
);

CREATE TABLE IF NOT EXISTS public.cm_intel_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  task_key text NOT NULL CHECK(length(task_key)=64),
  case_id uuid,
  identity_id uuid,
  source_message_id uuid NOT NULL,
  task_type text NOT NULL CHECK(
    task_type IN (
      'follow_up',
      'check_availability',
      'review_price',
      'review_agreement',
      'verify_payment',
      'review_relationship'
    )
  ),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'proposed'
    CHECK(status IN ('proposed','accepted','done','dismissed')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK(priority IN ('normal','high','critical')),
  due_at timestamptz,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,task_key),
  FOREIGN KEY(company_id,case_id)
    REFERENCES public.crm_memory_cases(company_id,id),
  FOREIGN KEY(company_id,identity_id)
    REFERENCES public.crm_memory_identities(company_id,id)
);

CREATE INDEX IF NOT EXISTS cm_intel_tasks_queue_idx
ON public.cm_intel_tasks(
  company_id,status,priority,created_at DESC
);

CREATE TABLE IF NOT EXISTS public.cm_intel_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  memory_key text NOT NULL CHECK(length(memory_key)=64),
  identity_id uuid NOT NULL,
  case_id uuid,
  source_message_id uuid NOT NULL,
  memory_type text NOT NULL,
  memory_value jsonb NOT NULL,
  confidence numeric(4,3) NOT NULL
    CHECK(confidence BETWEEN 0 AND 1),
  verification_status text NOT NULL DEFAULT 'proposed'
    CHECK(
      verification_status IN (
        'proposed','verified','rejected','superseded'
      )
    ),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,memory_key),
  FOREIGN KEY(company_id,identity_id)
    REFERENCES public.crm_memory_identities(company_id,id),
  FOREIGN KEY(company_id,case_id)
    REFERENCES public.crm_memory_cases(company_id,id)
);

CREATE INDEX IF NOT EXISTS cm_memories_identity_idx
ON public.cm_intel_memories(
  company_id,identity_id,memory_type
);

CREATE TABLE IF NOT EXISTS public.cm_intel_failures (
  company_id text NOT NULL,
  message_id uuid NOT NULL,
  processor_version text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  last_error_code text NOT NULL,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(company_id,message_id,processor_version)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cm_intel_observations',
    'cm_intel_receipts',
    'cm_intel_cursors',
    'cm_intel_tasks',
    'cm_intel_memories',
    'cm_intel_failures'
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


CREATE OR REPLACE FUNCTION public.cm_review_intel_memory(
  p_company text,
  p_memory_id uuid,
  p_decision text,
  p_actor text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=public
AS $$
DECLARE affected integer;
BEGIN
  IF p_decision NOT IN ('verified','rejected')
     OR length(trim(coalesce(p_actor,'')))<3 THEN
    RAISE EXCEPTION 'INVALID_MEMORY_REVIEW';
  END IF;

  UPDATE public.cm_intel_memories
  SET verification_status=p_decision
  WHERE company_id=p_company
    AND id=p_memory_id
    AND verification_status='proposed';

  GET DIAGNOSTICS affected=ROW_COUNT;

  IF affected<>1 THEN RETURN false; END IF;

  INSERT INTO public.cm_commercial_audit(
    company_id,target_type,target_id,action,actor
  ) VALUES (
    p_company,'memory',p_memory_id,p_decision,p_actor
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION
public.cm_review_intel_memory(text,uuid,text,text)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
public.cm_review_intel_memory(text,uuid,text,text)
TO service_role;


COMMIT;
