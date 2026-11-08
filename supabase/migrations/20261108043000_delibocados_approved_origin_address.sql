-- Owner-selected Delibocados pickup/delivery origin address.
-- This is a postal address, NOT verified entrance coordinates.
-- Do not create unverified geofences, enable Routes, or mark GPS verified.
BEGIN;
INSERT INTO public.restaurant_agent_business_profiles(company_id)
 SELECT id FROM public.commerce_companies WHERE id='delibocados'
 ON CONFLICT(company_id) DO NOTHING;

UPDATE public.restaurant_agent_business_profiles
SET
  origin_lat=CASE WHEN location_address IS DISTINCT FROM 'Calle 9 #10A-28, Funza, Cundinamarca, Colombia'
    THEN NULL ELSE origin_lat END,
  origin_lng=CASE WHEN location_address IS DISTINCT FROM 'Calle 9 #10A-28, Funza, Cundinamarca, Colombia'
    THEN NULL ELSE origin_lng END,
  origin_verified=CASE WHEN location_address IS DISTINCT FROM 'Calle 9 #10A-28, Funza, Cundinamarca, Colombia'
    THEN false ELSE origin_verified END,
  location_address='Calle 9 #10A-28, Funza, Cundinamarca, Colombia',
  city='Funza',
  updated_by='owner_selected_location_20261108',
  updated_at=now()
WHERE company_id='delibocados';

INSERT INTO public.commerce_schema_migrations(version,description)
 VALUES('20261108043000','Delibocados owner-selected Calle 9 #10A-28 address; GPS remains unverified')
 ON CONFLICT(version) DO NOTHING;
COMMIT;
