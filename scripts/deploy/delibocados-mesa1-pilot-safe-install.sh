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
# A locally modified QR route is expected: preserve it using a three-way
# merge in /tmp. Never overwrite any VPS edit or resolve conflicts by guessing.
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
BASE="$(git merge-base HEAD FETCH_HEAD)" || fail "NO_SE_PUDO_OBTENER_ANCESTRO_COMUN"
BACKUP="$(mktemp -d /tmp/deli-qr-pilot-install.XXXXXX)"
cp -p "$QR" "$BACKUP/restaurant-qr-public.routes.ts.original"
git show "$BASE:$QR" > "$BACKUP/qr-base.ts" || fail "FALTA_BASE_QR"
git show "FETCH_HEAD:$QR" > "$BACKUP/restaurant-qr-public.routes.ts.new"
git show "FETCH_HEAD:$MIG" > "$BACKUP/pilot.sql"

echo "=== FUSION SEGURA DE CAMBIOS LOCALES QR ==="
# git merge-file -p leaves ALL original files untouched; only a clean,
# non-conflicting result may be copied into the API source.
merge_result=0
git merge-file -p \
  -L 'QR_VPS_LOCAL' -L 'QR_ANCESTRO' -L 'QR_PILOTO_GITHUB' \
  "$BACKUP/restaurant-qr-public.routes.ts.original" \
  "$BACKUP/qr-base.ts" \
  "$BACKUP/restaurant-qr-public.routes.ts.new" \
  > "$BACKUP/qr-merged.ts" || merge_result=$?
if [[ "$merge_result" -ne 0 ]]; then
  echo "CONFLICTO_QR=SI - NO SE MODIFICO NINGUN ARCHIVO" >&2
  echo "DIAGNOSTICO_EN=$BACKUP/qr-merged.ts" >&2
  echo "Para revisar SIN mostrar secretos: git diff -- $QR" >&2
  fail "FUSION_QR_REQUIERE_REVISION_MANUAL"
fi

grep -Fq "restaurant_ops_create_qr_order_pilot" "$BACKUP/pilot.sql" || fail "FUNCION_PILOTO_AUSENTE"
grep -Fq 'DELIBOCADOS_QR_MESA1_PILOT_ENABLED' "$BACKUP/qr-merged.ts" || fail "FLAG_PILOTO_AUSENTE"

echo "FUSION_QR=SIN_CONFLICTOS | CAMBIOS_LOCALES=CONSERVADOS"
cp "$BACKUP/qr-merged.ts" "$QR"
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
# PostgREST may need an explicit schema cache reload after a new RPC.
docker exec "$DB" psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -c "NOTIFY pgrst, 'reload schema';" >/dev/null
echo "POSTGREST_SCHEMA_RELOAD=SOLICITADA"

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
