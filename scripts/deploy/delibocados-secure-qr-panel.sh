#!/usr/bin/env bash
# Deploy secure QR admin panel. Never enable public checkout or touch Nginx/DB.
set -euo pipefail
MODE="${1:---check}"
ROOT="/var/www/control"
BRANCH="fix/delibocados-qr-panel-real-20261113"
FILES=(
 "apps/api/src/routes/restaurant-ops.routes.ts"
 "apps/api/src/routes/restaurant-qr-public.routes.ts"
 "apps/api/src/scripts/delibocados-qr-pilot-table.ts"
 "apps/dashboard/src/app/api/delibocados-qr/[action]/route.ts"
 "apps/dashboard/src/components/restaurant-os/native-qr.tsx"
 "apps/dashboard/src/app/qr-pedido/page.tsx"
 "apps/dashboard/src/components/restaurant-os/native-menu.tsx"
 "apps/dashboard/next.config.mjs"
 "apps/dashboard/package.json"
)
[[ "$MODE" == "--check" || "$MODE" == "--apply" ]] || {
 echo "USO: bash $0 --check|--apply"; exit 2;
}
cd "$ROOT"
for bin in git pnpm node pm2 curl; do
 command -v "$bin" >/dev/null || { echo "BLOQUEADO: falta $bin"; exit 1; }
done
for proc in neuromind-api delibocados-whatsapp-next; do
 pm2 describe "$proc" >/dev/null 2>&1 || {
   echo "BLOQUEADO: falta proceso PM2 $proc"; exit 1;
 }
done
for file in "${FILES[@]}"; do
 if [[ ! -f "$file" ]] && git cat-file -e "HEAD:$file" 2>/dev/null; then
   echo "BLOQUEADO: se elimino localmente el archivo controlado $file"; exit 1
 fi
done
[[ -f apps/dashboard/.next-delibocados/BUILD_ID ]] || {
 echo "BLOQUEADO: no existe build Delibocados actual para rollback"; exit 1;
}
git fetch origin "$BRANCH"
for file in "${FILES[@]}"; do
 git cat-file -e "FETCH_HEAD:$file" || { echo "BLOQUEADO: falta $file en rama"; exit 1; }
done
# Generate conflict-free candidates, preserving edits in the VPS working tree.
MERGE_TMP="$(mktemp -d /tmp/delibocados-qr-merge-XXXXXXXX)"
chmod 700 "$MERGE_TMP"
cleanup() { rm -rf "$MERGE_TMP"; }
trap cleanup EXIT
for file in "${FILES[@]}"; do
 mkdir -p "$MERGE_TMP/$(dirname "$file")"
 proposed="$MERGE_TMP/$file"
 if [[ ! -f "$file" ]]; then
   git show "FETCH_HEAD:$file" > "$proposed"
 elif ! git cat-file -e "HEAD:$file" 2>/dev/null; then
   echo "BLOQUEADO: existe un archivo local no versionado $file"; exit 1
 elif git diff --quiet HEAD -- "$file"; then
   git show "FETCH_HEAD:$file" > "$proposed"
 else
   git show "HEAD:$file" > "$MERGE_TMP/base.txt"
   git show "FETCH_HEAD:$file" > "$MERGE_TMP/incoming.txt"
   if ! git merge-file --diff3 --stdout "$file" "$MERGE_TMP/base.txt" "$MERGE_TMP/incoming.txt" > "$proposed"; then
     echo "BLOQUEADO: conflicto al fusionar $file"
     echo "No se modifico el proyecto. Revisar la version local antes de continuar."
     exit 1
   fi
   echo "MERGE OK: se conservan cambios locales de $file"
 fi
