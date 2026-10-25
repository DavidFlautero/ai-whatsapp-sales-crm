-- Eventos Mediterráneo
-- Captación comercial transaccional.
--
-- DEPENDENCIA:
-- 20261011230000_crm_intake_capture_core.sql
--
-- Las operaciones se ejecutan dentro
-- de una única transacción PostgreSQL.
--
-- La función no envía WhatsApp.
-- No confirma reservas.
-- No consulta propietarios.
--
-- Seguridad:
-- Solo service_role puede ejecutarla.

CREATE OR REPLACE FUNCTION
public.crm_intake_capture_message(
  p_company_id text,
  p_whatsapp text,
  p_message_id text,
  p_draft jsonb,
  p_message_body text,
  p_customer_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_enabled boolean;

  v_thread public.crm_intake_threads%ROWTYPE;

  v_thread_count integer;
  v_thread_id uuid;
  v_lead_id uuid;

  v_previous jsonb;

  v_state jsonb := '{
    "version": 0,
    "processedMessageIds": [],
    "eventType": null,
    "venueType": null,
    "location": null,
    "attendees": null,
    "sleepers": null,
    "budgetMaxEur": null,
    "dateOptions": [],
    "dateRange": null,
    "amenities": []
  }'::jsonb;

  v_key text;
  v_fact jsonb;
  v_amenity jsonb;

  v_date jsonb;
  v_date_alt jsonb;

  v_event_date date;
  v_alternative_date date;

  v_prev_date jsonb;
  v_prev_alt jsonb;
  v_prev_event_date date;
  v_prev_alternative_date date;
  v_dates_changed boolean := false;

  v_services text[];
  v_prev_services text[];

  v_action text;
  v_created boolean := false;

