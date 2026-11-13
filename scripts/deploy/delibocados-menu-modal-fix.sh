#!/usr/bin/env bash
# Surgical browser fix: attach the checkout to dynamically-created cart modal.
# Only edits /var/www/delibocados-public/carta.html.
set -euo pipefail
cd /var/www/control

MENU="/var/www/delibocados-public/carta.html"
SCRIPT="/tmp/delibocados-menu-checkout.js"
MODE="${1:---check}"
[[ "$MODE" == "--check" || "$MODE" == "--apply" ]] || { echo "Uso: $0 --check|--apply"; exit 2; }
[[ -s "$MENU" && -s "$SCRIPT" ]] || { echo "FALTA menu HTML o JavaScript descargado"; exit 1; }
node --check "$SCRIPT"
python3 - "$MENU" "$SCRIPT" <<'PY'
import pathlib,re,sys
page=pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
js=pathlib.Path(sys.argv[2]).read_text(encoding="utf-8")
assert len(re.findall(r'</body\s*>',page,re.I))==1,"HTML invalido"
assert page.count('id="delibocados-menu-live-checkout"')==1,"Checkout anterior no instalado o duplicado"
assert 'disabled-submit' in page,"Boton carrito original no encontrado"
assert 'MutationObserver(scheduleScan)' in js,"JavaScript no incluye soporte del modal dinamico"
assert 'bindCheckout(button)' in js,"Falta binding del boton"
assert '</script' not in js.lower(),"Inyeccion JS incompatible con HTML"
print("CHECK OK: formulario dinamico + un unico adaptador existente")
PY

# Prove that the API checkout is already live. No order can be created here.
RESP="$(curl --noproxy '*' --silent --show-error --max-time 15 \
  -H 'Content-Type: application/json' \
  -d '{"kind":"pickup"}' \
  -w '\n%{http_code}' \
  http://127.0.0.1:4000/public/delibocados-qr/context)"
BODY="${RESP%$'\n'*}"
HTTP="${RESP##*$'\n'}"
python3 - "$BODY" "$HTTP" <<'PY'
import json,sys
try:
  d=json.loads(sys.argv[1]);status=sys.argv[2]
  assert status=="200"
  assert d.get("ok") is True
  assert isinstance(d.get("products"),list) and len(d["products"])>0
except Exception:
  raise SystemExit("API NO LISTA. No se modificara el menu. Revisar neuromind-api.")
print("API PEDIDOS: OK; catálogo:",len(d["products"]),"productos")
PY
if [[ "$MODE" == "--check" ]]; then
  echo "CHECK COMPLETO: ningun archivo modificado."
  exit 0
fi
[[ "$(id -u)" == "0" ]] || { echo "Requiere root"; exit 1; }

BACKUP="/root/backups/delibocados-menu-modal-fix-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP";chmod 700 "$BACKUP"
cp -a "$MENU" "$BACKUP/carta.html"
rollback() {
  echo "ERROR: restaurando carta.html previa"
  cp -a "$BACKUP/carta.html" "$MENU"
}
trap rollback ERR

python3 - "$MENU" "$SCRIPT" <<'PY'
from pathlib import Path
import re,sys
page=Path(sys.argv[1]);html=page.read_text(encoding="utf-8")
js=Path(sys.argv[2]).read_text(encoding="utf-8")
pattern=r'(?is)<script\s+id=["\x27]delibocados-menu-live-checkout["\x27]\s*>.*?</script>'
replacement='<script id="delibocados-menu-live-checkout">\n'+js+'\n</script>'
html,count=re.subn(pattern,lambda m:replacement,html)
assert count==1,f"Esperaba reemplazar 1 adaptador, encontre {count}"
page.write_text(html,encoding="utf-8")
PY

# Verify exact public resource, not a proxy/CDN; do not create orders.
curl --noproxy '*' --silent --show-error --fail --max-time 15 \
  --resolve delibocados.online:443:127.0.0.1 \
  https://delibocados.online/menu |
python3 -c '
import sys
s=sys.stdin.buffer.read()
ok = s.count(b"id=\"delibocados-menu-live-checkout\"")==1 and \
     b"MutationObserver(scheduleScan)" in s and \
     b"bindCheckout(button)" in s
print("MENU MODAL DINAMICO:", "OK" if ok else "ERROR")
sys.exit(0 if ok else 1)
'
trap - ERR
echo "INSTALADO: boton del modal dinamico enlazado al checkout."
echo "No se hizo ningun pedido, ni se modifico la API, Nginx o SmartPOS."
echo "RESPALDO: $BACKUP/carta.html"
