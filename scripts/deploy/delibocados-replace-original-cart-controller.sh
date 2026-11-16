#!/usr/bin/env bash
# Replaces native "coming soon" controller; removes duplicate adapter.
# No API, Nginx, database or PM2 changes.
set -euo pipefail
cd /var/www/control
MODE="$1"
MENU="/var/www/delibocados-public/carta.html"
JS="/tmp/delibocados-cafe-native-checkout.js"
[[ "$MODE" == "--check" || "$MODE" == "--apply" ]] || { echo "Uso: --check|--apply";exit 2; }
[[ -s "$MENU" && -s "$JS" ]] || { echo "BLOQUEADO: archivos faltantes";exit 1; }
node --check "$JS"

python3 - "$MENU" "$JS" <<'PY'
from pathlib import Path
import re,sys
html=Path(sys.argv[1]).read_text(encoding="utf8")
script=Path(sys.argv[2]).read_text(encoding="utf8")
native=r'(?is)<script\b[^>]*\bid\s*=\s*["\x27]deli-qr-checkout-v1["\x27][^>]*>.*?</script\s*>'
adapter=r'(?is)<script\b[^>]*\bid\s*=\s*["\x27]delibocados-menu-live-checkout["\x27][^>]*>.*?</script\s*>'
assert len(re.findall(native,html))==1,"BLOQUEADO: no existe exactamente un controlador nativo"
assert len(re.findall(adapter,html))==1,"BLOQUEADO: no existe exactamente un adaptador duplicado"
assert len(re.findall(r'</body\s*>',html,re.I))==1,"BLOQUEADO: HTML anomalo"
for value in ('id="deli-qr-submit"','id="customer"','id="phone"','id="deli-qr-confirm"','id="deli-qr-message"','id="deli-qr-payment"'):
  assert value in html,"BLOQUEADO: falta "+value
for value in ('deli-qr-submit','async function init','async function send','delibocados-cafe-checkout-idempotency'):
  assert value in script,"BLOQUEADO: JS incompleto: "+value
assert '</script' not in script.lower(),"BLOQUEADO: JS incompatible con HTML"
print("PRECHECK OK: formulario real y los dos controladores identificados")
PY

OUT="$(mktemp /tmp/deli-cafe-checkout-context-XXXXXX)"
HTTP="$(curl --noproxy '*' --silent --output "$OUT" --write-out '%{http_code}' \
  --max-time 18 -H "Content-Type: application/json" \
  -d '{"kind":"pickup"}' \
  http://127.0.0.1:4000/public/delibocados-qr/context || true)"
python3 - "$OUT" "$HTTP" <<'PY'
import json,sys
try:
 d=json.load(open(sys.argv[1]))
 assert sys.argv[2]=="200" and d.get("ok") is True
 assert isinstance(d.get("products"),list) and len(d["products"])>0
 assert isinstance(d.get("revision"),int)
except Exception:
 raise SystemExit("BLOQUEADO: API de pedidos no disponible; no modificar HTML")
print("API OK, productos:",len(d["products"]),"revision:",d["revision"])
PY
rm -f "$OUT"
if [[ "$MODE" == "--check" ]];then
  echo "Solo lectura: ningun archivo modificado"
  exit 0
fi

[[ "$EUID" == 0 ]] || { echo "BLOQUEADO: requiere root";exit 1; }
BACKUP="/root/backups/delibocados-native-cart-$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 700 "$BACKUP"
cp -a "$MENU" "$BACKUP/carta.html"
rollback(){
  echo "ERROR: restaurando HTML del menu"
  cp -a "$BACKUP/carta.html" "$MENU"
}
trap rollback ERR

python3 - "$MENU" "$JS" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]);html=p.read_text(encoding="utf8")
js=Path(sys.argv[2]).read_text(encoding="utf8")
native=r'(?is)<script\b[^>]*\bid\s*=\s*["\x27]deli-qr-checkout-v1["\x27][^>]*>.*?</script\s*>'
adapter=r'(?is)<script\b[^>]*\bid\s*=\s*["\x27]delibocados-menu-live-checkout["\x27][^>]*>.*?</script\s*>'
new='<script id="deli-qr-checkout-v1">\n'+js+'\n</script>'
html,n=re.subn(native,lambda _:new,html)
assert n==1
html,m=re.subn(adapter,"",html)
assert m==1
assert html.count('id="deli-qr-checkout-v1"')==1
assert 'id="delibocados-menu-live-checkout"' not in html
p.write_text(html,encoding="utf8")
print("REEMPLAZADO: controlador original; ELIMINADO: adaptador duplicado")
PY

curl --noproxy '*' --silent --show-error --fail --max-time 20 \
  --resolve delibocados.online:443:127.0.0.1 \
  https://delibocados.online/menu |
python3 -c '
import sys
html=sys.stdin.buffer.read()
ok=html.count(b"id=\"deli-qr-checkout-v1\"")==1 and \
   b"id=\"delibocados-menu-live-checkout\"" not in html and \
   b"async function send(event)" in html and \
   b"delibocados-cafe-checkout-idempotency" in html
print("MENU PUBLICO:", "OK" if ok else "ERROR")
sys.exit(0 if ok else 1)
'
trap - ERR
echo "OK: un solo controlador del carrito; sin pedidos de prueba."
echo "RESPALDO: $BACKUP/carta.html"
