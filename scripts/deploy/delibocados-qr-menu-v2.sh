#!/usr/bin/env bash
# Delibocados customer QR menu v2; blue/green Next build + API map.
# Read-only checkout preview; explicit activation is a SEPARATE step.
set -euo pipefail
MODE="${1:---check}"
ROOT="/var/www/control"
BRANCH="fix/delibocados-qr-panel-real-20261113"
FILES=(
 # Deliberately exclude restaurant-ops.routes.ts / RestaurantOpsClient.tsx:
 # those files have independent, live local changes; this release only needs
 # the customer menu and public QR API. Staff table labels ship separately.
 "apps/api/src/routes/restaurant-qr-public.routes.ts"
 "apps/api/src/scripts/delibocados-qr-order-preflight.ts"
 "apps/dashboard/src/app/qr-pedido/page.tsx"
 "apps/dashboard/src/app/qr-pedido/page.module.css"
 "apps/dashboard/next.config.mjs"
)
[[ "$MODE" == "--check" || "$MODE" == "--apply" ]] || {
  echo "Uso: bash $0 --check|--apply"; exit 2;
}
cd "$ROOT"
for tool in git node pnpm pm2 curl; do
  command -v "$tool" >/dev/null || { echo "BLOQUEADO: falta $tool"; exit 1; }
done
git fetch origin "$BRANCH"
for name in neuromind-api delibocados-whatsapp-next; do
 pm2 describe "$name" >/dev/null 2>&1 || { echo "BLOQUEADO: falta $name"; exit 1; }
done
# Do not build into an active Next directory or change an already-active
# checkout without explicit human inspection.
node <<'JS'
const {execFileSync}=require("node:child_process");
const apps=JSON.parse(execFileSync("pm2",["jlist"],{encoding:"utf8",maxBuffer:25000000}));
for(const name of ["neuromind-api","delibocados-whatsapp-next"]){
 const x=apps.find(p=>p.name===name);
 if(!x||x.pm2_env?.status!=="online"||
    String(x.pm2_env?.DELIBOCADOS_QR_CHECKOUT_ENABLED||"0")==="1")
   throw Error("BLOQUEADO: API/Next no disponible o pedidos QR ya activos: "+name);
 if(name==="delibocados-whatsapp-next"){
   if(x.pm2_env?.DELIBOCADOS_RELEASE_SLOT==="menu-v2")
     throw Error("BLOQUEADO: la version menu-v2 ya esta activa");
   if(String(x.pm2_env?.DELIBOCADOS_STAGING_BUILD||"")!=="1")
     throw Error("BLOQUEADO: Next activo no usa slot preview esperado");
 }
}
JS
# SHA-1 hashes of the exact reviewed v1 QR preview deployed earlier.
# Replace only when the local file is byte-for-byte that known baseline.
# Any other local changes still go through a conservative three-way merge.
declare -A KNOWN_PREVIEW=(
 ["apps/api/src/routes/restaurant-qr-public.routes.ts"]="e13881fa7efd5d72aa33a55fac4038942105b757"
 ["apps/dashboard/src/app/qr-pedido/page.tsx"]="fd7dea20dd01ce4ca6b90f664cb200fa859e74dd"
 ["apps/dashboard/src/app/qr-pedido/page.module.css"]="67ef40bf3dd58c2432032b6860f1b1f6cdc1b82d"
 ["apps/dashboard/next.config.mjs"]="57ee34fae75f3efa9e98173fce593dc548172b26"
)
MERGE="$(mktemp -d /tmp/deli-qr-menu-v2-XXXXXXXX)"
chmod 700 "$MERGE"
# Surgical optional API transformation: retain any unrelated changes in
# restaurant-qr-public.routes.ts instead of forcing a whole-file Git merge.
git show "FETCH_HEAD:scripts/deploy/delibocados-qr-public-menu-v2-transform.py" > "$MERGE/transform.py"
git show "FETCH_HEAD:apps/api/src/routes/restaurant-qr-public.routes.ts" > "$MERGE/qr-desired.ts"
CANARY_PID=""
cleanup(){
 if [[ -n "$CANARY_PID" ]]; then
   kill "$CANARY_PID" >/dev/null 2>&1 || true
   wait "$CANARY_PID" >/dev/null 2>&1 || true
 fi
 rm -rf "$MERGE"
}
trap cleanup EXIT
for f in "${FILES[@]}"; do
 git cat-file -e "FETCH_HEAD:$f" || { echo "BLOQUEADO: falta $f"; exit 1; }
 mkdir -p "$MERGE/$(dirname "$f")"
 if [[ "$f" == "apps/api/src/routes/restaurant-qr-public.routes.ts" ]]; then
   if python3 "$MERGE/transform.py" "$f" "$MERGE/qr-desired.ts" "$MERGE/$f"; then
     echo "QR API: catalogo enriquecido sin reemplazar cambios locales"
   else
     cp -a "$f" "$MERGE/$f"
     echo "AVISO: se mantiene backend QR original; el menu y carrito si se actualizan"
   fi
 elif [[ ! -f "$f" ]]; then
   if git cat-file -e "HEAD:$f" 2>/dev/null; then
     echo "BLOQUEADO: se elimino $f localmente"; exit 1
   fi
   git show "FETCH_HEAD:$f" > "$MERGE/$f"
 elif [[ -n "${KNOWN_PREVIEW[$f]:-}" &&
          "$(git hash-object "$f")" == "${KNOWN_PREVIEW[$f]}" ]]; then
   git show "FETCH_HEAD:$f" > "$MERGE/$f"
   echo "ACTUALIZACION SEGURA: version v1 exacta reconocida: $f"
 elif git diff --quiet HEAD -- "$f"; then
   git show "FETCH_HEAD:$f" > "$MERGE/$f"
 else
   git show "HEAD:$f" > "$MERGE/base"
   git show "FETCH_HEAD:$f" > "$MERGE/theirs"
   if ! git merge-file --diff3 --stdout "$f" "$MERGE/base" "$MERGE/theirs" > "$MERGE/$f"; then
     echo "BLOQUEADO: conflicto real de Git en $f"; exit 1
   fi
   echo "MERGE OK: cambios locales conservados: $f"
 fi
