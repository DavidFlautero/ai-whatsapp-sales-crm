#!/usr/bin/env bash
# Re-arm the SAME unused and EXPIRED Mesa 1 pilot for ONE controlled QR order.
# Does not restart PM2, enable checkout general, claim any exports or touch Windows.
set -Eeuo pipefail
[[ "${1:-}" == "--rearmar-expirado-mesa1" ]] || { echo "BLOQUEADO: falta --rearmar-expirado-mesa1"; exit 1; }
cd /var/www/control
fail(){ echo "BLOQUEADO: $*" >&2; exit 1; }
[[ "$(id -u)" = 0 ]] || fail "REQUIERE_ROOT"

# Check real process environment: no rollback/restart/canary disruption.
pm2 jlist | node -e '
let b="";process.stdin.on("data",x=>b+=x);process.stdin.on("end",()=>{
let a=JSON.parse(b).filter(p=>p.name==="neuromind-api");
if(a.length!==1){console.log("API_PROCESOS="+a.length);process.exitCode=1;return;}
const e=a[0].pm2_env||{};
const ok=e.status==="online" && e.DELIBOCADOS_QR_CHECKOUT_ENABLED==="0" &&
 e.DELIBOCADOS_QR_MESA1_PILOT_ENABLED==="1" &&
 e.DELIBOCADOS_POS360_FULL_CLAIM_ENABLED==="0" &&
 e.DELIBOCADOS_WEB_CHECKOUT_ENABLED!=="1";
console.log("API_ONLINE="+(e.status==="online"));
console.log("QR_SOLO_PILOTO="+(e.DELIBOCADOS_QR_MESA1_PILOT_ENABLED==="1"&&e.DELIBOCADOS_QR_CHECKOUT_ENABLED==="0"));
console.log("CHECKOUT_WEB_OFF="+(e.DELIBOCADOS_WEB_CHECKOUT_ENABLED!=="1"));
console.log("CLAIM_GENERAL_OFF="+(e.DELIBOCADOS_POS360_FULL_CLAIM_ENABLED==="0"));
if(!ok)process.exitCode=1;
});' || fail "FLAGS_INSEGUROS"
status="$(curl --noproxy '*' -sS --max-time 6 -o /dev/null -w '%{http_code}' \
  -X POST -H 'Content-Type: application/json' --data '{}' \
  http://127.0.0.1:4000/public/delibocados-qr/context 2>/dev/null || true)"
[[ "$status" == 400 ]] || fail "API_NO_LISTA_CONTEXT_HTTP_$status"
echo "API_QR_VALIDACION=LISTA"

