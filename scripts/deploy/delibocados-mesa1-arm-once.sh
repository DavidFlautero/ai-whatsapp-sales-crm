#!/usr/bin/env bash
# WARNING: arms ONE live QR checkout at Mesa 1, but NEVER claims/sends an export.
# Run only with original SmartPOS + Cocina visible and local canary confirmed.
set -Eeuo pipefail
[[ "${1:-}" == "--armar-mesa1" ]] || { echo "BLOQUEADO: falta --armar-mesa1"; exit 1; }
cd /var/www/control
fail(){ echo "BLOQUEADO: $*" >&2; exit 1; }
QR=apps/api/src/routes/restaurant-qr-public.routes.ts
GUARD=apps/api/src/routes/restaurant-pos360-bridge.routes.ts
[[ -f "$QR" && -f "$GUARD" ]] || fail "RUTAS_API_NO_ENCONTRADAS"
for marker in NEUROMIND_CANARY_SINGLE_ORDER DELIBOCADOS_QR_MESA1_PILOT_ENABLED restaurant_ops_create_qr_order_pilot; do
  grep -Fq "$marker" "$QR" || fail "QR_PILOTO_INCOMPLETO:$marker"
done
grep -Fq FULL_CLAIM_DISABLED_USE_PILOT "$GUARD" || fail "CLAIM_GENERAL_NO_PROTEGIDO"
grep -Fq restaurant_ops_pos360_claim_pilot "$GUARD" || fail "CLAIM_PILOTO_NO_INSTALADO"
DB="$(docker ps --format '{{.Names}}' | grep -Ei 'supabase.*db|db.*supabase' | head -n 1 || true)"
[[ -n "$DB" ]] || fail "POSTGRES_NO_ENCONTRADO"
query(){ docker exec "$DB" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "$1"; }

[[ "$(query "SELECT count(*) FROM public.commerce_schema_migrations WHERE version='20261124150000';")" = 1 ]] || fail "MIGRACION_QR_NO_INSTALADA"
[[ "$(query "SELECT count(*) FROM public.restaurant_ops_pos_exports WHERE company_id='delibocados' AND provider='pos360' AND status='pending';")" = 6 ]] || fail "HISTORICOS_CAMBIADOS"
[[ "$(query "SELECT count(*) FROM public.restaurant_ops_pos360_pilot_allowlist WHERE enabled=true AND expires_at>now();")" = 0 ]] || fail "HAY_ALLOWLISTS_ACTIVAS"
[[ "$(query "SELECT count(*) FROM public.restaurant_ops_qr_single_use_pilot WHERE singleton=1 AND enabled=false AND consumed_at IS NULL AND order_id IS NULL;")" = 1 ]] || fail "PILOTO_NO_ESTA_LIBRE"
[[ "$(query "SELECT count(*) FROM public.company_integrations WHERE company_id='delibocados' AND provider='pos360' AND status='pending' AND enabled=false;")" = 1 ]] || fail "ESTADO_INTEGRACION_INESPERADO"

echo "PREARMADO=VALIDADO"
echo "HISTORICOS=6_PENDING_INTACTOS"
echo "WINDOWS_CANARY_DEBE_ESTAR_EN_CONTROLLED_CANARY_PLACE1"
echo "=== ARMANDO UNA VENTANA DE 15 MINUTOS ==="

docker exec -i "$DB" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -P pager=off <<'SQL'
BEGIN;
DO $$
DECLARE
  v_count int;
  v_table uuid;
