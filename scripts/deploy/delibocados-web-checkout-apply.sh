#!/usr/bin/env bash
# Delibocados: deploy server-validated public menu checkout to production.
# Touches ONLY: API QR route source, existing cafe menu HTML, neuromind-api env.
# Does not alter Nginx, QR tokens, payment records, POS360 or print services.
set -euo pipefail
cd /var/www/control

API_SRC="apps/api/src/routes/restaurant-qr-public.routes.ts"
MENU="/var/www/delibocados-public/carta.html"
NGINX="/etc/nginx/conf.d/delibocados-online.conf"
MODE="${1:---check}"
STAGED_API="${2:-/tmp/delibocados-menu-checkout-route.ts}"
STAGED_JS="${3:-/tmp/delibocados-menu-checkout.js}"
if [[ "$MODE" != "--check" && "$MODE" != "--apply" ]]; then
  echo "Uso: $0 --check|--apply [staged-api] [staged-js]"
  exit 2
fi
for f in "$API_SRC" "$MENU" "$NGINX" "$STAGED_API" "$STAGED_JS"; do
  [[ -s "$f" ]] || { echo "BLOQUEADO: falta $f";exit 1; }
done
command -v node >/dev/null
command -v pnpm >/dev/null
command -v pm2 >/dev/null
node --check "$STAGED_JS"
python3 - "$API_SRC" "$MENU" "$NGINX" "$STAGED_API" "$STAGED_JS" <<'PY'
import pathlib,re,sys
old,html,conf,api,js=[pathlib.Path(p).read_text(encoding="utf-8") for p in sys.argv[1:]]
assert "restaurantQrPublicRoutes.post" in old, "Ruta backend anterior no reconocida"
assert 'DELIBOCADOS_WEB_CHECKOUT_ENABLED' in api, "Falta flag seguro en nueva API"
assert 'p_source:"web"' in api, "Falta RPC de pedidos"
assert 'quoteVerifiedDeliveryAddress' in api, "Falta validacion de domicilio"
assert 'button.disabled = ' in js, "Falta control del boton"
assert '</script' not in js.lower(), "El JavaScript tiene cierre inseguro"
assert len(re.findall(r'</body\s*>',html,re.I))==1, "Menu HTML incompatible"
assert 'disabled-submit' in html, "No se encontro boton de checkout"
for route in ["/public/delibocados-qr/context","/public/delibocados-qr/order"]:
  assert "location = "+route+" {" in conf, "Falta ruta Nginx "+route
print("CHECK OK: menu cafe, boton, catalogo, API y rutas existentes")
PY

if [[ "$MODE" == "--check" ]]; then
  echo "Sin cambios. Para instalar: --apply"
  exit 0
fi
[[ "$(id -u)" == "0" ]] || { echo "Requiere root";exit 1; }
# Refuse to overwrite local API edits not committed anywhere.
if ! git diff --quiet -- "$API_SRC"; then
  echo "BLOQUEADO: hay cambios locales sin guardar en el codigo API"
  exit 1
fi

BACKUP="/root/backups/delibocados-web-checkout-$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 700 "$BACKUP"
cp -a "$API_SRC" "$BACKUP/restaurant-qr-public.routes.ts"
cp -a "$MENU" "$BACKUP/carta.html"
API_RESTARTED=0

rollback() {
  echo "ERROR: restaurando HTML y codigo API"
  cp -a "$BACKUP/restaurant-qr-public.routes.ts" "$API_SRC"
  cp -a "$BACKUP/carta.html" "$MENU"
  if [[ "$API_RESTARTED" == "1" ]]; then
    DELIBOCADOS_WEB_CHECKOUT_ENABLED=0 pm2 restart neuromind-api --update-env || true
  fi
}
trap rollback ERR

cp -a "$STAGED_API" "$API_SRC"
echo "=== TypeScript API ==="
pnpm --filter @ventas/api typecheck

python3 - "$MENU" "$STAGED_JS" <<'PY'
import pathlib,re,sys
p=pathlib.Path(sys.argv[1])
js=pathlib.Path(sys.argv[2]).read_text(encoding="utf-8")
html=p.read_text(encoding="utf-8")
# Previous pilot adapter is obsolete and would otherwise register another handler.
html=re.sub(r'(?is)<script\s+id=["\x27]delibocados-qr-checkout-adapter["\x27]\s*>.*?</script>\s*',
            '',html)