done
echo "PRECHECK OK: no se tocara Nginx, PostgreSQL, pagos ni POS360."
echo "PRECHECK OK: el checkout publico NO se activara."
if [[ "$MODE" == "--check" ]]; then exit 0; fi
[[ "$(id -u)" == 0 ]] || { echo "BLOQUEADO: requiere root"; exit 1; }
install -d -m 700 /root/backups
BACKUP="$(mktemp -d /root/backups/delibocados-qr-panel-XXXXXXXX)"
chmod 700 "$BACKUP"
for file in "${FILES[@]}"; do
 mkdir -p "$BACKUP/$(dirname "$file")"
 if [[ -f "$file" ]]; then cp -a "$file" "$BACKUP/$file"; fi
done
[[ ! -f pnpm-lock.yaml ]] || cp -a pnpm-lock.yaml "$BACKUP/pnpm-lock.yaml"
OLD_BUILD="$ROOT/apps/dashboard/.next-delibocados"
NEW_BUILD="$ROOT/apps/dashboard/.next-delibocados-candidate"
CANARY_PID=""
SWITCHED_API=0
SWITCHED_NEXT=0
stop_canary(){
 if [[ -n "$CANARY_PID" ]]; then
   kill "$CANARY_PID" >/dev/null 2>&1 || true
   wait "$CANARY_PID" >/dev/null 2>&1 || true
   CANARY_PID=""
 fi
}
rollback(){
 stop_canary
 echo "ERROR: restaurando codigo y build del panel QR"
 for file in "${FILES[@]}"; do
   if [[ -f "$BACKUP/$file" ]]; then cp -a "$BACKUP/$file" "$file"; else rm -f "$file"; fi
 done
 if [[ -f "$BACKUP/pnpm-lock.yaml" ]]; then
   cp -a "$BACKUP/pnpm-lock.yaml" pnpm-lock.yaml
 fi
 # Restore old build selection; candidate directory remains separate.
 if [[ "$SWITCHED_API" == 1 ]]; then
   DELIBOCADOS_QR_MENU_PREVIEW_ENABLED=0 DELIBOCADOS_QR_CHECKOUT_ENABLED=0 \
     pm2 restart neuromind-api --update-env >/dev/null 2>&1 || true
 fi
 if [[ "$SWITCHED_NEXT" == 1 ]]; then
   DELIBOCADOS_STAGING_BUILD=0 DELIBOCADOS_BUILD=1 \
   NEXT_PUBLIC_PANEL_INSTANCE=delibocados \
   DELIBOCADOS_QR_MENU_PREVIEW_ENABLED=0 DELIBOCADOS_QR_CHECKOUT_ENABLED=0 \
     pm2 restart delibocados-whatsapp-next --update-env >/dev/null 2>&1 || true
 fi
 pnpm install --no-frozen-lockfile >/dev/null 2>&1 || true
 echo "ROLLBACK intentado. Respaldo: $BACKUP"
}
trap rollback ERR
for file in "${FILES[@]}"; do
 cp "$MERGE_TMP/$file" "$file"
done
pnpm install --no-frozen-lockfile
pnpm --filter @ventas/api typecheck
pnpm --filter @ventas/dashboard typecheck

# Query only Mesa 6's nonsecret UUID; never print QR tokens or hashes.
PILOT_OUTPUT="$(pnpm --filter @ventas/api exec tsx src/scripts/delibocados-qr-pilot-table.ts)"
PILOT_ID="$(printf '%s\n' "$PILOT_OUTPUT" | sed -n 's/^DELIBOCADOS_PILOT_TABLE=//p' | tail -n 1)"
if [[ ! "$PILOT_ID" =~ ^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$ ]]; then
  echo "BLOQUEADO: UUID de Mesa 6 no disponible"; false
