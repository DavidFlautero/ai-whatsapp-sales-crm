-- Supervisor comercial.
-- Decisiones administrativas exclusivamente.
-- No confirma hechos comerciales.
-- No modifica cm_intel_tasks ni contactos.

CREATE TABLE IF NOT EXISTS public.cm_supervisor_review_decisions (
    company_id text NOT NULL,

    proposal_id uuid NOT NULL,

    contact_fingerprint text NOT NULL
        CHECK (
            contact_fingerprint ~ '^[a-f0-9]{20}$'
        ),

    decision text NOT NULL
        CHECK (
            decision IN ('reviewed','dismissed')
        ),

    actor text NOT NULL
        CHECK (
            length(trim(actor)) >= 3
        ),

    evidence_message_ids uuid[]
        NOT NULL DEFAULT '{}',

    source_sha256 text NOT NULL
        CHECK (
            source_sha256 ~ '^[a-f0-9]{64}$'
        ),

    decided_at timestamptz
        NOT NULL DEFAULT now(),

    PRIMARY KEY (
        company_id,
        proposal_id
    )
);

CREATE INDEX IF NOT EXISTS
cm_supervisor_review_decisions_date_idx
ON public.cm_supervisor_review_decisions (
    company_id,
    decided_at DESC
);

ALTER TABLE public.cm_supervisor_review_decisions
ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON public.cm_supervisor_review_decisions
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT
ON public.cm_supervisor_review_decisions
TO service_role;


CREATE OR REPLACE FUNCTION
public.cm_decide_supervisor_review(
    p_company text,
    p_proposal_id uuid,
    p_fingerprint text,
    p_decision text,
    p_actor text,
    p_source_sha256 text,
    p_evidence_ids uuid[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$

DECLARE
    inserted_id uuid;

BEGIN

    IF p_company IS NULL
       OR length(trim(p_company)) < 2
       OR p_proposal_id IS NULL
       OR p_fingerprint IS NULL
       OR p_fingerprint !~ '^[a-f0-9]{20}$'
       OR p_decision NOT IN (
           'reviewed',
           'dismissed'
       )
       OR p_actor IS NULL
       OR length(trim(p_actor)) < 3
       OR p_source_sha256 IS NULL
       OR p_source_sha256 !~ '^[a-f0-9]{64}$'
    THEN
        RAISE EXCEPTION
            'INVALID_SUPERVISOR_REVIEW';
    END IF;

    IF p_evidence_ids IS NULL
       OR cardinality(p_evidence_ids) > 200
       OR array_position(p_evidence_ids, NULL) IS NOT NULL
    THEN
        RAISE EXCEPTION
            'INVALID_SUPERVISOR_EVIDENCE';
    END IF;

    INSERT INTO public.cm_supervisor_review_decisions (
        company_id,
        proposal_id,
        contact_fingerprint,
        decision,
        actor,
        evidence_message_ids,
        source_sha256
    )
    VALUES (
        p_company,
        p_proposal_id,
        p_fingerprint,
        p_decision,
        p_actor,
        p_evidence_ids,
        p_source_sha256
    )

    ON CONFLICT (
        company_id,
        proposal_id
    )
    DO NOTHING

    RETURNING proposal_id
    INTO inserted_id;

    IF inserted_id IS NULL THEN
        RETURN false;
    END IF;

    INSERT INTO public.cm_commercial_audit (
        company_id,
        target_type,
        target_id,
        action,
        actor,
        details
    )
    VALUES (
        p_company,
        'supervisor_proposal',
        p_proposal_id,
        p_decision,
        p_actor,

        jsonb_build_object(
            'source_sha256',
            p_source_sha256,

            'evidence_reference_count',
            cardinality(p_evidence_ids),

            'scope',
            'administrative_review_only',

            'commercial_fact_verified',
            false,

            'automatic_action',
            false
        )
    );

    RETURN true;

END;

$function$;


REVOKE ALL
ON FUNCTION public.cm_decide_supervisor_review(
    text,
    uuid,
    text,
    text,
    text,
    text,
    uuid[]
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.cm_decide_supervisor_review(
    text,
    uuid,
    text,
    text,
    text,
    text,
    uuid[]
)
TO service_role;
