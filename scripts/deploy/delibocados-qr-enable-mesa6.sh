#!/usr/bin/env bash
# Controlled real-order pilot: Mesa 6 only, after QR token rotation.
# Does not create test orders, charge a card, trigger POS360 or print.
set -euo pipefail
MODE="${1:---check}"
ROOT="/var/www/control"
STAMP="/root/.delibocados-qr-menu-v2-installed-utc"
[[ "$MODE" == "--check" || "$MODE" == "--apply" ]] || {
 echo "USO: bash $0 --check|--apply"; exit 2;
}
cd "$ROOT"
[[ -f "$STAMP" ]] || { echo "BLOQUEADO: menu v2 no desplegado"; exit 1; }
[[ "$(id -u)" == 0 ]] || { echo "BLOQUEADO: se requiere root"; exit 1; }
for tool in pnpm node pm2 curl; do command -v "$tool" >/dev/null; done
PREVIOUS="$(cat "$STAMP")"
export DELIBOCADOS_QR_REQUIRE_ROTATION_AFTER="$PREVIOUS"
PREFLIGHT="$(pnpm --filter @ventas/api exec tsx src/scripts/delibocados-qr-order-preflight.ts)"
printf '%s\n' "$PREFLIGHT" | grep -E 'QR_PREFLIGHT_OK|MENU_REVISION|VERIFIED_PRODUCTS' || true
ID="$(printf '%s\n' "$PREFLIGHT" | sed -n 's/^PILOT_TABLE_ID=//p' | tail -1)"
REVISION="$(printf '%s\n' "$PREFLIGHT" | sed -n 's/^MENU_REVISION=//p' | tail -1)"
[[ "$ID" =~ ^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$ ]] || {
 echo "BLOQUEADO: UUID Mesa 6 incorrecto"; exit 1;
}
[[ "$REVISION" =~ ^[0-9]+$ ]] || { echo "BLOQUEADO: revision de menu incorrecta"; exit 1; }
node <<'JS'
const {execFileSync}=require("node:child_process");
const apps=JSON.parse(execFileSync("pm2",["jlist"],{encoding:"utf8",maxBuffer:25000000}));
const api=apps.find(x=>x.name==="neuromind-api");
const next=apps.find(x=>x.name==="delibocados-whatsapp-next");
if(!api || !next || api.pm2_env?.status!=="online" ||
 next.pm2_env?.status!=="online" ||
 next.pm2_env?.DELIBOCADOS_RELEASE_SLOT!=="menu-v2" ||
 String(api.pm2_env?.DELIBOCADOS_QR_CHECKOUT_ENABLED||"0")!=="0" ||
 String(next.pm2_env?.DELIBOCADOS_QR_CHECKOUT_ENABLED||"0")!=="0"){
 console.error("BLOQUEADO: procesos no coinciden con menu v2 preview seguro");
 process.exitCode=2;
}
JS
echo "PRECHECK OK: QR de Mesa 6 fue renovado despues del despliegue"
echo "PRECHECK OK: menu/RPC validados, otros 15 QR no pueden registrar pedidos"
if [[ "$MODE" == "--check" ]]; then exit 0; fi
rollback(){
 echo "FALLO: apagando el checkout real y volviendo a vista previa"
 DELIBOCADOS_QR_MENU_PREVIEW_ENABLED=1 DELIBOCADOS_QR_PILOT_TABLE_ID="$ID" \
 DELIBOCADOS_QR_CHECKOUT_ENABLED=0 \
 pm2 restart neuromind-api --update-env >/dev/null 2>&1 || true
 DELIBOCADOS_RELEASE_SLOT=menu-v2 DELIBOCADOS_BUILD=1 \
 NEXT_PUBLIC_PANEL_INSTANCE=delibocados DELIBOCADOS_QR_MENU_PREVIEW_ENABLED=1 \
 DELIBOCADOS_QR_CHECKOUT_ENABLED=0 \
 pm2 restart delibocados-whatsapp-next --update-env >/dev/null 2>&1 || true
}
trap rollback ERR
# Real orders are limited to the verified Mesa 6 UUID, independent of labels.
DELIBOCADOS_QR_PILOT_TABLE_ID="$ID" DELIBOCADOS_QR_MENU_PREVIEW_ENABLED=1 \
DELIBOCADOS_QR_CHECKOUT_ENABLED=1 \
pm2 restart neuromind-api --update-env
DELIBOCADOS_RELEASE_SLOT=menu-v2 DELIBOCADOS_BUILD=1 \
NEXT_PUBLIC_PANEL_INSTANCE=delibocados DELIBOCADOS_QR_MENU_PREVIEW_ENABLED=1 \
DELIBOCADOS_QR_CHECKOUT_ENABLED=1 \
pm2 restart delibocados-whatsapp-next --update-env
sleep 4