done
echo "PRECHECK OK: nuevo menu/imagenes/carrito, despliegue en slot independiente"
echo "PRECHECK OK: pedidos QR seguiran DESACTIVADOS; sin POS360, Toteat o impresion"
if [[ "$MODE" == "--check" ]]; then exit 0; fi
[[ "$(id -u)" == 0 ]] || { echo "BLOQUEADO: requiere root"; exit 1; }
install -d -m 700 /root/backups
BACKUP="$(mktemp -d /root/backups/delibocados-menu-v2-XXXXXXXX)"
chmod 700 "$BACKUP"
for f in "${FILES[@]}"; do
 mkdir -p "$BACKUP/$(dirname "$f")"
 if [[ -f "$f" ]]; then cp -a "$f" "$BACKUP/$f"; fi
done
SLOT="$ROOT/apps/dashboard/.next-delibocados-menu-v2"
NEXT_SWITCHED=0
API_SWITCHED=0
rollback(){
 echo "ERROR: recuperando version anterior sin tocar pedidos ni la base de datos"
 for f in "${FILES[@]}"; do
   if [[ -f "$BACKUP/$f" ]]; then cp -a "$BACKUP/$f" "$f"; else rm -f "$f"; fi
 done
 if [[ "$NEXT_SWITCHED" == 1 ]]; then
   DELIBOCADOS_RELEASE_SLOT="" DELIBOCADOS_BUILD=1 DELIBOCADOS_STAGING_BUILD=1 \
   NEXT_PUBLIC_PANEL_INSTANCE=delibocados DELIBOCADOS_QR_MENU_PREVIEW_ENABLED=1 \
   DELIBOCADOS_QR_CHECKOUT_ENABLED=0 \
   pm2 restart delibocados-whatsapp-next --update-env >/dev/null 2>&1 || true
 fi
 if [[ "$API_SWITCHED" == 1 ]]; then
   DELIBOCADOS_QR_CHECKOUT_ENABLED=0 DELIBOCADOS_QR_MENU_PREVIEW_ENABLED=1 \
   pm2 restart neuromind-api --update-env >/dev/null 2>&1 || true
 fi
 echo "RESPALDO: $BACKUP"
}
trap rollback ERR
for f in "${FILES[@]}"; do
 mkdir -p "$(dirname "$f")"
 cp "$MERGE/$f" "$f"
done
pnpm --filter @ventas/api typecheck
pnpm --filter @ventas/dashboard typecheck
# Read-only DB readiness, includes an intentionally rejected RPC invocation.
pnpm --filter @ventas/api exec tsx src/scripts/delibocados-qr-order-preflight.ts

[[ ! -e "$SLOT" ]] || {
 echo "BLOQUEADO: el slot menu-v2 ya existe y no se sobreescribira"; false;
}
DELIBOCADOS_BUILD=1 NEXT_PUBLIC_PANEL_INSTANCE=delibocados \
 DELIBOCADOS_RELEASE_SLOT=menu-v2 DELIBOCADOS_QR_MENU_PREVIEW_ENABLED=1 \
 DELIBOCADOS_QR_CHECKOUT_ENABLED=0 \
 pnpm --filter @ventas/dashboard exec next build
