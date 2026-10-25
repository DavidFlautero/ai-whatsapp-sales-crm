-- Eventos Mediterráneo
-- Captación comercial inteligente
--
-- Tablas auxiliares.
-- No modifica las solicitudes existentes.

CREATE TABLE IF NOT EXISTS public.crm_intake_threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id text NOT NULL,

    whatsapp text NOT NULL,

    crm_lead_request_id uuid,

    event_key text,

    workflow_status text NOT NULL DEFAULT 'open'
      CHECK (
        workflow_status IN (
          'open',
          'review',
          'closed'
        )
      ),

    state jsonb NOT NULL DEFAULT '{}'::jsonb
      CHECK (jsonb_typeof(state) = 'object'),

    next_action text NOT NULL DEFAULT 'review',

    version integer NOT NULL DEFAULT 0
      CHECK (version >= 0),

    last_source_message_id text,

    started_at timestamptz NOT NULL DEFAULT now(),

    last_message_at timestamptz NOT NULL DEFAULT now(),

    updated_at timestamptz NOT NULL DEFAULT now(),

    closed_at timestamptz,

    CONSTRAINT crm_intake_threads_company_id_unique
      UNIQUE (company_id, id)
);

CREATE INDEX IF NOT EXISTS
  idx_crm_intake_threads_contact
ON public.crm_intake_threads (
    company_id,
    whatsapp,
    workflow_status,
    last_message_at DESC
);

CREATE TABLE IF NOT EXISTS
  public.crm_intake_message_receipts (

    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id text NOT NULL,

    thread_id uuid NOT NULL,

    provider text NOT NULL DEFAULT 'whapi',

    external_message_id text NOT NULL,

    fact_delta jsonb NOT NULL DEFAULT '{}'::jsonb
      CHECK (jsonb_typeof(fact_delta) = 'object'),

    processed_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT crm_intake_receipt_unique
      UNIQUE (
        company_id,
        provider,
        external_message_id
      ),

    CONSTRAINT crm_intake_receipt_thread_fk
      FOREIGN KEY (
        company_id,
        thread_id
      )
      REFERENCES public.crm_intake_threads (
        company_id,
        id
      )
      ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS
  idx_crm_intake_receipts_thread
ON public.crm_intake_message_receipts (
    company_id,
    thread_id,
    processed_at DESC
);

CREATE TABLE IF NOT EXISTS
  public.crm_intake_settings (

    company_id text PRIMARY KEY,

    enabled boolean NOT NULL DEFAULT false,

    response_mode text NOT NULL DEFAULT 'observe'
      CHECK (
        response_mode IN (
          'observe',
          'assist',
          'auto'
        )
      ),

    automatic_replies boolean NOT NULL DEFAULT false,

    pause_on_human_operator boolean NOT NULL DEFAULT true,

    confidence_threshold numeric(4,3)
      NOT NULL DEFAULT 0.900
      CHECK (
        confidence_threshold >= 0
        AND confidence_threshold <= 1
      ),

    max_questions_per_reply integer
      NOT NULL DEFAULT 1
      CHECK (
        max_questions_per_reply BETWEEN 0 AND 2
      ),

    generate_form_link boolean NOT NULL DEFAULT true,

    timezone text NOT NULL DEFAULT 'Europe/Madrid',

    updated_at timestamptz NOT NULL DEFAULT now(),

    updated_by text
);

-- Acceso exclusivamente mediante backend autorizado.

ALTER TABLE public.crm_intake_threads
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_intake_message_receipts
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crm_intake_settings
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.crm_intake_threads
  FROM anon, authenticated;

REVOKE ALL ON public.crm_intake_message_receipts
  FROM anon, authenticated;

REVOKE ALL ON public.crm_intake_settings
  FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.crm_intake_threads
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.crm_intake_message_receipts
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.crm_intake_settings
  TO service_role;