fi
# Refuse to overwrite a preexisting live ordering configuration.
node <<'JS'
const {execFileSync}=require("node:child_process");
const apps=JSON.parse(execFileSync("pm2",["jlist"],{encoding:"utf8",maxBuffer:20000000}));
for (const name of ["neuromind-api","delibocados-whatsapp-next"]) {
  const app=apps.find(x=>x.name===name);
  if(!app)throw Error("FALTA_PROCESO_"+name);
  if(String(app.pm2_env?.DELIBOCADOS_QR_CHECKOUT_ENABLED||"") === "1") {
    console.error("BLOQUEADO: "+name+" tiene pedidos QR activos; no reemplazar flags");
    process.exitCode=2;
  }
  if(name==="delibocados-whatsapp-next" && String(app.pm2_env?.DELIBOCADOS_STAGING_BUILD||"") === "1") {
    console.error("BLOQUEADO: la carpeta candidata parece estar en uso; no sobrescribirla");
    process.exitCode=2;
  }
}
JS

rm -rf "$NEW_BUILD"
DELIBOCADOS_BUILD=1 NEXT_PUBLIC_PANEL_INSTANCE=delibocados DELIBOCADOS_STAGING_BUILD=1 \
  pnpm --filter @ventas/dashboard exec next build
[[ -f "$NEW_BUILD/BUILD_ID" ]] || {
  echo "BLOQUEADO: Next no genero BUILD_ID candidato"; false;
}
# Do not rename Next 16 Turbopack builds: compiled dynamic-route references
# can depend on the build directory. Start a canary from candidate in place.
(
 cd "$ROOT/apps/dashboard"
 exec env DELIBOCADOS_BUILD=1 NEXT_PUBLIC_PANEL_INSTANCE=delibocados \
   DELIBOCADOS_STAGING_BUILD=1 DELIBOCADOS_QR_MENU_PREVIEW_ENABLED=1 \
   DELIBOCADOS_QR_CHECKOUT_ENABLED=0 \
   node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3799
) >"$BACKUP/canary-next.log" 2>&1 &
CANARY_PID=$!
READY=0
for n in $(seq 1 20); do
 if ! kill -0 "$CANARY_PID" 2>/dev/null; then
   echo "BLOQUEADO: Next candidato termino antes de responder"; false
 fi
 CODE="$(curl --noproxy '*' -s -o /dev/null -w '%{http_code}' \
   --max-time 3 http://127.0.0.1:3799/qr-pedido || true)"
 if [[ "$CODE" == 200 ]]; then READY=1; break; fi
 sleep 1
done
if [[ "$READY" != 1 ]]; then
 echo "BLOQUEADO: candidato no responde /qr-pedido"; false
fi
# Exercise dynamic handler on canary without placing orders.
CANARY_HTTP="$(curl --noproxy '*' -sS \
 -o "$BACKUP/qr-canary-order.json" -w '%{http_code}' --max-time 10 \
 -H 'Origin: https://panel.delibocados.online' \
 -H 'Content-Type: application/json' --data '{}' \
 http://127.0.0.1:3799/api/delibocados-qr/order)"
CANARY_ERROR="$(node -e 'const fs=require("fs");try{const v=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(String(v.error||""))}catch{process.stdout.write("NON_JSON")}' "$BACKUP/qr-canary-order.json")"
echo "NEXT CANDIDATO /api/delibocados-qr/order => $CANARY_HTTP $CANARY_ERROR"
[[ "$CANARY_HTTP" == 503 && "$CANARY_ERROR" == QR_CHECKOUT_NOT_ENABLED ]] || {
 echo "BLOQUEADO: el handler QR dinamico del Next candidato falla"; false
}
stop_canary
# Preview only for the photographed Mesa 6 QR. Never activate orders.
SWITCHED_API=1
DELIBOCADOS_QR_MENU_PREVIEW_ENABLED=1 \
DELIBOCADOS_QR_PILOT_TABLE_ID="$PILOT_ID" \
DELIBOCADOS_QR_CHECKOUT_ENABLED=0 \
pm2 restart neuromind-api --update-env

