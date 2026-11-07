-- PostgreSQL CI smoke: all changes rolled back.
BEGIN;
DO $$
DECLARE
  n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.restaurant_agent_business_profiles
                 WHERE company_id='delibocados' AND timezone='America/Bogota')
  THEN RAISE EXCEPTION 'AGENT_PROFILE_SEED_MISSING'; END IF;

  UPDATE public.restaurant_agent_business_profiles
  SET opening_hours='{"mon":{"enabled":true,"open":"08:00","close":"20:00"}}'::jsonb,
      special_hours_note='QA solo, no horario real',
      updated_by='ci'
  WHERE company_id='delibocados';
  IF NOT EXISTS(SELECT 1 FROM public.restaurant_agent_business_profiles
    WHERE company_id='delibocados'
      AND opening_hours->'mon'->>'open'='08:00')
  THEN RAISE EXCEPTION 'HOURS_COULD_NOT_BE_SAVED'; END IF;

  INSERT INTO public.restaurant_agent_learnings(
    company_id,category,question,answer,evidence,source_type
  ) VALUES('delibocados','faq','¿Hacen domicilio a Bogotá?',
    'Respuesta pendiente de revisión del encargado.','Pregunta frecuente anonimizada','conversation');
  SELECT count(*) INTO n FROM public.restaurant_agent_learnings
    WHERE company_id='delibocados' AND status='proposed';
  IF n<>1 THEN RAISE EXCEPTION 'LEARNING_SHOULD_START_PENDING'; END IF;

  UPDATE public.restaurant_agent_learnings
  SET status='approved',answer='No ofrecemos domicilios a Bogotá.',
      reviewed_by='qa-owner',reviewed_at=now()
  WHERE company_id='delibocados' AND status='proposed';
  SELECT count(*) INTO n FROM public.restaurant_agent_learnings
    WHERE company_id='delibocados' AND status='approved' AND reviewed_at IS NOT NULL;
  IF n<>1 THEN RAISE EXCEPTION 'LEARNING_REVIEW_FAILED'; END IF;

  IF NOT EXISTS(SELECT 1 FROM pg_class
    WHERE oid='public.restaurant_agent_learnings'::regclass AND relrowsecurity)
  THEN RAISE EXCEPTION 'LEARNING_RLS_DISABLED'; END IF;
  RAISE NOTICE 'AGENT_BUSINESS_LEARNING_TEST_OK';
END $$;
ROLLBACK;
