CREATE TABLE public.crm_venues (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  provider_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  description text,
  province text,
  city text,
  address text,
  public_location text,
  capacity_min integer,
  capacity_max integer,
  cost_from numeric(14,2) NOT NULL DEFAULT 0,
  client_price_from numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  included_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  suitable_for jsonb NOT NULL DEFAULT '[]'::jsonb,
  public_notes text,
  internal_notes text,
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  rental_modes text[] NOT NULL DEFAULT '{}'::text[],
  event_types_allowed text[] NOT NULL DEFAULT '{}'::text[],
  events_allowed boolean NOT NULL DEFAULT true,
  parties_allowed boolean NOT NULL DEFAULT true,
  max_event_guests integer,
  max_sleeping_guests integer,
  default_start_time time,
  default_end_time time,
  music_end_time time,
  latitude numeric(9,6),
  longitude numeric(9,6),
  deposit numeric(14,2) NOT NULL DEFAULT 0,
  cleaning_fee numeric(14,2) NOT NULL DEFAULT 0,
  venue_rules jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT crm_venues_pkey PRIMARY KEY (id),
  CONSTRAINT crm_venues_company_slug_unique UNIQUE (company_id, slug),
  CONSTRAINT crm_venues_company_id_fkey
    FOREIGN KEY (company_id)
    REFERENCES public.commerce_companies(id) ON DELETE CASCADE,
  CONSTRAINT crm_venues_provider_id_fkey
    FOREIGN KEY (provider_id)
    REFERENCES public.crm_providers(id) ON DELETE CASCADE,
  CONSTRAINT crm_venues_status_check
    CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT crm_venues_capacity_min_check
    CHECK (capacity_min IS NULL OR capacity_min >= 0),
  CONSTRAINT crm_venues_capacity_max_check
    CHECK (capacity_max IS NULL OR capacity_max >= 0),
  CONSTRAINT crm_venues_capacity_check
    CHECK (capacity_min IS NULL OR capacity_max IS NULL
           OR capacity_max >= capacity_min),
  CONSTRAINT crm_venues_cost_from_check CHECK (cost_from >= 0),
  CONSTRAINT crm_venues_client_price_from_check CHECK (client_price_from >= 0)
);

CREATE INDEX crm_venues_company_provider_idx
  ON public.crm_venues (company_id, provider_id);

CREATE INDEX crm_venues_public_idx
  ON public.crm_venues (company_id, status, city);

CREATE INDEX crm_venues_matching_idx
  ON public.crm_venues
  (company_id, status, events_allowed, parties_allowed, max_event_guests);

CREATE TRIGGER crm_venues_touch
BEFORE UPDATE ON public.crm_venues
FOR EACH ROW EXECUTE FUNCTION public.crm_touch_updated_at();

ALTER TABLE public.crm_venues ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.crm_venues FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.crm_venues TO service_role;

INSERT INTO public.commerce_schema_migrations (version, description)
VALUES (
  '20260922060000',
  'crm_venues recuperada del esquema original; trigger y permisos adaptados'
);

NOTIFY pgrst, 'reload schema';