# Keep compiled candidate IN PLACE; leave the old build available for rollback.
SWITCHED_NEXT=1
DELIBOCADOS_STAGING_BUILD=1 \
DELIBOCADOS_BUILD=1 \
DELIBOCADOS_QR_MENU_PREVIEW_ENABLED=1 \
DELIBOCADOS_QR_CHECKOUT_ENABLED=0 \
NEXT_PUBLIC_PANEL_INSTANCE=delibocados \
pm2 restart delibocados-whatsapp-next --update-env
sleep 5
API_HTTP="$(curl --noproxy '*' -s -o /dev/null -w '%{http_code}' \
  --max-time 10 http://127.0.0.1:4000/admin/restaurant-ops/qr/secure-tables)"
PANEL_HTTP="$(curl --noproxy '*' -s -o /dev/null -w '%{http_code}' \
  --max-time 10 http://127.0.0.1:3700/panel/qr)"
CUSTOMER_HTTP="$(curl --noproxy '*' -s -o /dev/null -w '%{http_code}' \
  --max-time 10 http://127.0.0.1:3700/qr-pedido)"
echo "API admin anonima => $API_HTTP (esperado 401/403)"
echo "Panel QR => $PANEL_HTTP (puede redirigir a login)"
echo "Pagina del cliente => $CUSTOMER_HTTP"

# Prove the public Next -> API route works for Mesa 6, using an INVALID token.
# A 404 QR_NOT_AVAILABLE confirms origin, preview, pilot and DB lookup worked.
# POST /order must remain disabled (503). This creates NO orders.
DUMMY_BODY="$(printf '{"kind":"table","tableId":"%s","token":"00000000000000000000000000000000"}' "$PILOT_ID")"
CONTEXT_HTTP="$(curl --noproxy '*' -sS -o "$BACKUP/qr-context-test.json" -w '%{http_code}' \
  --max-time 15 --resolve panel.delibocados.online:443:127.0.0.1 \
  -H 'Content-Type: application/json' -H 'Origin: https://panel.delibocados.online' \
  --data "$DUMMY_BODY" https://panel.delibocados.online/api/delibocados-qr/context)"
CONTEXT_ERROR="$(node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(String(j.error||""));' "$BACKUP/qr-context-test.json")"
ORDER_HTTP="$(curl --noproxy '*' -sS -o "$BACKUP/qr-order-test.json" -w '%{http_code}' \
  --max-time 15 --resolve panel.delibocados.online:443:127.0.0.1 \
  -H 'Content-Type: application/json' -H 'Origin: https://panel.delibocados.online' \
  --data '{}' https://panel.delibocados.online/api/delibocados-qr/order)"
ORDER_ERROR="$(node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(String(j.error||""));' "$BACKUP/qr-order-test.json")"
echo "Contexto QR Mesa 6 con token falso => $CONTEXT_HTTP $CONTEXT_ERROR (esperado 404 QR_NOT_AVAILABLE)"
echo "Pedidos QR desactivados => $ORDER_HTTP $ORDER_ERROR (esperado 503 QR_CHECKOUT_NOT_ENABLED)"
[[ "$CONTEXT_HTTP" == 404 && "$CONTEXT_ERROR" == QR_NOT_AVAILABLE ]] || false
[[ "$ORDER_HTTP" == 503 && "$ORDER_ERROR" == QR_CHECKOUT_NOT_ENABLED ]] || false

[[ "$API_HTTP" == 401 || "$API_HTTP" == 403 ]] || false
[[ "$PANEL_HTTP" =~ ^(200|301|302|303|307|308|401|403)$ ]] || false
[[ "$CUSTOMER_HTTP" =~ ^(200|301|302|303|307|308)$ ]] || false
trap - ERR
echo "INSTALADO: panel QR seguro y emision privada de enlaces."
echo "MODO PREVIEW: Mesa 6 puede abrir el menu por QR. Solo lectura; sin pedidos, SmartPOS ni impresion."
echo "RESPALDO: $BACKUP"
