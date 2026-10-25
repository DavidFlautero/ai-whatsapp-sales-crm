-- Eventos Mediterraneo
-- Etapa 1: proteccion de ingesta.
--
-- No elimina mensajes.
-- No modifica conversaciones.
-- No confirma reservas.
--
-- Impide duplicados concurrentes
-- de mensajes externos por empresa.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.messages
    WHERE external_message_id IS NOT NULL
    GROUP BY
      company_id,
      external_message_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'EXISTING_MESSAGE_DUPLICATES_REQUIRE_REVIEW';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS
  idx_messages_company_external_unique
ON public.messages (
  company_id,
  external_message_id
)
WHERE external_message_id IS NOT NULL;

COMMIT;
