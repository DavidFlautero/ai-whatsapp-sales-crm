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
# Existing migrations may come from a prior interrupted installation.
# Compare their bytes to GitHub before deciding whether to resume.
command -v pnpm >/dev/null || fail "FALTA_PNPM"
command -v docker >/dev/null || fail "FALTA_DOCKER"

DB="$(docker ps --format '{{.Names}}' | grep -Ei 'supabase.*db|db.*supabase' | head -n 1 || true)"
[[ -n "$DB" ]] || fail "POSTGRES_NO_ENCONTRADO"
query() { docker exec "$DB" psql -U postgres -d postgres -Atqc "$1"; }

OLD="$(query "SELECT count(*) FROM public.restaurant_ops_pos_exports WHERE company_id='delibocados' AND provider='pos360' AND status='pending';")"
[[ "$OLD" = "6" ]] || fail "LA_COLA_HISTORICA_YA_NO_ES_6_PENDING: $OLD"
INSTALLED="$(query "SELECT count(*) FROM public.commerce_schema_migrations WHERE version='20261124150000';")"
[[ "$INSTALLED" = "0" || "$INSTALLED" = "1" ]] || fail "ESTADO_MIGRACION_INESPERADO"
echo "COLA_HISTORICA=6_PENDING_SIN_CAMBIOS"
echo "MIGRACION_DB_REGISTRADA=$INSTALLED"

git fetch -q origin "$BRANCH"
git cat-file -e "FETCH_HEAD:$QR" || fail "RUTA_QR_NO_ENCONTRADA_EN_GITHUB"
git cat-file -e "FETCH_HEAD:$MIG" || fail "MIGRACION_NO_ENCONTRADA_EN_GITHUB"
BASE="$(git merge-base HEAD FETCH_HEAD)" || fail "NO_SE_PUDO_OBTENER_ANCESTRO_COMUN"
BACKUP="$(mktemp -d /tmp/deli-qr-pilot-install.XXXXXX)"
cp -p "$QR" "$BACKUP/restaurant-qr-public.routes.ts.original"
git show "$BASE:$QR" > "$BACKUP/qr-base.ts" || fail "FALTA_BASE_QR"
git show "FETCH_HEAD:$QR" > "$BACKUP/restaurant-qr-public.routes.ts.new"
git show "FETCH_HEAD:$MIG" > "$BACKUP/pilot.sql"

if [[ -f "$MIG" ]]; then
  if ! cmp -s "$MIG" "$BACKUP/pilot.sql"; then
    echo "MIGRACION_LOCAL_SHA256=$(sha256sum "$MIG" | cut -d ' ' -f 1)"
    echo "MIGRACION_GITHUB_SHA256=$(sha256sum "$BACKUP/pilot.sql" | cut -d ' ' -f 1)"
    fail "MIGRACION_EXISTENTE_DIFERENTE_NO_SE_SOBRESCRIBE"
  fi
  echo "MIGRACION_EXISTENTE=IDENTICA_A_GITHUB"
else
  echo "MIGRACION_EXISTENTE=NO"
fi

# If a previous run already left a validated pilot QR route, don't merge it again.
if grep -Fq 'DELIBOCADOS_QR_MESA1_PILOT_ENABLED' "$QR"; then
  for guard in 'NEUROMIND_CANARY_SINGLE_ORDER' \
    'restaurant_ops_create_qr_order_pilot' \
    'QR_PILOT_ORDER_RESTRICTED' \
    'QR_PILOT_SCOPE_DENIED'; do
    grep -Fq "$guard" "$QR" || fail "RUTA_QR_PILOTO_EXISTENTE_INCOMPLETA"
  done
  cp -p "$QR" "$BACKUP/qr-merged.ts"
  echo "RUTA_QR_PILOTO_YA_PRESENTE=CONSERVADA"
else
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
  echo "=== RESOLVIENDO EXCLUSIVAMENTE EL CONFLICTO CANARY IDENTIFICADO ==="
  # This deterministic resolver accepts exactly ONE known conflict, preserving
  # the VPS's stricter customer/table restrictions and the new transactional RPC.
  # Anything different remains blocked. It never edits the live file.
  if ! python3 - "$BACKUP/qr-merged.ts" <<'PY'
from pathlib import Path
import re
import sys

p = Path(sys.argv[1])
s = p.read_text(encoding="utf-8")
rx = re.compile(
    r"^<<<<<<< QR_VPS_LOCAL\n(.*?)^=======\n(.*?)^>>>>>>> QR_PILOTO_GITHUB\n",
    re.MULTILINE | re.DOTALL
)
blocks = list(rx.finditer(s))
if len(blocks) != 1:
    raise SystemExit("BLOQUEADO: NO_ES_UN_SOLO_CONFLICTO_CONOCIDO")
a, b = blocks[0].group(1), blocks[0].group(2)

vps_tail = '    const order=await supabaseRpc<Row>("restaurant_ops_create_qr_order",{'
pilot_tail = '''    const order=await supabaseRpc<Row>(
      normalEnabled?"restaurant_ops_create_qr_order":"restaurant_ops_create_qr_order_pilot",{'''