[[ -f "$SLOT/BUILD_ID" ]] || { echo "BLOQUEADO: build Next incompleto"; false; }
(
 cd "$ROOT/apps/dashboard"
 exec env DELIBOCADOS_BUILD=1 NEXT_PUBLIC_PANEL_INSTANCE=delibocados \
   DELIBOCADOS_RELEASE_SLOT=menu-v2 DELIBOCADOS_QR_MENU_PREVIEW_ENABLED=1 \
   DELIBOCADOS_QR_CHECKOUT_ENABLED=0 \
   node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3799
) > "$BACKUP/menu-canary.log" 2>&1 &
CANARY_PID=$!
READY=0
for n in $(seq 1 20); do
 if ! kill -0 "$CANARY_PID" 2>/dev/null; then
   echo "BLOQUEADO: se cerro el Next candidato"; false
 fi
 R="$(curl --noproxy '*' -s -o /dev/null -w '%{http_code}' \
     --max-time 2 http://127.0.0.1:3799/qr-pedido || true)"
 if [[ "$R" == 200 ]]; then READY=1; break; fi
 sleep 1
done
[[ "$READY" == 1 ]] || { echo "BLOQUEADO: Next candidato no responde"; false; }
CANARY="$(curl --noproxy '*' -sS -o "$BACKUP/qr-canary.json" -w '%{http_code}' \
 --max-time 10 -H 'Origin: https://panel.delibocados.online' \
 -H 'Content-Type: application/json' \
 --data '{}' http://127.0.0.1:3799/api/delibocados-qr/order)"
[[ "$CANARY" == 503 ]] || { echo "BLOQUEADO: Next candidato QR no protegido"; false; }
echo "CANARY OK: menu y rutas protegidas, sin pedidos"
kill "$CANARY_PID" >/dev/null 2>&1 || true
wait "$CANARY_PID" 2>/dev/null || true
CANARY_PID=""

API_SWITCHED=1
DELIBOCADOS_QR_MENU_PREVIEW_ENABLED=1 DELIBOCADOS_QR_CHECKOUT_ENABLED=0 \
 pm2 restart neuromind-api --update-env
NEXT_SWITCHED=1
DELIBOCADOS_BUILD=1 DELIBOCADOS_STAGING_BUILD=0 \
 DELIBOCADOS_RELEASE_SLOT=menu-v2 NEXT_PUBLIC_PANEL_INSTANCE=delibocados \
 DELIBOCADOS_QR_MENU_PREVIEW_ENABLED=1 DELIBOCADOS_QR_CHECKOUT_ENABLED=0 \
 pm2 restart delibocados-whatsapp-next --update-env
sleep 5
PAGE="$(curl --noproxy '*' -sS -o /dev/null -w '%{http_code}' \
 --max-time 15 --resolve panel.delibocados.online:443:127.0.0.1 \
 https://panel.delibocados.online/qr-pedido)"
ORDER="$(curl --noproxy '*' -sS -o "$BACKUP/qr-orders-disabled.json" \
 -w '%{http_code}' --max-time 15 \
 --resolve panel.delibocados.online:443:127.0.0.1 \
 -H 'Origin: https://panel.delibocados.online' \
 -H 'Content-Type: application/json' --data '{}' \
 https://panel.delibocados.online/api/delibocados-qr/order)"
ORDER_CODE="$(node -e 'const d=require(process.argv[1]);process.stdout.write(String(d.error||""))' "$BACKUP/qr-orders-disabled.json")"
echo "MENU HTTP $PAGE | PEDIDOS HTTP $ORDER $ORDER_CODE"
[[ "$PAGE" == 200 && "$ORDER" == 503 && "$ORDER_CODE" == QR_CHECKOUT_NOT_ENABLED ]] || false
trap - ERR
# Written only after successful deployment. The order-activation script
# requires Mesa 6 QR to be rotated AFTER this timestamp.
date -u +"%Y-%m-%dT%H:%M:%SZ" > /root/.delibocados-qr-menu-v2-installed-utc
chmod 600 /root/.delibocados-qr-menu-v2-installed-utc
echo "INSTALADO: carta v2 con categorias, fotos y carrito, en modo vista previa"
echo "NO ACTIVADOS: pedidos reales, SmartPOS, impresora, Toteat"
echo "RESPALDO: $BACKUP"
