-- Read/rollback-only smoke for the reusable restaurant Super Admin blueprint.
-- Run after applying migration 20261118180000, with psql -X -v ON_ERROR_STOP=1.
-- NEVER uses Delibocados or claims POS orders.
BEGIN;

DO $$
DECLARE
  v_company text := 'neuromind-blueprint-smoke-20261118';
  v_count integer;
  v_enabled integer;
  v_sector text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.commerce_companies WHERE id=v_company) THEN
    RAISE EXCEPTION 'SMOKE_ID_COLLISION';
  END IF;

  PERFORM public.platform_provision_company(
    v_company,'Neuromind Restaurant Smoke','smoke@neuromind.invalid',
    'restaurant','starter','COP'
  );
  PERFORM public.platform_prepare_restaurant_blueprint(v_company);
  PERFORM public.platform_prepare_restaurant_blueprint(v_company);

  SELECT sector INTO v_sector FROM public.platform_company_onboarding
  WHERE company_id=v_company;
  IF v_sector <> 'restaurant' THEN RAISE EXCEPTION 'SECTOR_MISMATCH'; END IF;

  SELECT count(*) INTO v_count FROM public.platform_restaurant_blueprints
  WHERE company_id=v_company AND status='draft'
    AND qr_enabled=false AND pos_bridge_enabled=false AND fiscal_enabled=false
    AND kitchen_verified=false;
  IF v_count<>1 THEN RAISE EXCEPTION 'BLUEPRINT_NOT_DISABLED'; END IF;

  SELECT count(*) INTO v_count FROM public.platform_restaurant_setup_steps
  WHERE company_id=v_company AND status='pending';
  IF v_count<>9 THEN RAISE EXCEPTION 'BLUEPRINT_STEPS_NOT_SEEDED'; END IF;

  SELECT count(*) INTO v_count FROM public.company_integrations
  WHERE company_id=v_company AND provider IN ('native','whapi','toteat','pos360','dian')
    AND status='pending' AND enabled=false;
  IF v_count<>5 THEN RAISE EXCEPTION 'INTEGRATIONS_NOT_DISABLED'; END IF;

  SELECT count(*) INTO v_enabled FROM public.platform_company_modules
  WHERE company_id=v_company AND enabled=true;
  IF v_enabled<>0 THEN RAISE EXCEPTION 'MODULES_UNEXPECTEDLY_ACTIVE'; END IF;

  RAISE NOTICE 'BLUEPRINT_SMOKE=OK | steps=9 | integrations=5 | activation=OFF';
END $$;

ROLLBACK;
