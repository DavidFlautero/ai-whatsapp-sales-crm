#!/usr/bin/env bash
# Fix Delibocados static menu bootstrap only: read-only pickup catalog context.
# Never enables web checkout, QR checkout or POS claims; never changes carta.html.
set -Eeuo pipefail
cd /var/www/control
fail(){ echo "BLOQUEADO: $*" >&2; exit 1; }
[[ "$(id -u)" == "0" ]] || fail "REQUIERE_ROOT"
command -v python3 >/dev/null && command -v node >/dev/null && command -v curl >/dev/null || fail "DEPENDENCIA_FALTANTE"
HTML=/var/www/delibocados-public/carta.html
ROUTE=apps/api/src/routes/restaurant-qr-public.routes.ts
[[ -f "$HTML" && -f "$ROUTE" ]] || fail "ARCHIVO_NO_ENCONTRADO"
# Guard against accidentally modifying unrelated static/Next checkout.
python3 - "$HTML" "$ROUTE" <<'PY'
import sys,re
html=open(sys.argv[1],encoding="utf-8").read()
route=open(sys.argv[2],encoding="utf-8").read()
# The static cart preloads a pickup menu before it validates a table QR.
# With WEB_CHECKOUT off, backend returns 503 and init() aborts.
if not re.search(r"""post\s*\(\s*["']context["']\s*,\s*\{\s*kind\s*:\s*["']pickup["']""",html):
    print("BLOQUEADO: NO_SE_CONFIRMO_PRELOAD_PICKUP_EN_CARTA")
    sys.exit(2)
if "No se pudo conectar con el servicio de pedidos. No se enviará nada." not in html:
    print("BLOQUEADO: MENSAJE_ESPERADO_NO_ENCONTRADO")
    sys.exit(2)
old='''  if(process.env.DELIBOCADOS_WEB_CHECKOUT_ENABLED!=="1")
    return jsonError(res,503,"WEB_CHECKOUT_NOT_ENABLED");'''
if route.count(old)!=1:
    if "READ_ONLY_PICKUP_CONTEXT_BOOTSTRAP_V1" in route:
        print("YA_INSTALADO=SI")
        sys.exit(0)
    print("BLOQUEADO: GUARD_BACKEND_NO_COINCIDE")
    sys.exit(2)
print("CAUSA_CONFIRMADA=PRELOAD_PICKUP_503_CUANDO_WEB_CHECKOUT_OFF")
print("CARTA_ORIGINAL=CONSERVADA")
PY

PREVIEW_PATH="$ROUTE"
if grep -Fq READ_ONLY_PICKUP_CONTEXT_BOOTSTRAP_V1 "$PREVIEW_PATH"; then
  echo "PARCHE_PREEXISTENTE=SI"
  exit 0
fi

# Ensure all automated delivery gates are still off.
pm2 jlist | node -e '
let b="";process.stdin.on("data",x=>b+=x);process.stdin.on("end",()=>{
const e=(JSON.parse(b).find(x=>x.name==="neuromind-api")||{}).pm2_env||{};
console.log("ESTADO_API="+e.status);
console.log("WEB_CHECKOUT_PREVIO="+(e.DELIBOCADOS_WEB_CHECKOUT_ENABLED??"NO_CONFIGURADO"));
console.log("CHECKOUT_GENERAL_PREVIO="+e.DELIBOCADOS_QR_CHECKOUT_ENABLED);
console.log("CLAIM_GENERAL_PREVIO="+e.DELIBOCADOS_POS360_FULL_CLAIM_ENABLED);
if(e.status!=="online"||e.DELIBOCADOS_WEB_CHECKOUT_ENABLED==="1"||
 e.DELIBOCADOS_QR_CHECKOUT_ENABLED!=="0"||e.DELIBOCADOS_POS360_FULL_CLAIM_ENABLED!=="0")
process.exitCode=1;
});' || fail "ESTADO_API_NO_SEGURO"

DIR="$(mktemp -d /tmp/deli-web-catalog-fix.XXXXXX)"
cp -p "$ROUTE" "$DIR/restaurant-qr-public.routes.ts.original"
echo "BACKUP_RUTA=$DIR"
started=0
rollback_required=1
restore(){
  if [[ "$rollback_required" != 1 ]]; then return; fi
  echo "RESTAURANDO_RUTA_ORIGINAL"
  cp -p "$DIR/restaurant-qr-public.routes.ts.original" "$ROUTE" || true
  if [[ "$started" == 1 ]]; then
    DELIBOCADOS_WEB_CHECKOUT_ENABLED=0 \
    DELIBOCADOS_QR_CHECKOUT_ENABLED=0 \
    DELIBOCADOS_POS360_FULL_CLAIM_ENABLED=0 \
    pm2 restart neuromind-api --update-env >/dev/null || true
  fi
}
trap 'restore' EXIT

python3 - "$ROUTE" <<'PY'
import pathlib,sys
p=pathlib.Path(sys.argv[1])
s=p.read_text()
old='''  if(process.env.DELIBOCADOS_WEB_CHECKOUT_ENABLED!=="1")
    return jsonError(res,503,"WEB_CHECKOUT_NOT_ENABLED");'''
