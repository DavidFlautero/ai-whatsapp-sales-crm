#!/usr/bin/env bash
# READ-ONLY diagnostic of the ACTUAL frontend serving the old "Escaneá QR" cart.
# Does not modify files, database, PM2, Nginx, integration flags, QR or POS.
set -u
cd /var/www/control || exit 1
echo "====== DIAGNOSTICO WEB DELIBOCADOS / QR ======"
date -u '+UTC=%Y-%m-%dT%H:%M:%SZ'
echo
echo '=== PM2 (solo metadatos, no secretos) ==='
if command -v pm2 >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
  pm2 jlist | node -e '
  let b="";process.stdin.on("data",x=>b+=x);process.stdin.on("end",()=>{
    try{for(const p of JSON.parse(b)){
      const e=p.pm2_env||{};
      if(!/deli|neuromind|restaurant|menu|dashboard/i.test(p.name))continue;
      console.log(JSON.stringify({
        name:p.name,status:e.status,
        cwd:e.pm_cwd||"",script:e.pm_exec_path||"",
        QR_CHECKOUT:e.DELIBOCADOS_QR_CHECKOUT_ENABLED??null,
        QR_PILOT:e.DELIBOCADOS_QR_MESA1_PILOT_ENABLED??null,
        FULL_CLAIM:e.DELIBOCADOS_POS360_FULL_CLAIM_ENABLED??null,
        PANEL_INSTANCE:e.NEXT_PUBLIC_PANEL_INSTANCE??null
      }));
    }}catch(err){console.log("PM2_PARSE_ERROR="+err.message)}
  });' || true
else
  echo 'PM2_O_NODE_NO_DISPONIBLE'
fi

echo
echo '=== NGINX RUTEO (SOLO DIRECTIVAS NO SECRETAS) ==='
if command -v nginx >/dev/null 2>&1; then
  timeout 12 nginx -T 2>/dev/null |
    grep -E '^[[:space:]]*(server_name|root|alias|proxy_pass|location|listen)[[:space:]]' |
    grep -E -v 'secret|token|password|key|Authorization' |
    head -n 110 || true
else
  echo 'NGINX_NO_ENCONTRADO'
fi

echo
echo '=== HTTP DE CADA DOMINIO POR NGINX LOCAL ==='
probe(){
  local host="$1" uri="$2" method="$3" file code url
  file="$(mktemp)"
  url="https://$host$uri"
  if [ "$method" = "POST" ]; then
    code="$(curl -ksS --connect-timeout 3 --max-time 7 --resolve "$host:443:127.0.0.1" \
       -X POST -H "Origin: https://$host" -H 'Content-Type: application/json' \
       --data '{}' -o "$file" -w '%{http_code}' "$url" 2>/dev/null)" || code='CURL_ERROR'
  else
    code="$(curl -ksS --connect-timeout 3 --max-time 7 --resolve "$host:443:127.0.0.1" \
       -o "$file" -w '%{http_code}' "$url" 2>/dev/null)" || code='CURL_ERROR'
  fi
  printf '%s %s %-37s HTTP=%s ' "$method" "$host" "$uri" "$code"
  python3 - "$file" <<'PY'
import sys,json,re
b=open(sys.argv[1],'rb').read(250000)
try:
  d=json.loads(b.decode('utf-8'))
  print('JSON_STATUS='+str(d.get('error',d.get('status',d.get('message','UNKNOWN'))))[:120])
except Exception:
  txt=b.decode('utf-8','replace')
  m=re.search(r'<title[^>]*>([^<]{1,120})</title>',txt,re.I)
  print('PAGE_TITLE='+(m.group(1) if m else 'SIN_TITULO'))
PY
  rm -f "$file"
}
for host in delibocados.online delibocadosfunza.com panel.delibocados.online; do
  probe "$host" '/' GET
  probe "$host" '/qr-pedido' GET
  probe "$host" '/api/delibocados-qr/context' POST
done

echo
echo '=== ENDPOINT API LOCAL CON PAYLOAD VACIO (SIN TOKEN) ==='
http="$(curl -sS --max-time 7 -o /tmp/deli-qr-probe-nonsecret-$$.json -w '%{http_code}' \
 -X POST -H 'Content-Type: application/json' --data '{}' \
 'http://127.0.0.1:4000/public/delibocados-qr/context' 2>/dev/null)" || http="CURL_ERROR"
printf 'API_4000_CONTEXT_HTTP=%s ' "$http"
python3 - "/tmp/deli-qr-probe-nonsecret-$$.json" <<'PY'
import json,sys
try:
 d=json.load(open(sys.argv[1]))
 print('ERROR='+str(d.get('error','UNKNOWN')))
except Exception:print('NO_JSON')
PY
rm -f "/tmp/deli-qr-probe-nonsecret-$$.json"

echo
echo '=== ORIGEN REAL DEL MENSAJE Y BOTON ANTIGUO ==='
python3 <<'PY'
import os,time
roots=['/var/www','/srv/www','/opt/delibocados']
patterns=['QR individual de tu mesa','servicio de pedidos',
          'No se enviará nada','No se enviara nada','Almuerzo Domingo']
omit={'node_modules','.git','.pnpm','vendor','.cache','coverage'}
exts={'.html','.js','.mjs','.cjs','.jsx','.ts','.tsx','.vue','.json'}
t=time.monotonic();n=0;hits=0;files=0
for root in roots:
 if not os.path.isdir(root):continue
 for base,dirs,names in os.walk(root):
  dirs[:]=[d for d in dirs if d not in omit and not d.startswith('backup')]
  for name in names:
   if time.monotonic()-t>32 or files>35000:break
   if os.path.splitext(name)[1].lower() not in exts:continue
   p=os.path.join(base,name)
   try:
    size=os.path.getsize(p)
    if size>10000000:continue
    files+=1
    b=open(p,'rb').read()
    for needle in patterns:
     if needle.encode('utf-8') in b:
      hits+=1
      print('CODIGO_ENCONTRADO='+p+' FRASE='+needle)
      break
   except (OSError,PermissionError):continue
   if hits>=28:break
  if hits>=28 or time.monotonic()-t>32 or files>35000:break
 if hits>=28 or time.monotonic()-t>32 or files>35000:break
print(f'ARCHIVOS_EXAMINADOS={files} COINCIDENCIAS={hits} SEGUNDOS={round(time.monotonic()-t,1)}')
PY

echo
echo '=== GATE Y COLA (SOLO LECTURA) ==='
DB="$(docker ps --format '{{.Names}}' | grep -Ei 'supabase.*db|db.*supabase' | head -n 1 || true)"
if [ -n "$DB" ]; then
  docker exec "$DB" psql -U postgres -d postgres -Atq -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'PILOTO_CONSUMIDO='||(consumed_at IS NOT NULL)::text ||
       ' PILOTO_HABILITADO='||enabled::text||
       ' VIGENTE='||(enabled AND now()<expires_at)::text
FROM public.restaurant_ops_qr_single_use_pilot WHERE singleton=1;
SELECT 'POS360_EXPORT_PENDING='||count(*)::text
FROM public.restaurant_ops_pos_exports
WHERE company_id='delibocados' AND provider='pos360' AND status='pending';
SQL
else
  echo 'POSTGRES_NO_DETECTADO'
fi
echo '=== DIAGNOSTICO_FIN: SIN CAMBIOS ==='