BEGIN
  -- Serialise concurrent arming attempts.
  PERFORM 1 FROM public.restaurant_ops_qr_single_use_pilot
    WHERE singleton=1 AND company_id='delibocados' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NO_PILOT_GATE'; END IF;
  SELECT count(*) INTO v_count
  FROM public.restaurant_ops_qr_tables
  WHERE company_id='delibocados' AND label='Mesa 1' AND enabled=true;
  SELECT id INTO v_table
  FROM public.restaurant_ops_qr_tables
  WHERE company_id='delibocados' AND label='Mesa 1' AND enabled=true
  LIMIT 1;
  IF v_count<>1 OR v_table IS DISTINCT FROM
     'f3de7249-b4a9-551d-bd65-dc7fa50a0f92'::uuid
  THEN RAISE EXCEPTION 'WRONG_MESA1_QR'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.restaurant_ops_qr_single_use_pilot
    WHERE singleton=1 AND company_id='delibocados' AND table_id=v_table
      AND enabled=false AND consumed_at IS NULL
      AND order_id IS NULL AND source_key IS NULL
  ) THEN RAISE EXCEPTION 'PILOT_ALREADY_USED_OR_ENABLED'; END IF;
  IF (SELECT count(*) FROM public.restaurant_ops_pos_exports
    WHERE company_id='delibocados' AND provider='pos360'
      AND status='pending')<>6
  THEN RAISE EXCEPTION 'HISTORICAL_QUEUE_CHANGED'; END IF;
  IF EXISTS(SELECT 1 FROM public.restaurant_ops_pos360_pilot_allowlist
    WHERE enabled=true AND expires_at>now())
  THEN RAISE EXCEPTION 'UNEXPECTED_ALLOWLIST'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.restaurant_ops_pos_product_map
    WHERE company_id='delibocados' AND provider='pos360'
      AND product_id='deli-006' AND external_product_code='DLB-P-0006'
      AND active=true AND reviewed_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'POS_SKU_NOT_APPROVED'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.restaurant_menu_documents m,
      LATERAL jsonb_array_elements(
        coalesce(m.payload->'products','[]'::jsonb)
      ) p(item)
    WHERE m.company_id='delibocados' AND m.revision=3
      AND p.item->>'id'='deli-006'
      AND p.item->>'priceCOP'='14000'
      AND p.item->>'available' IS DISTINCT FROM 'false'
      AND p.item->>'priceNeedsReview' IS DISTINCT FROM 'true'
  ) THEN RAISE EXCEPTION 'MENU_CHANGED'; END IF;
  UPDATE public.company_integrations
    SET status='connected', enabled=true
    WHERE company_id='delibocados' AND provider='pos360'
      AND status='pending' AND enabled=false;
  IF NOT FOUND THEN RAISE EXCEPTION 'POS_INTEGRATION_STATE_CHANGED'; END IF;
  UPDATE public.restaurant_ops_qr_single_use_pilot
    SET enabled=true,valid_from=now(),
      expires_at=now()+interval '15 minutes',
      approved_by='mesa1-supervised-20261125'
    WHERE singleton=1 AND company_id='delibocados'
      AND table_id=v_table AND enabled=false
      AND consumed_at IS NULL AND order_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'PILOT_GATE_CHANGED'; END IF;
END $$;
COMMIT;
SQL

if ! DELIBOCADOS_QR_CHECKOUT_ENABLED=0 \
 DELIBOCADOS_QR_MESA1_PILOT_ENABLED=1 \
 DELIBOCADOS_POS360_FULL_CLAIM_ENABLED=0 \
 pm2 restart neuromind-api --update-env >/dev/null; then
  echo "ERROR_PMM2: API no reinicio. Cerrando ventana de QR."
  docker exec "$DB" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c     "UPDATE public.restaurant_ops_qr_single_use_pilot SET enabled=false WHERE singleton=1 AND consumed_at IS NULL;" || true
  fail "API_NO_REINICIO"
fi

pm2 jlist | node -e '
let b="";process.stdin.on("data",x=>b+=x);process.stdin.on("end",()=>{
const a=JSON.parse(b).find(x=>x.name==="neuromind-api");
const e=a?.pm2_env||{};
const ready=e.status==="online"&&e.DELIBOCADOS_QR_CHECKOUT_ENABLED==="0"&&
 e.DELIBOCADOS_QR_MESA1_PILOT_ENABLED==="1"&&
 e.DELIBOCADOS_POS360_FULL_CLAIM_ENABLED==="0";
console.log("API_ONLINE="+(e.status==="online"));
console.log("PILOTO_HTTP_ARMADO="+(e.DELIBOCADOS_QR_MESA1_PILOT_ENABLED==="1"));
console.log("CHECKOUT_GENERAL_APAGADO="+(e.DELIBOCADOS_QR_CHECKOUT_ENABLED==="0"));
console.log("CLAIM_GENERAL_APAGADO="+(e.DELIBOCADOS_POS360_FULL_CLAIM_ENABLED==="0"));
if(!ready)process.exitCode=1;
});'
query "SELECT 'PILOTO_GATE='||(CASE WHEN enabled AND now()<expires_at THEN 'ON' ELSE 'OFF' END)||' EXPIRA='||expires_at FROM public.restaurant_ops_qr_single_use_pilot WHERE singleton=1;"
echo "TRABAJADOR_WINDOWS=NO_EJECUTADO"
echo "SIGUIENTE=UN_SOLO_PEDIDO_QR_MESA1_DELI006_X1_EFECTIVO"