new='''  // READ_ONLY_PICKUP_CONTEXT_BOOTSTRAP_V1:
  // The original static carta.html fetches pickup menu metadata BEFORE its
  // independently verified table QR context. A 503 here aborts init().
  // Allow ONLY read-only pickup context while web checkout remains off.
  // Never allow an order or a delivery quote through this exception.
  if(process.env.DELIBOCADOS_WEB_CHECKOUT_ENABLED!=="1" &&
     (checkout || req.body?.kind!=="pickup"))
    return jsonError(res,503,"WEB_CHECKOUT_NOT_ENABLED");'''
if s.count(old)!=1:raise SystemExit('BLOQUEADO: SOURCE_CHANGED')
p.write_text(s.replace(old,new))
PY

pnpm --filter @ventas/api typecheck >/dev/null || fail "TYPECHECK_FAILED"
echo "TYPECHECK=OK"

# Preserve Mesa 1 pilot flag (though its single-use DB gate may have expired),
# and explicitly keep both global checkout and global claim disabled.
started=1
DELIBOCADOS_WEB_CHECKOUT_ENABLED=0 \
DELIBOCADOS_QR_CHECKOUT_ENABLED=0 \
DELIBOCADOS_POS360_FULL_CLAIM_ENABLED=0 \
pm2 restart neuromind-api --update-env >/dev/null

# PM2 reporting "online" does not mean the server socket is listening yet.
# Poll a harmless invalid-input request until the QR route itself responds.
echo "ESPERANDO_API_4000_DESPUES_REINICIO"
READY=0
for attempt in $(seq 1 40); do
  CHECK="$(curl --noproxy '*' -sS --max-time 3 \
    -H 'Content-Type: application/json' -X POST \
    --data '{}' -o /dev/null -w '%{http_code}' \
    http://127.0.0.1:4000/public/delibocados-qr/context 2>/dev/null || true)"
  if [[ "$CHECK" == "400" ]]; then READY=1; break; fi
  sleep 2
done
if [[ "$READY" != 1 ]]; then
  echo "API_4000_NO_LISTA: ultimo_HTTP=$CHECK"
  pm2 jlist | node -e 'let b="";process.stdin.on("data",x=>b+=x);process.stdin.on("end",()=>{const p=JSON.parse(b).find(x=>x.name==="neuromind-api"); console.log("PM2_API_STATUS="+(p?.pm2_env?.status||"NO_ENCONTRADO")); console.log("PM2_REINICIOS="+(p?.pm2_env?.restart_time??"DESCONOCIDO"));});' || true
  fail "API_NO_REAPARECIO_DESPUES_REINICIO"
fi
echo "API_4000_LISTA=SI"

TMP="$(mktemp)"
STATUS="$(curl --noproxy '*' -sS --max-time 12 \
 -H 'Origin: https://delibocados.online' \
 -H 'Content-Type: application/json' -X POST \
 --data '{"kind":"pickup"}' -o "$TMP" -w '%{http_code}' \
 http://127.0.0.1:4000/public/delibocados-qr/context || true)"
echo "CONTEXT_PICKUP_LOCAL_HTTP=$STATUS"
python3 - "$TMP" "$STATUS" <<'PY'
import sys,json
status=sys.argv[2]
try:
 obj=json.load(open(sys.argv[1]))
 ok=obj.get('ok') is True and isinstance(obj.get('products'),list) and len(obj['products'])>0 and isinstance(obj.get('revision'),int)
 print('CATALOGO_PRODUCTOS='+str(len(obj.get('products',[]))))
 print('PREVIEW_LECTURA_OK='+str(ok))
 if status!='200' or not ok:sys.exit(1)
except Exception as e:
 print('PREVIEW_HTTP_O_JSON_ERROR='+str(e)[:100]);sys.exit(1)
PY
rm -f "$TMP"

# This is a malformed *order* probe: with WEB_CHECKOUT disabled, the guard
# must reject before parsing or creating anything.
TMP="$(mktemp)"
STATUS="$(curl --noproxy '*' -sS --max-time 8 \
 -H 'Origin: https://delibocados.online' \
 -H 'Content-Type: application/json' -X POST \
 --data '{"kind":"pickup"}' -o "$TMP" -w '%{http_code}' \
 http://127.0.0.1:4000/public/delibocados-qr/order || true)"
echo "WEB_ORDER_NO_AUTORIZADO_HTTP=$STATUS"
python3 - "$TMP" "$STATUS" <<'PY'
import sys,json
try:
 d=json.load(open(sys.argv[1]))
 assert sys.argv[2]=='503' and d.get('error')=='WEB_CHECKOUT_NOT_ENABLED'
 print('WEB_ORDER_BLOQUEADO=SI')
except Exception:
 print('BLOQUEADO: SE_PERDIO_EL_GUARD_DE_PEDIDOS_WEB')
 sys.exit(1)
PY
rm -f "$TMP"
rollback_required=0
trap - EXIT
echo "PARCHE_CATALOGO_READ_ONLY=INSTALADO"
echo "CARTA_HTML_SIN_CAMBIOS=SI"
echo "QR_SEGURIDAD_SIN_CAMBIOS=SI"
echo "WEB_CHECKOUT_OFF=SI"
echo "POS360_CLAIM_GENERAL_OFF=SI"
echo "PEDIDOS_PRUEBA=NINGUNO"
