
-- Recuperación de crm_lead_requests.
-- Estructura obtenida del Supabase original.
-- No importa ni elimina datos existentes.

DO $$
BEGIN

  IF to_regclass('public.crm_lead_requests') IS NOT NULL THEN
    RAISE EXCEPTION 'crm_lead_requests ya existe';
  END IF;

  IF to_regclass('public.commerce_companies') IS NULL THEN
    RAISE EXCEPTION 'Falta commerce_companies';
  END IF;

  IF to_regclass('public.crm_team_members') IS NULL THEN
    RAISE EXCEPTION 'Falta crm_team_members';
  END IF;

  IF to_regclass('public.commerce_customers') IS NULL THEN
    RAISE EXCEPTION 'Falta commerce_customers';
  END IF;

  IF to_regclass('public.crm_events') IS NULL THEN
    RAISE EXCEPTION 'Falta crm_events';
  END IF;

  IF to_regprocedure('public.crm_touch_updated_at()') IS NULL THEN
    RAISE EXCEPTION 'Falta crm_touch_updated_at()';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.commerce_schema_migrations
    WHERE version = '20261011190000'
  ) THEN
    RAISE EXCEPTION 'Migración ya registrada';
  END IF;

END;
$$;

CREATE TABLE public.crm_lead_requests (

  id uuid NOT NULL DEFAULT gen_random_uuid(),

  company_id text NOT NULL,

  public_token text NOT NULL
    DEFAULT encode(gen_random_bytes(12), 'hex'),

  status text NOT NULL DEFAULT 'new',

  source text NOT NULL DEFAULT 'web',

  customer_name text,

  whatsapp text,

  email text,

  event_type text,

  service_mode text,

  event_date date,

  date_flexible boolean NOT NULL DEFAULT false,

  alternative_date date,

  autonomous_community text,

  province text,

  municipality text,

  postal_code text,

  guest_count integer,

  budget_initial numeric(14,2),

  budget_max numeric(14,2),

  requested_services text[] NOT NULL DEFAULT '{}',

  preferences jsonb NOT NULL DEFAULT '{}',

  customer_message text,

  internal_notes text,

  assigned_team_member_id uuid,

  converted_customer_id uuid,

  converted_event_id uuid,

  metadata jsonb NOT NULL DEFAULT '{}',

  created_at timestamptz NOT NULL DEFAULT now(),

  updated_at timestamptz NOT NULL DEFAULT now(),

  preferred_municipality_id text,

  location_flexibility text,

  search_radius_km integer,

  alternative_locations jsonb NOT NULL DEFAULT '[]',

  has_venue boolean,

  existing_venue_name text,

  existing_venue_address text,

  budget_scope text,

  event_start_time time,

  event_end_time time,

  CONSTRAINT crm_lead_requests_pkey
    PRIMARY KEY (id),

  CONSTRAINT crm_lead_requests_public_token_key
    UNIQUE (public_token),

  CONSTRAINT crm_lead_requests_company_id_fkey
    FOREIGN KEY (company_id)
    REFERENCES public.commerce_companies(id)
    ON DELETE CASCADE,

  CONSTRAINT crm_lead_requests_assigned_team_member_id_fkey
    FOREIGN KEY (assigned_team_member_id)
    REFERENCES public.crm_team_members(id)
    ON DELETE SET NULL,

  CONSTRAINT crm_lead_requests_converted_customer_id_fkey
    FOREIGN KEY (converted_customer_id)
    REFERENCES public.commerce_customers(id)
    ON DELETE SET NULL,

  CONSTRAINT crm_lead_requests_converted_event_id_fkey
    FOREIGN KEY (converted_event_id)
    REFERENCES public.crm_events(id)
    ON DELETE SET NULL,

  CONSTRAINT crm_lead_requests_status_check
    CHECK (
      status IN (
        'new',
        'contacted',
        'qualified',
        'proposal',
        'converted',
        'lost'
      )
    ),

  CONSTRAINT crm_lead_requests_guest_count_check
    CHECK (guest_count IS NULL OR guest_count >= 0),

  CONSTRAINT crm_lead_requests_budget_initial_check
    CHECK (budget_initial IS NULL OR budget_initial >= 0),

  CONSTRAINT crm_lead_requests_budget_max_check
    CHECK (budget_max IS NULL OR budget_max >= 0),

  CONSTRAINT crm_lead_requests_budget_scope_check
    CHECK (
      budget_scope IS NULL
      OR budget_scope IN (
        'full_event',
        'selected_services',
        'unknown'
      )
    ),

  CONSTRAINT crm_lead_requests_location_flexibility_check
    CHECK (
      location_flexibility IS NULL
      OR location_flexibility IN (
        'exact',
        'nearby',
        'province',
        'advice'
      )
    ),

  CONSTRAINT crm_lead_requests_search_radius_km_check
    CHECK (
      search_radius_km IS NULL
      OR search_radius_km IN (10,25,50,100)
    )

);

CREATE INDEX crm_lead_requests_company_status_idx
ON public.crm_lead_requests (
  company_id,
  status,
  created_at DESC
);

CREATE INDEX crm_lead_requests_company_date_idx
ON public.crm_lead_requests (
  company_id,
  event_date
);

CREATE TRIGGER trg_crm_lead_requests_updated_at
BEFORE UPDATE ON public.crm_lead_requests
FOR EACH ROW
EXECUTE FUNCTION public.crm_touch_updated_at();

ALTER TABLE public.crm_lead_requests
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.crm_lead_requests
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.crm_lead_requests
TO service_role;

INSERT INTO public.commerce_schema_migrations (
  version,
  description
)
VALUES (
  '20261011190000',
  'crm_lead_requests recuperada del esquema original'
);

NOTIFY pgrst, 'reload schema';
