BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_memory_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL
    CHECK (length(trim(company_id)) > 0),
  case_key text NOT NULL
    CHECK (length(case_key) = 64),

  customer_identity_id uuid NOT NULL,

  event_date date,
  event_type text,
  venue_label text,
  title text NOT NULL DEFAULT 'Solicitud de evento',

  state text NOT NULL DEFAULT 'candidate'
    CHECK (
      state IN (
        'candidate',
        'inquiry',
        'negotiation',
        'review',
        'hold',
        'confirmed',
        'completed',
        'cancelled'
      )
    ),

  crm_lead_id text,
  crm_event_id text,
  crm_venue_id text,

  state_verified boolean NOT NULL DEFAULT false,

  opened_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (company_id, case_key),
  UNIQUE (company_id, id),

  FOREIGN KEY (company_id, customer_identity_id)
    REFERENCES public.crm_memory_identities (
      company_id,
      id
    )
);

CREATE INDEX IF NOT EXISTS cm_cases_customer_idx
ON public.crm_memory_cases (
  company_id,
  customer_identity_id,
  last_activity_at DESC
);

CREATE INDEX IF NOT EXISTS cm_cases_date_idx
ON public.crm_memory_cases (
  company_id,
  event_date,
  state
);

CREATE TABLE IF NOT EXISTS public.crm_memory_case_messages (
  company_id text NOT NULL,
  case_id uuid NOT NULL,
  message_id uuid NOT NULL,

  association_status text NOT NULL DEFAULT 'proposed'
    CHECK (
      association_status IN (
        'proposed',
        'confirmed',
        'rejected'
      )
    ),

  association_reason text NOT NULL,

  confidence numeric(4,3) NOT NULL
    CHECK (confidence BETWEEN 0 AND 1),

  created_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (
    company_id,
    case_id,
    message_id
  ),

  FOREIGN KEY (company_id, case_id)
    REFERENCES public.crm_memory_cases (
      company_id,
      id
    )
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS cm_messages_by_source_idx
ON public.crm_memory_case_messages (
  company_id,
  message_id
);

CREATE TABLE IF NOT EXISTS public.crm_memory_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,

  fingerprint text NOT NULL
    CHECK (length(fingerprint) = 64),

  source_message_id uuid NOT NULL,
  identity_id uuid,
  case_id uuid,

  fact_type text NOT NULL,
  fact_value jsonb NOT NULL,

  confidence numeric(4,3) NOT NULL
    CHECK (confidence BETWEEN 0 AND 1),

  source_kind text NOT NULL DEFAULT 'whatsapp',

  status text NOT NULL DEFAULT 'proposed'
    CHECK (
      status IN (
        'proposed',
        'verified',
        'rejected',
        'superseded'
      )
    ),

  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (company_id, fingerprint),

  FOREIGN KEY (company_id, identity_id)
    REFERENCES public.crm_memory_identities (
      company_id,
      id
    ),

  FOREIGN KEY (company_id, case_id)
    REFERENCES public.crm_memory_cases (
      company_id,
      id
    )
);

CREATE INDEX IF NOT EXISTS cm_facts_case_idx
ON public.crm_memory_facts (
  company_id,
  case_id,
  observed_at
);

CREATE INDEX IF NOT EXISTS cm_facts_identity_idx
ON public.crm_memory_facts (
  company_id,
  identity_id,
  observed_at DESC
);

CREATE TABLE IF NOT EXISTS public.crm_memory_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,

  fingerprint text NOT NULL
    CHECK (length(fingerprint) = 64),

  case_id uuid,
  identity_id uuid,
  source_message_id uuid,

  review_type text NOT NULL,

  priority text NOT NULL DEFAULT 'normal'
    CHECK (
      priority IN (
        'low',
        'normal',
        'high',
        'critical'
      )
    ),

  status text NOT NULL DEFAULT 'open'
    CHECK (
      status IN (
        'open',
        'accepted',
        'rejected',
        'resolved'
      )
    ),

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,

  UNIQUE (company_id, fingerprint),

  FOREIGN KEY (company_id, case_id)
    REFERENCES public.crm_memory_cases (
      company_id,
      id
    ),

  FOREIGN KEY (company_id, identity_id)
    REFERENCES public.crm_memory_identities (
      company_id,
      id
    )
);

CREATE INDEX IF NOT EXISTS cm_reviews_queue_idx
ON public.crm_memory_reviews (
  company_id,
  status,
  priority,
  created_at
);

CREATE TABLE IF NOT EXISTS public.crm_memory_receipts (
  company_id text NOT NULL,
  message_id uuid NOT NULL,

  processor_version text NOT NULL,

  processed_at timestamptz NOT NULL DEFAULT now(),

  result text NOT NULL CHECK (
    result IN (
      'observed',
      'case_proposed',
      'review_required',
      'skipped'
    )
  ),

  PRIMARY KEY (
    company_id,
    message_id
  )
);

CREATE INDEX IF NOT EXISTS cm_receipts_processed_idx
ON public.crm_memory_receipts (
  company_id,
  processed_at DESC
);

CREATE TABLE IF NOT EXISTS public.crm_memory_cursors (
  company_id text PRIMARY KEY,
  last_created_at timestamptz NOT NULL,
  last_message_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_memory_worker_leases (
  company_id text PRIMARY KEY,
  owner_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.cm_memory_try_lease(
  p_company text,
  p_owner uuid,
  p_seconds integer DEFAULT 180
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  granted boolean := false;
BEGIN
  IF (
    p_company IS NULL OR
    length(p_company) < 2 OR
    p_owner IS NULL OR
    p_seconds NOT BETWEEN 30 AND 600
  ) THEN
    RAISE EXCEPTION 'INVALID_LEASE_PARAMETERS';
  END IF;

  INSERT INTO public.crm_memory_worker_leases (
    company_id,
    owner_id,
    expires_at
  )
  VALUES (
    p_company,
    p_owner,
    now() + make_interval(secs => p_seconds)
  )

  ON CONFLICT (company_id)
  DO UPDATE SET
    owner_id = EXCLUDED.owner_id,
    expires_at = EXCLUDED.expires_at,
    updated_at = now()

  WHERE
    crm_memory_worker_leases.expires_at < now()
    OR
    crm_memory_worker_leases.owner_id = p_owner

  RETURNING true INTO granted;

  RETURN coalesce(granted, false);
END;
$$;

REVOKE ALL ON FUNCTION
  public.cm_memory_try_lease(text, uuid, integer)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  public.cm_memory_try_lease(text, uuid, integer)
TO service_role;

ALTER TABLE public.crm_memory_cases
ADD CONSTRAINT cm_confirmed_requires_verification
CHECK (
  state NOT IN ('confirmed', 'completed')
  OR state_verified = true
);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'crm_memory_cases',
    'crm_memory_case_messages',
    'crm_memory_facts',
    'crm_memory_reviews',
    'crm_memory_receipts',
    'crm_memory_cursors',
    'crm_memory_worker_leases'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      t
    );

    EXECUTE format(
      'REVOKE ALL ON public.%I FROM anon,authenticated',
      t
    );

    EXECUTE format(
      'GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',
      t
    );
  END LOOP;
END;
$$;

COMMIT;