html=re.sub(r'(?is)<script\s+id=["\x27]delibocados-menu-live-checkout["\x27]\s*>.*?</script>\s*',
            '',html)
marker='<script id="delibocados-menu-live-checkout">\n'+js+'\n</script>\n'
html=re.sub(r'(?i)</body\s*>',lambda m:marker+m.group(0),html,count=1)
assert html.count('id="delibocados-menu-live-checkout"')==1
p.write_text(html,encoding="utf-8")
PY

echo "=== Reiniciando solo neuromind-api ==="
DELIBOCADOS_WEB_CHECKOUT_ENABLED=1 pm2 restart neuromind-api --update-env
API_RESTARTED=1

echo "=== Esperando disponibilidad REAL de neuromind-api ==="
# A PM2 "online" means the process was spawned, NOT that port 4000 is ready.
# Do not fail the entire deploy on the first connection-refused.
RESPONSE_FILE="$(mktemp /tmp/delibocados-web-checkout-XXXXXXXX.json)"
ready=0
LAST_HTTP="000"
for attempt in $(seq 1 30); do
  LAST_HTTP="$(curl --noproxy '*' --silent --output "$RESPONSE_FILE" --write-out '%{http_code}' \
    --connect-timeout 2 --max-time 6 \
    -H 'Content-Type: application/json' -d '{"kind":"pickup"}' \
    http://127.0.0.1:4000/public/delibocados-qr/context || true)"
  if [[ "$LAST_HTTP" == "200" ]] && python3 - "$RESPONSE_FILE" <<'PY'
import json,sys
try:
  d=json.load(open(sys.argv[1]))
  assert d.get("ok") is True
  assert isinstance(d.get("revision"),int) and d["revision"]>0
  assert isinstance(d.get("products"),list) and len(d["products"])>0
except Exception:
  sys.exit(1)
PY
  then
    ready=1
    break
  fi
  sleep 2
done
if [[ "$ready" != "1" ]]; then
  echo "API NO PREPARADA: ultimo HTTP $LAST_HTTP despues de 30 intentos"
  echo "Puerto TCP 4000:"
  ss -lntp | grep ':4000 ' || true
  echo "Bloqueado para evitar publicar checkout inestable"
  false
fi
python3 - "$RESPONSE_FILE" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
print("CATALOGO INTERNO: OK",
      "productos:",len(d["products"]),"revision:",d["revision"])
PY
rm -f "$RESPONSE_FILE"
echo "=== Smoke test HTTPS sin crear pedidos ==="

curl --noproxy '*' --silent --show-error --fail --max-time 20 \
  --resolve delibocados.online:443:127.0.0.1 \
  -H 'Content-Type: application/json' \
  -d '{"kind":"pickup"}' \
  https://delibocados.online/public/delibocados-qr/context |
python3 -c '
import json,sys
d=json.load(sys.stdin)
ok=d.get("ok")==True and isinstance(d.get("products"),list) and len(d["products"])>0
print("CATALOGO PUBLICO:", "OK" if ok else "ERROR")
sys.exit(0 if ok else 1)
'

curl --noproxy '*' --silent --show-error --fail --max-time 20 \
  --resolve delibocados.online:443:127.0.0.1 \
  https://delibocados.online/menu |
python3 -c '
import sys
s=sys.stdin.buffer.read()
ok=b"id=\x22delibocados-menu-live-checkout\x22" in s and b"disabled-submit" in s
print("MENU CAFE CON CHECKOUT:", "OK" if ok else "ERROR")
sys.exit(0 if ok else 1)
'

# Reject invalid pickup input: no real order can be created from this shape.
INVALID="$(curl --noproxy '*' --silent --show-error -o /dev/null -w '%{http_code}' \
  --max-time 10 -H 'Content-Type: application/json' -d '{"kind":"pickup"}' \
  http://127.0.0.1:4000/public/delibocados-qr/order)"
echo "PEDIDO INVALIDO RECHAZADO: HTTP $INVALID"
[[ "$INVALID" == "400" ]] || { echo "BLOQUEADO: error de validacion inesperado";false; }

trap - ERR
echo "INSTALACION CORRECTA: menu conectado con pedidos web reales para retiro."
echo "Domicilio solo si Google Maps y zonas estan verificadas."
echo "Mesa solo si hay QR seguro validado por la API."
echo "No se envio ningun pedido de prueba."
echo "NO CONECTADO A SMARTPOS NI IMPRESORA."
echo "RESPALDOS: $BACKUP"