# Both probes carry a FAKE token, never the actual QR. They must be
# rejected before any order or kitchen ticket is created.
FAKE="$(node -e 'process.stdout.write(require("crypto").randomUUID())')"
BODY="$(printf '{"kind":"table","tableId":"%s","token":"%s","sourceKey":"%s","customerName":"Prueba sin escritura","customerPhone":"570000000000","expectedMenuRevision":%s,"items":[{"productId":"producto-inexistente","quantity":1,"instructions":""}],"paymentMethod":"cash","customerNote":"","customerConfirmed":true}' \
 "$ID" "000000000000000000000000000000000000000000000000" "$FAKE" "$REVISION")"
for action in context order; do
 if [[ "$action" == context ]]; then
   REQUEST="$(printf '{"kind":"table","tableId":"%s","token":"000000000000000000000000000000000000000000000000"}' "$ID")"
 else
   REQUEST="$BODY"
 fi
 RESPONSE="$(curl --noproxy '*' --silent --show-error --max-time 15 \
   -w '\n%{http_code}' --resolve panel.delibocados.online:443:127.0.0.1 \
   -H 'Origin: https://panel.delibocados.online' \
   -H 'Content-Type: application/json' --data "$REQUEST" \
   "https://panel.delibocados.online/api/delibocados-qr/$action")"
 CODE="$(printf '%s\n' "$RESPONSE" | tail -1)"
 ERROR="$(printf '%s\n' "$RESPONSE" | sed '$d' | node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{try{process.stdout.write(String(JSON.parse(s).error||""))}catch{process.stdout.write("NON_JSON")}})')"
 echo "Mesa 6 token falso /$action => HTTP $CODE $ERROR"
 [[ "$CODE" == 404 && "$ERROR" == QR_NOT_AVAILABLE ]] || false
done
# Another table may VIEW the catalogue with its own valid QR, but
# cannot place ORDERS while the pilot allowlist is Mesa 6 only.
OTHERS="$(curl --noproxy '*' --silent --show-error --max-time 15 \
 -o /dev/null -w '%{http_code}' \
 --resolve panel.delibocados.online:443:127.0.0.1 \
 -H 'Origin: https://panel.delibocados.online' \
 -H 'Content-Type: application/json' \
 --data '{"kind":"table","tableId":"00000000-0000-4000-8000-000000000000","token":"00000000000000000000000000000000","sourceKey":"00000000-0000-4000-8000-000000000000","customerName":"Prueba","customerPhone":"570000000000","expectedMenuRevision":1,"items":[{"productId":"inexistente","quantity":1}],"paymentMethod":"cash","customerConfirmed":true}' \
 https://panel.delibocados.online/api/delibocados-qr/order)"
echo "Otra mesa /order => HTTP $OTHERS (esperado 503)"
[[ "$OTHERS" == 503 ]] || false
trap - ERR
echo "PILOTO ACTIVO: pedidos reales habilitados SOLO para Mesa 6"
echo "Destino: Neuromind, pedidos y ticket interno de cocina. POS360/impresion no verificados."
echo "La primera orden real debe confirmarse desde el panel administrativo de pedidos/cocina."
