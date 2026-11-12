#!/usr/bin/env bash
# Instala checkout QR dentro de carta.html usando las rutas API ya publicadas.
# No toca Nginx, no activa pedidos, no sincroniza POS ni imprime.
set -euo pipefail

HTML="/var/www/delibocados-public/carta.html"
CONF="/etc/nginx/conf.d/delibocados-online.conf"
SOURCE="/var/www/control/scripts/delibocados/qr-checkout.js"
MODE="${1:---check}"

if [[ "$MODE" != "--check" && "$MODE" != "--apply" ]]; then
  echo "Uso: bash scripts/delibocados/install-qr-checkout.sh [--check|--apply]"
  exit 2
fi

for file in "$HTML" "$CONF" "$SOURCE"; do
  [[ -f "$file" ]] || { echo "FALTA: $file"; exit 1; }
done

python3 - "$HTML" "$CONF" "$SOURCE" <<'PY'
import pathlib, re, sys
html = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
conf = pathlib.Path(sys.argv[2]).read_text(encoding='utf-8')
source = pathlib.Path(sys.argv[3]).read_text(encoding='utf-8')
assert len(re.findall(r'</body\s*>', html, re.I)) == 1, 'Cierre </body> no unico'
for route in ('/public/delibocados-qr/context', '/public/delibocados-qr/order'):
    assert ('location = ' + route + ' {') in conf, 'Falta endpoint existente ' + route
assert 'fetch("/public/delibocados-qr/" + path' in source, 'Fuente desactualizada: falta endpoint correcto'
assert '</script' not in source.lower(), 'El script no se puede insertar en HTML'
print('CHECK OK: carta y rutas publicas existentes')
PY

# Unauthorized/empty payload cannot create an order.
# Expect the feature flag (503), or the input validator (400), or a rate limit (429).
RESPONSE="$(curl -sS --max-time 15 \
  --resolve delibocados.online:443:127.0.0.1 \
  -H 'Content-Type: application/json' \
  -X POST --data '{}' \
  -w '\n%{http_code}' \
  https://delibocados.online/public/delibocados-qr/context)"
BODY="${RESPONSE%$'\n'*}"
HTTP="${RESPONSE##*$'\n'}"
python3 - "$BODY" "$HTTP" <<'PY'
import json, sys
try:
    body = json.loads(sys.argv[1])
except Exception:
    body = {}
http, err = sys.argv[2], body.get('error')
allowed = {('503', 'QR_CHECKOUT_NOT_ENABLED'),
           ('400', 'INVALID_INPUT'),
           ('429', 'QR_RATE_LIMIT')}
ok = (http, err) in allowed
print('API PUBLICA:', 'OK' if ok else 'ERROR', 'HTTP', http, 'CODIGO', err or 'SIN_JSON')
if not ok:
    raise SystemExit(1)
PY

if [[ "$MODE" == "--check" ]]; then
  echo "Solo verificacion. No se modifico ningun archivo."
  exit 0
fi
if [[ "$(id -u)" != "0" ]]; then echo "Requiere root"; exit 1; fi

BACKUP="/var/backups/delibocados-qr-checkout-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP"
chmod 700 "$BACKUP"
cp -a "$HTML" "$BACKUP/carta.html"

rollback() {
  echo "ERROR: restaurando HTML original..."
  cp -a "$BACKUP/carta.html" "$HTML"
}
trap rollback ERR

python3 - "$HTML" "$SOURCE" <<'PY'
import pathlib, re, sys
html_file, source_file = map(pathlib.Path, sys.argv[1:])
html = html_file.read_text(encoding='utf-8')
source = source_file.read_text(encoding='utf-8')
marker = '<script id="delibocados-qr-checkout-adapter">'
# Replace previous adapter if present; don't stack scripts.
block = marker + '\n' + source + '\n</script>'
existing = re.compile(re.escape(marker) + r'.*?</script>', re.S)
if existing.search(html):
    html, count = existing.subn(lambda _: block, html, count=1)
else:
    html = re.sub(r'(?i)</body\s*>',
                  lambda match: block + '\n' + match.group(0),
                  html, count=1)
html_file.write_text(html, encoding='utf-8')
PY

curl -fsS --max-time 15 \
  --resolve delibocados.online:443:127.0.0.1 \
  https://delibocados.online/menu | python3 -c '
import sys
page = sys.stdin.buffer.read()
ok = b"id=\"delibocados-qr-checkout-adapter\"" in page and b"/public/delibocados-qr/" in page
print("HTML MENU:", "OK" if ok else "ERROR")
sys.exit(0 if ok else 1)
'

trap - ERR
echo "INSTALADO: checkout QR preparado dentro de carta.html, sin tocar Nginx"
echo "RESPALDO: $BACKUP"
echo "PEDIDOS PUBLICOS: NO ACTIVADOS POR ESTE INSTALADOR"
