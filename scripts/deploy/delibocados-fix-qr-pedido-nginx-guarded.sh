#!/usr/bin/env bash
# Guarded fix for public Delibocados QR page routing. No orders/checkout changed.
set -Eeuo pipefail
[[ $(id -u) -eq 0 ]] || { echo 'BLOQUEADO: usar root'; exit 1; }
command -v nginx >/dev/null && command -v curl >/dev/null && command -v python3 >/dev/null || { echo 'BLOQUEADO: falta dependencia'; exit 1; }
internal=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:3700/qr-pedido || true)
external=$(curl -ksS --resolve panel.delibocados.online:443:127.0.0.1 -o /dev/null -w '%{http_code}' --max-time 8 https://panel.delibocados.online/qr-pedido || true)
echo "NEXT_3700=$internal NGINX_PUBLICO=$external"
if [[ "$internal" != 200 ]]; then
  echo 'BLOQUEADO: el proceso Next.js 3700 no devuelve /qr-pedido con HTTP 200. No se cambio nada.'
  exit 1
fi
if [[ "$external" == 200 ]]; then
  echo 'RUTA_PUBLICA=OK; diagnosticar QR impreso antiguo. No se cambio nada.'
  exit 0
fi
if [[ "$external" != 302 && "$external" != 301 && "$external" != 307 && "$external" != 308 ]]; then
  echo 'BLOQUEADO: se esperaba redireccion desde Nginx. No se cambio nada.'
  exit 1
fi
python3 <<'PY'
import pathlib,re,subprocess,shutil,sys,time
dump=subprocess.run(['nginx','-T'],capture_output=True,text=True,check=True).stdout
chunks=re.split(r'^# configuration file (.*?):\s*$',dump,flags=re.M)
candidates=[]
pattern=r'(?m)^([ \t]*)location[ \t]+=[ \t]+/qr-pedido[ \t]*\{([^{}]*)\}'
for i in range(1,len(chunks)-1,2):
    if 'server_name panel.delibocados.online' not in chunks[i+1]:continue
    for m in re.finditer(pattern,chunks[i+1]):
        candidates.append((chunks[i],m.group(0),m.group(1),m.group(2)))
if len(candidates)!=1:
    raise SystemExit('BLOQUEADO: ruta QR no es unica en Nginx: '+str(len(candidates)))
src,old,indent,body=candidates[0]
if not re.search(r'\breturn\s+30[1278]\b',body) or 'proxy_pass' in body:
    raise SystemExit('BLOQUEADO: la ruta no tiene redireccion simple; requiere inspeccion')
src=pathlib.Path(src).resolve()
if not str(src).startswith('/etc/nginx/'):
    raise SystemExit('BLOQUEADO: archivo Nginx inesperado')
original=src.read_text()
if original.count(old)!=1:
    raise SystemExit('BLOQUEADO: no coincide el bloque con el archivo original')
replacement='\n'.join([
    indent+'location = /qr-pedido {',
    indent+'    proxy_pass http://127.0.0.1:3700;',
    indent+'    proxy_http_version 1.1;',
    indent+'    proxy_set_header Host $host;',
    indent+'    proxy_set_header X-Real-IP $remote_addr;',
    indent+'    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    indent+'    proxy_set_header X-Forwarded-Proto $scheme;',
    indent+'    add_header Cache-Control "no-store" always;',
    indent+'}',
])
backup=src.with_name(src.name+'.backup-qr-pedido-'+time.strftime('%Y%m%d-%H%M%S'))
shutil.copy2(src,backup)
print('BACKUP='+str(backup))
try:
    src.write_text(original.replace(old,replacement))
    subprocess.run(['nginx','-t'],check=True,capture_output=True)
    subprocess.run(['nginx','-s','reload'],check=True,capture_output=True)
    r=subprocess.run(['curl','-ksS','--resolve','panel.delibocados.online:443:127.0.0.1',
      '-o','/dev/null','-w','%{http_code}','--max-time','8',
      'https://panel.delibocados.online/qr-pedido'],capture_output=True,text=True,check=True)
    if r.stdout!='200':raise RuntimeError('ruta HTTP '+r.stdout)
    print('QR_PEDIDO_HTTP=200')
    print('REPARACION_NGINX=OK')
except Exception as e:
    shutil.copy2(backup,src)
    subprocess.run(['nginx','-t'],capture_output=True)
    subprocess.run(['nginx','-s','reload'],capture_output=True)
    print('ROLLBACK=REALIZADO')
    print('ERROR='+str(e))
    raise SystemExit(1)
PY
echo 'NO_SE_HAN_MODIFICADO_PEDIDOS_NI_EL_HTML_ANTIGUO.'
echo 'REVISAR_QR_DE_MESA1_EN_EL_PANEL_SIN_ROTAR_TOKEN.'
