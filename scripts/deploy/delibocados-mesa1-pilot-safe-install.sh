#!/usr/bin/env bash
# Install only the reviewed Mesa 1 QR pilot API + DB migration in SAFE OFF state.
# Does not enable checkout, set export allowlists, claim or ACK jobs, or write POS.
set -Eeuo pipefail
cd /var/www/control

BRANCH="feat/delibocados-pos360-pilot-20261122"
QR="apps/api/src/routes/restaurant-qr-public.routes.ts"
MIG="supabase/migrations/20261124150000_delibocados_qr_mesa1_single_use.sql"
GUARD="apps/api/src/routes/restaurant-pos360-bridge.routes.ts"

fail() { echo "BLOQUEADO: $*" >&2; exit 1; }
[[ -f "$QR" && -f "$GUARD" && -f .env ]] || fail "NO_ES_EL_VPS_CONTROL"
grep -Fq "FULL_CLAIM_DISABLED_USE_PILOT" "$GUARD" || fail "CLAIM_GENERAL_NO_PROTEGIDO"
grep -Fq "restaurant_ops_pos360_claim_pilot" "$GUARD" || fail "CLAIM_PILOTO_NO_DESPLEGADO"
[[ -z "$(git status --porcelain -- "$QR")" ]] || fail "RUTA_QR_TIENE_CAMBIOS_LOCALES"
[[ ! -e "$MIG" ]] || fail "MIGRACION_YA_EXISTE_REVISAR_ANTES"
command -v pnpm >/dev/null || fail "FALTA_PNPM"
command -v docker >/dev/null || fail "FALTA_DOCKER"

DB="$(docker ps --format '{{.Names}}' | grep -Ei 'supabase.*db|db.*supabase' | head -n 1 || true)"
[[ -n "$DB" ]] || fail "POSTGRES_NO_ENCONTRADO"
query() { docker exec "$DB" psql -U postgres -d postgres -Atqc "$1"; }

OLD="$(query "SELECT count(*) FROM public.restaurant_ops_pos_exports WHERE company_id='delibocados' AND provider='pos360' AND status='pending';")"
[[ "$OLD" = "6" ]] || fail "LA_COLA_HISTORICA_YA_NO_ES_6_PENDING: $OLD"
INSTALLED="$(query "SELECT count(*) FROM public.commerce_schema_migrations WHERE version='20261124150000';")"
[[ "$INSTALLED" = "0" ]] || fail "MIGRACION_YA_REGISTRADA"
echo "COLA_HISTORICA=6_PENDING_SIN_CAMBIOS"

git fetch -q origin "$BRANCH"
git cat-file -e "FETCH_HEAD:$QR" || fail "RUTA_QR_NO_ENCONTRADA_EN_GITHUB"
git cat-file -e "FETCH_HEAD:$MIG" || fail "MIGRACION_NO_ENCONTRADA_EN_GITHUB"
BASE="$(git merge-base HEAD FETCH_HEAD)"
git diff --quiet "$BASE" HEAD -- "$QR" || fail "RUTA_QR_CAMBIO_EN_HEAD_DESDE_BRANCH"

BACKUP="$(mktemp -d /tmp/deli-qr-pilot-install.XXXXXX)"
cp -p "$QR" "$BACKUP/restaurant-qr-public.routes.ts.original"
git show "FETCH_HEAD:$QR" > "$BACKUP/restaurant-qr-public.routes.ts.new"
git show "FETCH_HEAD:$MIG" > "$BACKUP/pilot.sql"

grep -Fq "restaurant_ops_create_qr_order_pilot" "$BACKUP/pilot.sql" || fail "FUNCION_PILOTO_AUSENTE"
grep -Fq 'DELIBOCADOS_QR_MESA1_PILOT_ENABLED' "$BACKUP/restaurant-qr-public.routes.ts.new" || fail "FLAG_PILOTO_AUSENTE"

cp "$BACKUP/restaurant-qr-public.routes.ts.new" "$QR"
cp "$BACKUP/pilot.sql" "$MIG"

if ! pnpm --filter @ventas/api typecheck; then
  cp -p "$BACKUP/restaurant-qr-public.routes.ts.original" "$QR"
  rm -f "$MIG"
  fail "TYPECHECK_FALLO_SE_RESTAURARON_ARCHIVOS"
fi
echo "TYPECHECK=OK"

if ! docker exec -i "$DB" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$MIG"; then
  cp -p "$BACKUP/restaurant-qr-public.routes.ts.original" "$QR"
  rm -f "$MIG"
  fail "SQL_FALLO_SE_RESTAURARON_ARCHIVOS_MIGRACION_TRANSACCIONAL"
fi
echo "MIGRACION=APLICADA"

DELIBOCADOS_QR_CHECKOUT_ENABLED=0 \
DELIBOCADOS_QR_MESA1_PILOT_ENABLED=0 \
DELIBOCADOS_POS360_FULL_CLAIM_ENABLED=0 \
  pm2 restart neuromind-api --update-env >/dev/null

pm2 jlist | node -e '
let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{
  const p=JSON.parse(s).find(x=>x.name==="neuromind-api");
  const e=p?.pm2_env||{};
  const ok=p?.pm2_env?.status==="online"&&
    e.DELIBOCADOS_QR_CHECKOUT_ENABLED==="0"&&
    e.DELIBOCADOS_QR_MESA1_PILOT_ENABLED==="0"&&
    e.DELIBOCADOS_POS360_FULL_CLAIM_ENABLED==="0";
  console.log("API_ONLINE="+(p?.pm2_env?.status==="online"));
  console.log("QR_CHECKOUT_OFF="+(e.DELIBOCADOS_QR_CHECKOUT_ENABLED==="0"));
  console.log("PILOT_OFF="+(e.DELIBOCADOS_QR_MESA1_PILOT_ENABLED==="0"));
  console.log("FULL_CLAIM_OFF="+(e.DELIBOCADOS_POS360_FULL_CLAIM_ENABLED==="0"));
  if(!ok)process.exitCode=1;
});'

query "SELECT 'PILOT_GATE='||coalesce((SELECT CASE WHEN enabled THEN 'ON' ELSE 'OFF' END FROM public.restaurant_ops_qr_single_use_pilot WHERE singleton=1),'MISSING');"
query "SELECT 'PILOT_CONSUMED='||coalesce((SELECT CASE WHEN consumed_at IS NULL THEN 'NO' ELSE 'YES' END FROM public.restaurant_ops_qr_single_use_pilot WHERE singleton=1),'MISSING');"
AFTER="$(query "SELECT count(*) FROM public.restaurant_ops_pos_exports WHERE company_id='delibocados' AND provider='pos360' AND status='pending';")"
[[ "$AFTER" = "6" ]] || fail "CAMBIO_INESPERADO_COLA_HISTORICA: $AFTER"
echo "EXPORTACIONES_HISTORICAS=6_PENDING"
echo "INSTALACION_SEGURA=OK"
echo "CHECKOUT=OFF | PILOT=OFF | CLAIM_GENERAL=OFF | PEDIDOS_RECLAMADOS=0"
echo "BACKUP_RUTA=$BACKUP"
