#!/usr/bin/env bash
# Idempotent/reversible installation; does not activate live orders or printers.
set -euo pipefail

ROOT="/var/www/control"
HTML="/var/www/delibocados-public/carta.html"
CONF="/etc/nginx/conf.d/delibocados-online.conf"
SOURCE="$ROOT/scripts/delibocados/qr-checkout.js"
ASSET="/var/www/delibocados-public/delibocados-qr-checkout.js"
MODE="${1:---check}"

if [[ "$MODE" != "--check" && "$MODE" != "--apply" ]]; then
  echo "Uso: bash scripts/delibocados/install-qr-checkout.sh [--check|--apply]"
  exit 2
fi
for file in "$HTML" "$CONF" "$SOURCE"; do
  if [[ ! -f "$file" ]]; then echo "FALTA: $file"; exit 1; fi
done

python3 - "$HTML" "$CONF" <<'PY'
import pathlib, re, sys
html = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
conf = pathlib.Path(sys.argv[2]).read_text(encoding="utf-8")
assert len(re.findall(r"</body\s*>", html, re.I)) == 1, "No hay cierre </body> unico"
assert 'location ^~ /restaurant-qr/ {' in conf, "No se encuentra la ruta QR existente"
assert 'location = /delibocados-qr-checkout.js {' not in conf or \
       'alias /var/www/delibocados-public/delibocados-qr-checkout.js;' in conf, \
       "Conflicto con un recurso JS existente"
assert 'location ^~ /qr-checkout/ {' not in conf or \
       '4000/public/delibocados-qr/' in conf, "Conflicto en checkout QR"
print("CHECK OK: fuente, HTML y rutas de Nginx localizados")
PY

if [[ "$MODE" == "--check" ]]; then
  echo "No se modifico nada. Para instalar usa --apply"
  exit 0
fi
if [[ "$(id -u)" != "0" ]]; then
  echo "La instalacion requiere root."; exit 1
fi
BACKUP="/var/backups/delibocados-qr-checkout-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP"
chmod 700 "$BACKUP"
cp -a "$HTML" "$BACKUP/carta.html"
cp -a "$CONF" "$BACKUP/delibocados-online.conf"
ASSET_EXISTED=0
if [[ -e "$ASSET" ]]; then
  cp -a "$ASSET" "$BACKUP/delibocados-qr-checkout.js"
  ASSET_EXISTED=1
fi

rollback() {
  echo "ERROR: restaurando los archivos originales..."
  cp -a "$BACKUP/carta.html" "$HTML"
  cp -a "$BACKUP/delibocados-online.conf" "$CONF"
  if [[ "$ASSET_EXISTED" == "1" ]]; then
    cp -a "$BACKUP/delibocados-qr-checkout.js" "$ASSET"
  else
    rm -f "$ASSET"
  fi
  nginx -t && systemctl reload nginx || true
}
trap rollback ERR

cp "$SOURCE" "$ASSET"
chmod 644 "$ASSET"

python3 - "$HTML" "$CONF" <<'PY'
import pathlib, re, sys
html_file, conf_file = map(pathlib.Path, sys.argv[1:])
html = html_file.read_text(encoding="utf-8")
conf = conf_file.read_text(encoding="utf-8")
tag = '<script defer src="/delibocados-qr-checkout.js?v=1"></script>'
if '/delibocados-qr-checkout.js' not in html:
    html = re.sub(r'(?i)</body\s*>', tag + '\n</body>', html, count=1)
    html_file.write_text(html, encoding="utf-8")
if 'location ^~ /qr-checkout/ {' not in conf:
    block = '''    # Neuromind QR checkout: do not confuse with the QR editor on 3500.
    location ^~ /qr-checkout/ {
        proxy_pass http://127.0.0.1:4000/public/delibocados-qr/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 20s;
        add_header Cache-Control "no-store" always;
    }
    location = /delibocados-qr-checkout.js {
        alias /var/www/delibocados-public/delibocados-qr-checkout.js;
        default_type application/javascript;
        add_header Cache-Control "no-store" always;
    }

'''
    conf = conf.replace('    location ^~ /restaurant-qr/ {',
                        block + '    location ^~ /restaurant-qr/ {', 1)
    conf_file.write_text(conf, encoding="utf-8")
PY

nginx -t
systemctl reload nginx
HTTP_CODE="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --max-time 10 --resolve delibocados.online:443:127.0.0.1 \
  https://delibocados.online/delibocados-qr-checkout.js)"
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "Recurso JS devolvio HTTP $HTTP_CODE en vez de 200"; false
fi
trap - ERR
echo "INSTALADO: adaptador QR y proxy; pedidos publicos siguen desactivados"
echo "RESPALDO: $BACKUP"
echo "PENDIENTE: verificar tablas, migraciones y flag antes de aceptar pedidos"
