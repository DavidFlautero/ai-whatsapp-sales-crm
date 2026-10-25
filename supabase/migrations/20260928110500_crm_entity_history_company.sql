ALTER TABLE public.crm_entity_history
  DROP CONSTRAINT IF EXISTS crm_entity_history_entity_type_check;

ALTER TABLE public.crm_entity_history
  ADD CONSTRAINT crm_entity_history_entity_type_check
  CHECK (
    entity_type IN (
      'company',
      'general',
      'provider',
      'venue',
      'event'
    )
  );
