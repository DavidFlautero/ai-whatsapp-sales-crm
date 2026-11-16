-- Delibocados: retain encrypted reprintable table QR capabilities without expiry.
-- Existing QR digests remain untouched; printed codes keep working.
-- Previously-issued hash-only QR tokens cannot be recovered from SHA-256.
BEGIN;
ALTER TABLE public.restaurant_ops_qr_tables
 ADD COLUMN qr_token_ciphertext text;
ALTER TABLE public.restaurant_ops_qr_tables
 ADD CONSTRAINT restaurant_ops_printable_qr_envelope_check
 CHECK (qr_token_ciphertext IS NULL OR (
   length(qr_token_ciphertext) BETWEEN 40 AND 512
   AND qr_token_ciphertext ~ '^qr-v1\\.[A-Za-z0-9_-]+$'
 ));
INSERT INTO public.commerce_schema_migrations(version,description)
VALUES('20261116113000','Delibocados encrypted printable QR recovery, no expiration')
ON CONFLICT(version) DO NOTHING;
COMMIT;
