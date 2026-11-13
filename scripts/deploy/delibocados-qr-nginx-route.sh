#!/usr/bin/env bash
# Route only Delibocados' public QR API to Next.js 3700. Back up / rollback.
set -euo pipefail
MODE="${1:---check}"
CONF="/etc/nginx/conf.d/panel-delibocados.conf"
[[ "$MODE" == "--check" || "$MODE" == "--apply" ]] || { echo 'Uso: --check|--apply'; exit 2; }
[[ -f "$CONF" ]] || { echo "BLOQUEADO: falta $CONF"; exit 1; }
command -v nginx >/dev/null || { echo 'BLOQUEADO: nginx no disponible'; exit 1; }
command -v curl >/dev/null || { echo 'BLOQUEADO: curl no disponible'; exit 1; }
TMP="$(mktemp -d /tmp/delibocados-nginx-qr-XXXXXXXX)"
chmod 700 "$TMP"
cleanup(){ rm -rf "$TMP"; }
trap cleanup EXIT
python3 - "$CONF" "$TMP/candidate.conf" <<'PY'
import pathlib,re,sys
source=pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
blocks=[]
for m in re.finditer(r'(?m)^\s*server\s*\{',source):
    brace=source.find('{',m.start())
    depth=0
    end=None
    in_quote=None
    in_comment=False
    escaped=False
    for i in range(brace,len(source)):
        c=source[i]
        if c=='\n': in_comment=False
        if in_comment: continue
        if in_quote:
            if escaped: escaped=False
            elif c=='\\': escaped=True
            elif c==in_quote: in_quote=None
            continue
        if c in ('"',"'"): in_quote=c;continue
        if c=='#': in_comment=True;continue
        if c=='{': depth+=1
        elif c=='}':
            depth-=1
            if depth==0:
                end=i;break
    if end is None: raise SystemExit('BLOQUEADO: bloque server incompleto')
    block=source[brace+1:end]
    if re.search(r'(?m)^\s*server_name\s+[^;]*\bpanel\.delibocados\.online\b[^;]*;',block) and re.search(r'(?m)^\s*listen\s+(?:(?:\[?::\]?|0\.0\.0\.0):)?443\b[^;]*\bssl\b',block):
        blocks.append((brace,end,block))
if len(blocks)!=1:
    raise SystemExit('BLOQUEADO: esperaba exactamente un bloque SSL del panel; encontre '+str(len(blocks)))
brace,end,block=blocks[0]
if 'DELIBOCADOS_QR_NEXT_ROUTE_V1' in block:
    print('ALREADY_CONFIGURED: ya existe el parche')
    pathlib.Path(sys.argv[2]).write_text(source,encoding='utf-8')
    raise SystemExit(0)
if re.search(r'(?m)^\s*location\s*=\s*/api/delibocados-qr/',block):
    raise SystemExit('BLOQUEADO: existe una location exacta QR que debe revisarse')
if re.search(r'(?m)^\s*location\s+(?:\^~\s*)?/api/delibocados-qr/',block):
    raise SystemExit('BLOQUEADO: ya existe otra ruta QR; no se duplicara')
location='''
    # DELIBOCADOS_QR_NEXT_ROUTE_V1: Next 3700 es el dueno de la API QR.
    location ^~ /api/delibocados-qr/ {
        proxy_pass http://127.0.0.1:3700;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_intercept_errors off;
        proxy_connect_timeout 5s;
        proxy_read_timeout 20s;
        client_max_body_size 32k;
    }
'''
new=source[:brace+1]+location+source[brace+1:]
pathlib.Path(sys.argv[2]).write_text(new,encoding='utf-8')
print('PRECHECK OK: solo se cambiara /api/delibocados-qr/ para HTTPS panel.delibocados.online')
PY
if [[ "$MODE" == "--check" ]]; then
  echo 'Solo lectura: Nginx no se modifico.'
  exit 0
fi
[[ $(id -u) == 0 ]] || { echo 'BLOQUEADO: necesitas root'; exit 1; }
node <<'JS'
const {execFileSync}=require('node:child_process');
const apps=JSON.parse(execFileSync('pm2',['jlist'],{encoding:'utf8',maxBuffer:25000000}));
for(const name of ['neuromind-api','delibocados-whatsapp-next']){
 const x=apps.find(v=>v.name===name);
 if(!x || x.pm2_env?.DELIBOCADOS_QR_CHECKOUT_ENABLED==='1')
   throw Error('BLOQUEADO: servicio QR no seguro para cambio '+name);
}
JS
install -d -m 700 /root/backups
BACKUP="$(mktemp -d /root/backups/delibocados-nginx-qr-XXXXXXXX)"
chmod 700 "$BACKUP"
cp -a "$CONF" "$BACKUP/panel-delibocados.conf"
rollback(){
 echo 'FALLO: restaurando la configuracion Nginx'
 cp -a "$BACKUP/panel-delibocados.conf" "$CONF"
 nginx -t && systemctl reload nginx || true
 echo "Respaldo: $BACKUP"
}
trap rollback ERR
cp "$TMP/candidate.conf" "$CONF"
nginx -t
systemctl reload nginx
STATUS="$(curl --noproxy '*' --silent --show-error -o "$BACKUP/qr-test.json" \
 -w '%{http_code}' --max-time 15 \
 --resolve panel.delibocados.online:443:127.0.0.1 \
 -H 'Origin: https://panel.delibocados.online' \
 -H 'Content-Type: application/json' --data '{}' \
 https://panel.delibocados.online/api/delibocados-qr/order)"
ERR="$(node - "$BACKUP/qr-test.json" <<'JS'
const f=require('fs');
try{const d=JSON.parse(f.readFileSync(process.argv[2],'utf8'));process.stdout.write(String(d.error||''))}
catch{process.stdout.write('NON_JSON')}
JS
)"
echo "QR publico: HTTP $STATUS codigo $ERR (esperado 503 QR_CHECKOUT_NOT_ENABLED)"
[[ "$STATUS" == 503 && "$ERR" == QR_CHECKOUT_NOT_ENABLED ]] || false
PANEL="$(curl --noproxy '*' --silent --show-error -o /dev/null -w '%{http_code}' --max-time 15 \
 --resolve panel.delibocados.online:443:127.0.0.1 \
 https://panel.delibocados.online/panel)"
echo "Panel administrativo: HTTP $PANEL"
[[ "$PANEL" =~ ^(200|301|302|303|307|308)$ ]] || false
trap - ERR
echo 'OK: Nginx encamina la API QR a Next 3700; pedidos siguen desactivados.'
echo "BACKUP: $BACKUP/panel-delibocados.conf"
