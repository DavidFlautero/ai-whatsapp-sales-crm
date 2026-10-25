BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.crm_memory_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL
    CHECK (length(trim(company_id)) > 0),
  primary_phone text NOT NULL
    CHECK (primary_phone ~ '^[0-9]{8,15}$'),
  display_name text,
  identity_status text NOT NULL
    DEFAULT 'provisional'
    CHECK (
      identity_status IN (
        'provisional',
        'verified',
        'merged',
        'blocked'
      )
    ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (company_id, primary_phone),
  UNIQUE (company_id, id)
);

CREATE INDEX IF NOT EXISTS cm_identities_company_idx
ON public.crm_memory_identities (
  company_id,
  updated_at DESC
);

CREATE TABLE IF NOT EXISTS public.crm_memory_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  identity_id uuid NOT NULL,

  role text NOT NULL CHECK (
    role IN (
      'customer',
      'owner',
      'supplier',
      'organizer'
    )
  ),

  confidence numeric(4,3) NOT NULL
    CHECK (confidence BETWEEN 0 AND 1),

  status text NOT NULL DEFAULT 'proposed'
    CHECK (
      status IN (
        'proposed',
        'confirmed',
        'rejected'
      )
    ),

  evidence_message_id uuid,

  evidence_direction text CHECK (
    evidence_direction IS NULL OR
    evidence_direction IN (
      'inbound',
      'outbound'
    )
  ),

  explanation text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (
    company_id,
    identity_id,
    role
  ),

  FOREIGN KEY (company_id, identity_id)
    REFERENCES public.crm_memory_identities (
      company_id,
      id
    )
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS cm_roles_company_status_idx
ON public.crm_memory_roles (
  company_id,
  status,
  role
);

CREATE TABLE IF NOT EXISTS public.crm_memory_entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  identity_id uuid NOT NULL,

  target_type text NOT NULL CHECK (
    target_type IN (
      'crm_contact',
      'crm_customer',
      'crm_owner',
      'crm_supplier',
      'venue'
    )
  ),

  target_id text NOT NULL
    CHECK (length(target_id) > 0),

  status text NOT NULL DEFAULT 'proposed'
    CHECK (
      status IN (
        'proposed',
        'confirmed',
        'rejected'
      )
    ),

  confidence numeric(4,3) NOT NULL
    CHECK (confidence BETWEEN 0 AND 1),

  evidence_message_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (
    company_id,
    identity_id,
    target_type,
    target_id
  ),

  FOREIGN KEY (company_id, identity_id)
    REFERENCES public.crm_memory_identities (
      company_id,
      id
    )
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS cm_links_target_idx
ON public.crm_memory_entity_links (
  company_id,
  target_type,
  target_id
);

ALTER TABLE public.crm_memory_identities
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_memory_roles
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_memory_entity_links
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.crm_memory_identities,
  public.crm_memory_roles,
  public.crm_memory_entity_links
FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.crm_memory_identities,
  public.crm_memory_roles,
  public.crm_memory_entity_links
TO service_role;

COMMIT;
