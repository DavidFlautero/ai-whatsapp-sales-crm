#!/usr/bin/env bash
# Instala el checkout QR dentro de carta.html (sin archivos JS externos).
# No activa el checkout en la API, no envia pedidos ni imprime.
set -euo pipefail

ROOT="/var/www/control"
HTML="/var/www/delibocados-public/carta.html"
CONF="/etc/nginx/conf.d/delibocados-online.conf"
SOURCE="$ROOT/scripts/delibocados/qr-checkout.js"
MODE="${1:---check}"

if [[ "$MODE" != "--check" && "$MODE" != "--apply" ]]; then
  echo "Uso: bash scripts/delibocados/install-qr-checkout.sh [--check|--apply]"
  exit 2
fi
for file in "$HTML" "$CONF" "$SOURCE"; do
  if [[ ! -f "$file" ]]; then
    echo "FALTA: $file"; exit 1
  fi
done

python3 - "$HTML" "$CONF" "$SOURCE" <<'PY'
import pathlib, re, sys
html = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
conf = pathlib.Path(sys.argv[2]).read_text(encoding="utf-8")
source = pathlib.Path(sys.argv[3]).read_text(encoding="utf-8")
assert len(re.findall(r"</body\s*>", html, re.I)) == 1, "El HTML no tiene un unico </body>"
assert 'location ^~ /restaurant-qr/ {' in conf, "Nginx QR actual no encontrado"
assert '</script' not in source.lower(), "El adaptador JS tiene cierre de script incompatible"
assert 'location ^~ /qr-checkout/ {' not in conf or \
  '4000/public/delibocados-qr/' in conf, "Conflicto con ruta checkout existente"
print("CHECK OK: menu, QR, nginx y fuente listos")
PY

if [[ "$MODE" == "--check" ]]; then
  echo "Solo verificacion; no se modifico nada."
  exit 0
fi
if [[ "$(id -u)" != "0" ]]; then
  echo "Requiere root."; exit 1
fi

BACKUP="/var/backups/delibocados-qr-checkout-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP"
chmod 700 "$BACKUP"
cp -a "$HTML" "$BACKUP/carta.html"
cp -a "$CONF" "$BACKUP/delibocados-online.conf"

rollback() {
  echo "ERROR: rollback automatico..."
  cp -a "$BACKUP/carta.html" "$HTML"
  cp -a "$BACKUP/delibocados-online.conf" "$CONF"
  nginx -t && systemctl reload nginx || true
}
trap rollback ERR

python3 - "$HTML" "$CONF" "$SOURCE" <<'PY'
import pathlib, re, sys
html_file, conf_file, source_file = map(pathlib.Path, sys.argv[1:])
html = html_file.read_text(encoding="utf-8")
conf = conf_file.read_text(encoding="utf-8")
source = source_file.read_text(encoding="utf-8")
marker = '<script id="delibocados-qr-checkout-adapter">'
if marker not in html:
  # Replace stale external reference if it exists from a prior partial install.
  html = re.sub(r'<script\b[^>]*\bsrc="/delibocados-qr-checkout\.js[^"]*"[^>]*></script>\s*',
                '', html, flags=re.I)
  inline = marker + '\n' + source + '\n</script>\n'
  html = re.sub(r'(?i)</body\s*>', lambda match: inline + match.group(0), html, count=1)
  html_file.write_text(html, encoding="utf-8")
if 'location ^~ /qr-checkout/ {' not in conf:
  block = '''    # Checkout publico seguro de Neuromind API (NO editor QR 3500)
    location ^~ /qr-checkout/ {
        proxy_pass http://127.0.0.1:4000/public/delibocados-qr/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 20s;
        add_header Cache-Control "no-store" always;
    }

'''
  conf = conf.replace('    location ^~ /restaurant-qr/ {',
                      block + '    location ^~ /restaurant-qr/ {', 1)
  conf_file.write_text(conf, encoding="utf-8")
PY

nginx -t
systemctl reload nginx

# Check the resource that was already public, avoiding a new JS URL.
curl -fsS --max-time 15 \
  --resolve delibocados.online:443:127.0.0.1 \
  https://delibocados.online/menu |
  python3 -c 'import sys; data=sys.stdin.buffer.read(); ok=b"id=\"delibocados-qr-checkout-adapter\"" in data; print("HTML MENU:","OK" if ok else "FALTA SCRIPT"); sys.exit(0 if ok else 1)'

# Invalid JSON shape is guaranteed not to create an order.
RESPONSE="$(curl -sS --max-time 15 \
  --resolve delibocados.online:443:127.0.0.1 \
  -H 'Content-Type: application/json' \
  -X POST --data '{}' \
  -w '\n%{http_code}' \
  https://delibocados.online/qr-checkout/context)"
BODY="${RESPONSE%$'\n'*}"
HTTP="${RESPONSE##*$'\n'}"
python3 - "$BODY" "$HTTP" <<'PY'
import json,sys
try:
  body=json.loads(sys.argv[1])
except Exception:
  body={}
code=sys.argv[2]
err=body.get("error")
valid=err in ("QR_CHECKOUT_NOT_ENABLED", "INVALID_INPUT", "QR_RATE_LIMIT")
print("API QR:", "OK" if valid else "NO DISPONIBLE", "HTTP",code,"CODE",err or "DESCONOCIDO")
if not valid:
  raise SystemExit(1)
PY

trap - ERR
echo "INSTALADO: adaptador dentro del HTML y ruta API QR verificada"
echo "RESPALDO: $BACKUP"
echo "PEDIDOS LIVE: NO ACTIVADOS POR ESTE INSTALADOR"