BEGIN

  -- Validación de entrada.

  IF (
    p_company_id IS NULL
    OR length(trim(p_company_id)) = 0
    OR length(p_company_id) > 160
    OR p_whatsapp IS NULL
    OR p_whatsapp !~ '^[+]?[0-9]{6,20}$'
    OR p_message_id IS NULL
    OR length(trim(p_message_id)) = 0
    OR length(p_message_id) > 255
    OR p_draft IS NULL
    OR jsonb_typeof(p_draft) <> 'object'
  ) THEN
    RAISE EXCEPTION
      'INVALID_INTAKE_INPUT';
  END IF;

  -- Serializar operaciones del mismo
  -- contacto dentro de cada empresa.

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_company_id || ':' || p_whatsapp,
      0
    )
  );

  -- Las empresas empiezan con la
  -- captación desactivada.

  INSERT INTO public.crm_intake_settings (
    company_id
  )
  VALUES (
    p_company_id
  )
  ON CONFLICT (company_id)
  DO NOTHING;

  SELECT enabled
  INTO v_enabled
  FROM public.crm_intake_settings
  WHERE company_id = p_company_id;

  IF NOT coalesce(v_enabled, false) THEN
    RETURN jsonb_build_object(
      'status', 'disabled'
    );
  END IF;

  -- Idempotencia persistente.

  IF EXISTS (
    SELECT 1
    FROM public.crm_intake_message_receipts
    WHERE company_id = p_company_id
      AND provider = 'whapi'
      AND external_message_id = p_message_id
  ) THEN
    RETURN jsonb_build_object(
      'status', 'duplicate'
    );
  END IF;

  -- Comprobar solicitudes activas
  -- de este contacto.

  SELECT count(*)
  INTO v_thread_count
  FROM public.crm_intake_threads
  WHERE company_id = p_company_id
    AND whatsapp = p_whatsapp
    AND workflow_status IN ('open', 'review');

  IF v_thread_count > 1 THEN
    RETURN jsonb_build_object(
      'status', 'needs_review',
      'reason', 'multiple_active_requests'
    );
  END IF;

  IF v_thread_count = 1 THEN

    SELECT *
    INTO v_thread
    FROM public.crm_intake_threads
    WHERE company_id = p_company_id
      AND whatsapp = p_whatsapp
      AND workflow_status IN ('open', 'review')
    ORDER BY last_message_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_thread.workflow_status = 'review' THEN
      RETURN jsonb_build_object(
        'status', 'needs_review',
        'reason', 'thread_under_review'
      );
    END IF;

    v_thread_id := v_thread.id;
    v_lead_id := v_thread.crm_lead_request_id;

    IF v_lead_id IS NULL THEN
      RAISE EXCEPTION
        'INTAKE_THREAD_WITHOUT_LEAD';
    END IF;

    v_previous := v_thread.state;

    IF (
      jsonb_typeof(v_previous) = 'object'
      AND v_previous ? 'version'
    ) THEN
      v_state := v_previous;
    END IF;

    -- Si parece otra solicitud independiente,
    -- no mezclar automáticamente los eventos.

    IF (
      p_draft->>'eventIntent' = 'true'
      AND (
        (
          v_state #>> '{location,value}'
            IS NOT NULL
          AND p_draft #>> '{location,value}'
            IS NOT NULL
          AND lower(
            v_state #>> '{location,value}'
          ) <> lower(
            p_draft #>> '{location,value}'
          )
        )
        OR
        (
          v_state #>> '{dateOptions,0,value,day}'
            IS NOT NULL
          AND p_draft #>> '{dateOptions,0,value,day}'
            IS NOT NULL
          AND (
            v_state #>> '{dateOptions,0,value,day}'
              <>
            p_draft #>> '{dateOptions,0,value,day}'
            OR
            v_state #>> '{dateOptions,0,value,month}'
              IS DISTINCT FROM
            p_draft #>> '{dateOptions,0,value,month}'
          )
        )
      )
    ) THEN

      UPDATE public.crm_intake_threads
      SET
        workflow_status = 'review',
        next_action = 'clarify_event',
        updated_at = now()
      WHERE id = v_thread_id
        AND company_id = p_company_id;

      RETURN jsonb_build_object(
        'status', 'needs_review',
        'reason', 'possible_different_event',
        'threadId', v_thread_id
      );

    END IF;

  ELSE

    -- Un saludo no genera solicitudes.

    IF coalesce(
      (p_draft->>'eventIntent')::boolean,
      false
    ) = false THEN

      RETURN jsonb_build_object(
        'status', 'ignored',
        'reason', 'no_event_intent'
      );

    END IF;

    -- Crear solicitud comercial.
    -- No es una reserva confirmada.

    INSERT INTO public.crm_lead_requests (
      company_id,
      status,
      source,
      whatsapp,
      customer_name,
      date_flexible,
      requested_services,
      preferences,
      customer_message,
      metadata
    )
    VALUES (
      p_company_id,
      'new',
      'whatsapp',
      p_whatsapp,
      nullif(trim(p_customer_name), ''),
      false,
      ARRAY[]::text[],
      '{}'::jsonb,
      left(coalesce(p_message_body, ''), 8000),
      jsonb_build_object(
        'intake_origin', 'whapi',
        'intake_automated', true,
        'name_confirmed', false
      )
    )
    RETURNING id INTO v_lead_id;

    INSERT INTO public.crm_intake_threads (
      company_id,
      whatsapp,
      crm_lead_request_id,
      state,
      workflow_status
    )
    VALUES (
      p_company_id,
      p_whatsapp,
      v_lead_id,
      v_state,
      'open'
    )
    RETURNING id INTO v_thread_id;

    v_created := true;

  END IF;

  -- Consolidar hechos explícitos.
  -- No eliminar valores anteriores
  -- cuando el mensaje no los mencione.

  FOREACH v_key IN ARRAY ARRAY[
    'eventType',
    'venueType',
    'location',
    'attendees',
    'sleepers',
    'budgetMaxEur'
  ] LOOP

    v_fact := p_draft -> v_key;

    IF (
      jsonb_typeof(v_fact) = 'object'
      AND v_fact ? 'value'
      AND v_fact->>'value' IS NOT NULL
    ) THEN

      IF (
        v_state -> v_key -> 'value'
        IS DISTINCT FROM
        v_fact -> 'value'
      ) THEN

        v_state := jsonb_set(
          v_state,
          ARRAY[v_key],
          v_fact || jsonb_build_object(
            'messageId',
            p_message_id
          ),
          true
        );

      END IF;

    END IF;

  END LOOP;

  -- Fechas alternativas.

  IF jsonb_typeof(
    p_draft->'dateOptions'
  ) = 'array' THEN

    IF jsonb_array_length(
      p_draft->'dateOptions'
    ) > 0 THEN

      v_state := jsonb_set(
        v_state,
        '{dateOptions}',
        (
          SELECT jsonb_agg(
            item.value || jsonb_build_object(
              'messageId',
              p_message_id
            )
          )
          FROM jsonb_array_elements(
            p_draft->'dateOptions'
          ) AS item(value)
        ),
        true
      );

      v_state := jsonb_set(
        v_state,
        '{dateRange}',
        'null'::jsonb,
        true
      );

    END IF;

  END IF;

  -- Periodos de alojamiento.

  IF jsonb_typeof(
    p_draft->'dateRange'
  ) = 'object' THEN

    v_state := jsonb_set(
      v_state,
      '{dateRange}',
      p_draft->'dateRange'
      || jsonb_build_object(
        'messageId',
        p_message_id
      ),
      true
    );

    v_state := jsonb_set(
      v_state,
      '{dateOptions}',
      '[]'::jsonb,
      true
    );

  END IF;

  -- Servicios solicitados.

  IF jsonb_typeof(
    p_draft->'amenities'
  ) = 'array' THEN

    FOR v_amenity IN
      SELECT value
      FROM jsonb_array_elements(
        p_draft->'amenities'
      )
    LOOP

      IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          v_state->'amenities'
        ) AS existing(value)
        WHERE existing.value->>'value'
          = v_amenity->>'value'
      ) THEN

        v_state := jsonb_set(
          v_state,
          '{amenities}',
          v_state->'amenities'
          || jsonb_build_array(
            v_amenity
            || jsonb_build_object(
              'messageId',
              p_message_id
            )
          ),
          true
        );

      END IF;

    END LOOP;

  END IF;

  -- Versión y trazabilidad.
  -- La tabla de receipts garantiza
  -- idempotencia independientemente
  -- de esta lista informativa.

  v_state := jsonb_set(
    v_state,
    '{version}',
    to_jsonb(
      coalesce(
        (v_state->>'version')::integer,
        0
      ) + 1
    ),
    true
  );

  v_state := jsonb_set(
    v_state,
    '{processedMessageIds}',
    coalesce(
      v_state->'processedMessageIds',
      '[]'::jsonb
    ) || to_jsonb(p_message_id),
    true
  );

  -- Extraer fechas sin inventar el año.

  v_date := v_state
    #> '{dateOptions,0,value}';

  v_date_alt := v_state
    #> '{dateOptions,1,value}';

  IF v_date IS NULL THEN
    v_date := v_state
      #> '{dateRange,value,start}';
  END IF;

  IF (
    v_date IS NOT NULL
    AND v_date->>'year' IS NOT NULL
  ) THEN

    v_event_date := make_date(
      (v_date->>'year')::integer,
      (v_date->>'month')::integer,
      (v_date->>'day')::integer
    );

  END IF;

  IF (
    v_date_alt IS NOT NULL
    AND v_date_alt->>'year' IS NOT NULL
  ) THEN

    v_alternative_date := make_date(
      (v_date_alt->>'year')::integer,
      (v_date_alt->>'month')::integer,
      (v_date_alt->>'day')::integer
    );

  END IF;

  -- Valores anteriores para distinguir
  -- correcciones del cliente y ediciones humanas.

  v_prev_date := v_previous
    #> '{dateOptions,0,value}';

  IF v_prev_date IS NULL THEN
    v_prev_date := v_previous
      #> '{dateRange,value,start}';
  END IF;

  v_prev_alt := v_previous
    #> '{dateOptions,1,value}';

  IF (
    v_prev_date IS NOT NULL
    AND v_prev_date->>'year' IS NOT NULL
  ) THEN
    v_prev_event_date := make_date(
      (v_prev_date->>'year')::integer,
      (v_prev_date->>'month')::integer,
      (v_prev_date->>'day')::integer
    );
  END IF;

  IF (
    v_prev_alt IS NOT NULL
    AND v_prev_alt->>'year' IS NOT NULL
  ) THEN
    v_prev_alternative_date := make_date(
      (v_prev_alt->>'year')::integer,
      (v_prev_alt->>'month')::integer,
      (v_prev_alt->>'day')::integer
    );
  END IF;

  v_dates_changed := (
    v_previous IS NULL
    OR coalesce(
      v_previous->'dateOptions',
      '[]'::jsonb
    ) IS DISTINCT FROM coalesce(
      v_state->'dateOptions',
      '[]'::jsonb
    )
    OR coalesce(
      v_previous->'dateRange',
      'null'::jsonb
    ) IS DISTINCT FROM coalesce(
      v_state->'dateRange',
      'null'::jsonb
    )
  );

  SELECT coalesce(
    array_agg(DISTINCT amenity.value->>'value'),
    ARRAY[]::text[]
  )
  INTO v_services
  FROM jsonb_array_elements(
    v_state->'amenities'
  ) AS amenity(value);

  SELECT coalesce(
    array_agg(DISTINCT amenity.value->>'value'),
    ARRAY[]::text[]
  )
  INTO v_prev_services
  FROM jsonb_array_elements(
    coalesce(
      v_previous->'amenities',
      '[]'::jsonb
    )
  ) AS amenity(value);

    -- Actualizar CRM.
  -- Se conservan los valores que ya
  -- hayan sido establecidos manualmente.
  --
  -- Los cambios que contradicen información
  -- manual se revisarán posteriormente.

  UPDATE public.crm_lead_requests AS lead
  SET
    customer_name = coalesce(
      lead.customer_name,
      nullif(trim(p_customer_name), '')
    ),

    event_type = CASE
      WHEN lead.event_type IS NULL
        OR (
          (v_previous #>> '{eventType,value}') IS NOT NULL
          AND lead.event_type =
            (v_previous #>> '{eventType,value}')
        )
      THEN coalesce(
        v_state #>> '{eventType,value}',
        lead.event_type
      )
      ELSE lead.event_type
    END,

    municipality = CASE
      WHEN lead.municipality IS NULL
        OR (
          (v_previous #>> '{location,value}') IS NOT NULL
          AND lead.municipality =
            (v_previous #>> '{location,value}')
        )
      THEN coalesce(
        v_state #>> '{location,value}',
        lead.municipality
      )
      ELSE lead.municipality
    END,

    guest_count = CASE
      WHEN lead.guest_count IS NULL
        OR (
          (v_previous #>> '{attendees,value}') IS NOT NULL
          AND lead.guest_count =
            (v_previous #>> '{attendees,value}')::integer
        )
      THEN coalesce(
        (v_state #>> '{attendees,value}')::integer,
        lead.guest_count
      )
      ELSE lead.guest_count
    END,

    budget_max = CASE
      WHEN lead.budget_max IS NULL
        OR (
          (v_previous #>> '{budgetMaxEur,value}') IS NOT NULL
          AND lead.budget_max =
            (v_previous #>> '{budgetMaxEur,value}')::numeric
        )
      THEN coalesce(
        (v_state #>> '{budgetMaxEur,value}')::numeric,
        lead.budget_max
      )
      ELSE lead.budget_max
    END,

    event_date = CASE
      WHEN v_dates_changed
        AND (
          lead.event_date IS NULL
          OR (
            v_prev_event_date IS NOT NULL
            AND lead.event_date = v_prev_event_date
          )
        )
      THEN v_event_date
      ELSE lead.event_date
    END,

    alternative_date = CASE
      WHEN v_dates_changed
        AND (
          lead.alternative_date IS NULL
          OR (
            v_prev_alternative_date IS NOT NULL
            AND lead.alternative_date =
              v_prev_alternative_date
          )
        )
      THEN v_alternative_date
      ELSE lead.alternative_date
    END,

    date_flexible = CASE
      WHEN v_dates_changed
        AND (
          v_previous IS NULL
          OR lead.date_flexible = (
            coalesce(
              jsonb_array_length(
                v_previous->'dateOptions'
              ),
              0
            ) > 1
          )
        )
      THEN jsonb_array_length(
        v_state->'dateOptions'
      ) > 1
      ELSE lead.date_flexible
    END,

    requested_services = CASE
      WHEN cardinality(
        coalesce(
          lead.requested_services,
          ARRAY[]::text[]
        )
      ) = 0
        OR lead.requested_services = v_prev_services
      THEN v_services
      ELSE lead.requested_services
    END,

    metadata = coalesce(
      lead.metadata,
      '{}'::jsonb
    ) || jsonb_build_object(
      'intake_thread_id', v_thread_id,
      'intake_last_message_id', p_message_id,
      'intake_date_options',
        v_state->'dateOptions',
      'intake_date_range',
        v_state->'dateRange',
      'intake_sleepers',
        v_state #> '{sleepers,value}',
      'intake_venue_type',
        v_state #> '{venueType,value}',
      'intake_location_text',
        v_state #> '{location,value}'
    ),

    updated_at = now()

  WHERE lead.id = v_lead_id
    AND lead.company_id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'INTAKE_LEAD_UPDATE_FAILED';
  END IF;

  -- Próxima acción.
  -- No implica enviar un mensaje.

  IF (
    v_state #>> '{attendees,value}'
  ) IS NULL THEN

    v_action := 'request_guest_count';

  ELSIF (
    v_date IS NULL
  ) THEN

    v_action := 'request_event_date';

  ELSIF (
    v_event_date IS NULL
  ) THEN

    v_action := 'confirm_event_year';

  ELSIF (
    v_state #>> '{location,value}'
  ) IS NULL THEN

    v_action := 'request_location';

  ELSE

    v_action := 'match_venues';

  END IF;

  UPDATE public.crm_intake_threads
  SET
    state = v_state,
    version = (
      v_state->>'version'
    )::integer,
    next_action = v_action,
    last_source_message_id =
      p_message_id,
    last_message_at = now(),
    updated_at = now()
  WHERE id = v_thread_id
    AND company_id = p_company_id;

  -- El recibo se crea dentro
  -- de la misma transacción.

  INSERT INTO
    public.crm_intake_message_receipts (
      company_id,
      thread_id,
      provider,
      external_message_id,
      fact_delta
    )
  VALUES (
    p_company_id,
    v_thread_id,
    'whapi',
    p_message_id,
    p_draft
  );

  RETURN jsonb_build_object(
    'status',
      CASE
        WHEN v_created
        THEN 'created'
        ELSE 'updated'
      END,
    'threadId',
      v_thread_id,
    'leadRequestId',
      v_lead_id,
    'nextAction',
      v_action,
    'version',
      v_state->>'version'
  );

END;
$$;

REVOKE ALL ON FUNCTION
public.crm_intake_capture_message(
  text,
  text,
  text,
  jsonb,
  text,
  text
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.crm_intake_capture_message(
  text,
  text,
  text,
  jsonb,
  text,
  text
)
TO service_role;