DB="$(docker ps --format '{{.Names}}' | grep -Ei 'supabase.*db|db.*supabase' | head -n 1 || true)"
[[ -n "$DB" ]] || fail "POSTGRES_NO_ENCONTRADO"
q(){ docker exec "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atqc "$1"; }
[[ "$(q "SELECT count(*) FROM public.commerce_schema_migrations WHERE version='20261124150000'")" = 1 ]] || fail "MIGRACION_NO_VALIDADA"
echo "==== CONTROL_TRANSACCIONAL_REARME_15_MIN ===="

# Database lock prevents interleaving with checkout. Require expired + unconsumed.
# This statement is the only mutation. Raises and rolls back on ANY discrepancy.
docker exec -i "$DB" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -P pager=off <<'SQL'
BEGIN;
DO $$
DECLARE
  gate public.restaurant_ops_qr_single_use_pilot%ROWTYPE;
  v_count integer;
BEGIN
  SELECT * INTO gate
    FROM public.restaurant_ops_qr_single_use_pilot
    WHERE singleton=1 AND company_id='delibocados'
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NO_GATE'; END IF;
  IF gate.table_id IS DISTINCT FROM
     'f3de7249-b4a9-551d-bd65-dc7fa50a0f92'::uuid
  THEN RAISE EXCEPTION 'WRONG_TABLE_UUID'; END IF;
  IF gate.enabled IS DISTINCT FROM true OR gate.expires_at IS NULL
     OR now()<gate.expires_at OR gate.consumed_at IS NOT NULL
     OR gate.order_id IS NOT NULL OR gate.source_key IS NOT NULL
  THEN RAISE EXCEPTION 'GATE_NOT_EXPIRED_AND_UNUSED'; END IF;
  SELECT count(*) INTO v_count
    FROM public.restaurant_ops_qr_tables
    WHERE company_id='delibocados' AND label='Mesa 1' AND enabled=true
      AND id=gate.table_id;
  IF v_count<>1 THEN RAISE EXCEPTION 'MESA1_NOT_ENABLED_OR_AMBIGUOUS'; END IF;
  SELECT count(*) INTO v_count
    FROM public.restaurant_ops_pos_exports
    WHERE company_id='delibocados' AND provider='pos360' AND status='pending';
  IF v_count<>6 THEN RAISE EXCEPTION 'HISTORIC_PENDING_COUNT_CHANGED'; END IF;
  SELECT count(*) INTO v_count
    FROM public.restaurant_ops_pos360_pilot_allowlist
    WHERE enabled=true AND expires_at>now();
  IF v_count<>0 THEN RAISE EXCEPTION 'EXISTING_EXPORT_ALLOWLIST'; END IF;
  SELECT count(*) INTO v_count
    FROM public.company_integrations
    WHERE company_id='delibocados' AND provider='pos360'
      AND enabled=true AND status='connected';
  IF v_count<>1 THEN RAISE EXCEPTION 'POS360_INTEGRATION_MUST_ALREADY_BE_CONNECTED'; END IF;
  SELECT count(*) INTO v_count
    FROM public.restaurant_ops_pos_product_map
    WHERE company_id='delibocados' AND provider='pos360'
      AND product_id='deli-006' AND external_product_code='DLB-P-0006'
      AND active=true AND reviewed_at IS NOT NULL;
  IF v_count<>1 THEN RAISE EXCEPTION 'SKU_MAPPING_CHANGED'; END IF;
  SELECT count(*) INTO v_count
    FROM public.restaurant_menu_documents m
    CROSS JOIN LATERAL jsonb_array_elements(
      coalesce(m.payload->'products','[]'::jsonb)) AS p(item)
    WHERE m.company_id='delibocados' AND m.revision=3
      AND p.item->>'id'='deli-006' AND p.item->>'priceCOP'='14000'
      AND p.item->>'available' IS DISTINCT FROM 'false'
      AND p.item->>'priceNeedsReview' IS DISTINCT FROM 'true';
  IF v_count<>1 THEN RAISE EXCEPTION 'MENU_CHANGED'; END IF;
  UPDATE public.restaurant_ops_qr_single_use_pilot
     SET enabled=true, valid_from=now(),
         expires_at=now()+interval '15 minutes',
         approved_by='mesa1-second-window-20261125'
   WHERE singleton=1 AND company_id='delibocados'
     AND enabled=true AND consumed_at IS NULL
     AND order_id IS NULL AND source_key IS NULL
     AND expires_at<=now();
  IF NOT FOUND THEN RAISE EXCEPTION 'REARM_RACE_DETECTED'; END IF;
END $$;
COMMIT;
SELECT 'PILOTO_GATE='||
  CASE WHEN enabled=true AND consumed_at IS NULL AND now()<expires_at
  THEN 'ON' ELSE 'OFF' END||
  ' EXPIRA_UTC='||expires_at
FROM public.restaurant_ops_qr_single_use_pilot WHERE singleton=1;
SELECT 'PENDING_HISTORICOS='||count(*)
FROM public.restaurant_ops_pos_exports
WHERE company_id='delibocados' AND provider='pos360' AND status='pending';
SQL
echo "PEDIDOS_CREADOS=0"
echo "EXPORTACIONES_RECLAMADAS=0"
echo "SIGUIENTE=RECARGAR_QR_ORIGINAL_MESA1; UNICAMENTE deli-006 x1; PILOTO NEUROMIND; telefono vacio; efectivo."