required_vps = (
    '// NEUROMIND_CANARY_SINGLE_ORDER',
    'payload.tableId!=="f3de7249-b4a9-551d-bd65-dc7fa50a0f92"',
    'payload.customerName.trim().toUpperCase()!=="PILOTO NEUROMIND"',
    'Boolean(payload.customerPhone?.trim())',
    '"QR_PILOT_ORDER_RESTRICTED"'
)
required_new = (
    'if(!normalEnabled){',
    'table.label!=="Mesa 1"',
    '"QR_PILOT_SCOPE_DENIED"',
    'restaurant_ops_create_qr_order_pilot'
)
if not a.rstrip().endswith(vps_tail):
    raise SystemExit("BLOQUEADO: CANARY_VPS_DIFERENTE")
if not b.rstrip().endswith(pilot_tail):
    raise SystemExit("BLOQUEADO: RPC_PILOTO_DIFERENTE")
if any(a.count(x)!=1 for x in required_vps):
    raise SystemExit("BLOQUEADO: RESTRICCIONES_VPS_DIFERENTES")
if any(b.count(x)!=1 for x in required_new):
    raise SystemExit("BLOQUEADO: RESTRICCIONES_GITHUB_DIFERENTES")

# Local canary safety stays intact; the new pilot-only RPC replaces the old
# unrestricted QR RPC. It remains blocked by both layers of validation.
vps_guard = a[:a.rfind(vps_tail)]
resolved = vps_guard + b
combined = s[:blocks[0].start()] + resolved + s[blocks[0].end():]
if re.search(r"^(<<<<<<<|=======|>>>>>>>)", combined, re.MULTILINE):
    raise SystemExit("BLOQUEADO: CONFLICTOS_RESTANTES")
if combined.count("NEUROMIND_CANARY_SINGLE_ORDER")!=1 or combined.count(
    'normalEnabled?"restaurant_ops_create_qr_order":"restaurant_ops_create_qr_order_pilot"'
)!=1:
    raise SystemExit("BLOQUEADO: FUSION_NO_VALIDA")
p.write_text(combined, encoding="utf-8")
print("CONFLICTO_CANARY=RESUELTO_SIN_PERDER_PROTECCIONES")
PY
  then
    echo "CONFLICTO_QR=SI - NO SE MODIFICO NINGUN ARCHIVO" >&2
    echo "DIAGNOSTICO_EN=$BACKUP/qr-merged.ts" >&2
    fail "FUSION_QR_REQUIERE_REVISION_MANUAL"
  fi
fi

fi # end optional QR three-way merge

grep -Fq "restaurant_ops_create_qr_order_pilot" "$BACKUP/pilot.sql" || fail "FUNCION_PILOTO_AUSENTE"
grep -Fq 'DELIBOCADOS_QR_MESA1_PILOT_ENABLED' "$BACKUP/qr-merged.ts" || fail "FLAG_PILOTO_AUSENTE"

echo "FUSION_QR=VALIDADA | CAMBIOS_LOCALES=CONSERVADOS"
MIG_CREATED=0
if [[ ! -f "$MIG" ]]; then
  cp "$BACKUP/pilot.sql" "$MIG"
  MIG_CREATED=1
fi
cp "$BACKUP/qr-merged.ts" "$QR"

restore_files() {
  cp -p "$BACKUP/restaurant-qr-public.routes.ts.original" "$QR"
  if [[ "$MIG_CREATED" = "1" ]]; then rm -f "$MIG"; fi
}
if ! pnpm --filter @ventas/api typecheck; then
  restore_files
  fail "TYPECHECK_FALLO_SE_RESTAURARON_ARCHIVOS"
fi
echo "TYPECHECK=OK"

if [[ "$INSTALLED" = "0" ]]; then
  if ! docker exec -i "$DB" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$MIG"; then
    restore_files
    fail "SQL_FALLO_SE_RESTAURARON_ARCHIVOS_MIGRACION_TRANSACCIONAL"
  fi
  echo "MIGRACION=APLICADA"
else
  echo "MIGRACION=YA_APLICADA_SE_OMITE_SQL"
fi

REG="$(query "SELECT count(*) FROM public.commerce_schema_migrations WHERE version='20261124150000';")"
[[ "$REG" = "1" ]] || fail "MIGRACION_NO_REGISTRADA"
GATE_CLASS="$(query "SELECT to_regclass('public.restaurant_ops_qr_single_use_pilot') IS NOT NULL;")"
[[ "$GATE_CLASS" = "t" ]] || fail "TABLA_PILOTO_AUSENTE"
RPC_COUNT="$(query "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='restaurant_ops_create_qr_order_pilot';")"
[[ "$RPC_COUNT" = "1" ]] || fail "FUNCION_PILOTO_AUSENTE_DB"
UNSAFE="$(query "SELECT count(*) FROM public.restaurant_ops_qr_single_use_pilot WHERE enabled OR consumed_at IS NOT NULL OR order_id IS NOT NULL;")"
[[ "$UNSAFE" = "0" ]] || fail "PILOTO_YA_ACTIVADO_O_CONSUMIDO"
echo "VALIDACION_DB_PILOTO=OK"
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
