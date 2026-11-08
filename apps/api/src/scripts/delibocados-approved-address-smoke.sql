DO $$
DECLARE addr text; gps boolean; lat double precision; lng double precision;
BEGIN
 SELECT location_address,origin_verified,origin_lat,origin_lng
 INTO addr,gps,lat,lng
 FROM public.restaurant_agent_business_profiles
 WHERE company_id='delibocados';
 IF addr IS DISTINCT FROM 'Calle 9 #10A-28, Funza, Cundinamarca, Colombia'
 THEN RAISE EXCEPTION 'DELIBOCADOS_OWNER_SELECTED_ADDRESS_NOT_SAVED'; END IF;
 IF gps IS DISTINCT FROM false OR lat IS NOT NULL OR lng IS NOT NULL
 THEN RAISE EXCEPTION 'UNVERIFIED_GPS_ORIGIN_WAS_FABRICATED'; END IF;
 IF (SELECT count(*) FROM public.restaurant_ops_zones WHERE company_id='delibocados' AND active)=0
 THEN RAISE NOTICE 'DELIVERY_ZONES_REMAIN_INACTIVE_UNTIL_VERIFIED'; END IF;
 RAISE NOTICE 'DELIBOCADOS_OWNER_ORIGIN_ADDRESS_OK';
END $$;
