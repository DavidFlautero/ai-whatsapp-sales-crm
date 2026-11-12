#!/usr/bin/env bash
# Delibocados: withdraw ONLY the legacy coffee-styled public /menu URL.
# Keep carta.html, QR registry, API, PostgreSQL and the new admin panel intact.
# HTTPS GET /menu returns 410 Gone (including URLs with query strings).
set -euo pipefail

CONF="/etc/nginx/conf.d/delibocados-online.conf"
MODE="${1:---check}"

if [[ "$MODE" != "--check" && "$MODE" != "--apply" ]]; then
  echo "Uso: bash delibocados-retire-legacy-menu.sh --check|--apply"
  exit 2
fi
[[ -f "$CONF" ]] || { echo "NO SE ENCONTRO: $CONF"; exit 1; }

# The patch must be scoped to precisely one virtual host and its /menu location.
verify() {
  python3 - "$CONF" <<'PY'
import pathlib,re,sys
s=pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
matches=list(re.finditer(r'(?ms)^(?P<indent>[ \t]*)location[ \t]+=[ \t]+/menu[ \t]*\{(?P<body>[^{}]*)\}',s))
if len(matches)!=1:
    raise SystemExit("BLOQUEADO: se esperaba exactamente una location = /menu; encontradas "+str(len(matches)))
start=s.rfind("server {",0,matches[0].start())
before=s[start:matches[0].start()] if start>=0 else ""
if not re.search(r'server_name[ \t]+delibocados\.online\b',before) or not re.search(r'listen[ \t]+443[ \t]+ssl',before):
    raise SystemExit("BLOQUEADO: /menu no pertenece al servidor HTTPS esperado")
slash=list(re.finditer(r'(?ms)^[ \t]*location[ \t]+=[ \t]+/menu/[ \t]*\{(?P<body>[^{}]*)\}',s))
if len(slash)>1:
    raise SystemExit("BLOQUEADO: mas de una ruta /menu/")
print("PRECHECK OK: solo se modificara /menu en HTTPS de delibocados.online")
PY
}
verify

if [[ "$MODE" == "--check" ]]; then
  echo "Modo solo lectura. Para retirar la URL ejecuta --apply."
  exit 0
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Se requiere root para modificar Nginx"; exit 1
fi
install -d -m 700 /root/backups
BACKUP="$(mktemp -d /root/backups/delibocados-retire-cafe-menu-XXXXXXXX)"
chmod 700 "$BACKUP"
cp -a "$CONF" "$BACKUP/delibocados-online.conf"

rollback() {
  echo "FALLO DE VERIFICACION: restaurando Nginx..."
  cp -a "$BACKUP/delibocados-online.conf" "$CONF"
  nginx -t && systemctl reload nginx || true
}
trap rollback ERR

python3 - "$CONF" <<'PY'
import pathlib,re,sys
file=pathlib.Path(sys.argv[1])
s=file.read_text(encoding="utf-8")
pattern=r'(?ms)^(?P<indent>[ \t]*)location[ \t]+=[ \t]+/menu[ \t]*\{(?P<body>[^{}]*)\}'
m=re.search(pattern,s)
if m is None:raise SystemExit("Ruta /menu no encontrada")
indent=m.group("indent")
replacement=indent+"location = /menu { return 410; }"
s=s[:m.start()]+replacement+s[m.end():]
slash=r'(?ms)^[ \t]*location[ \t]+=[ \t]+/menu/[ \t]*\{[^{}]*\}'
if re.search(slash,s):
    s=re.sub(slash,indent+"location = /menu/ { return 410; }",s,count=1)
else:
    s=s.replace(replacement,replacement+"\n"+indent+"location = /menu/ { return 410; }",1)
file.write_text(s,encoding="utf-8")
PY

nginx -t
systemctl reload nginx

for path in /menu "/menu?mesa=test" /menu/; do
  STATUS="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    --max-time 12 --resolve delibocados.online:443:127.0.0.1 \
    "https://delibocados.online$path")"
  echo "HTTPS $path => $STATUS"
  [[ "$STATUS" == 410 ]] || { echo "BLOQUEADO: no se verifico 410"; false; }
done

trap - ERR
echo "OK: /menu y /menu/ retirados; HTTP 410."
echo "NO SE BORRARON: productos, QRs, pedidos, bases de datos ni panel nuevo."
echo "RESPALDO: $BACKUP/delibocados-online.conf"
echo "Para revertir: cp -a '$BACKUP/delibocados-online.conf' '$CONF' && nginx -t && systemctl reload nginx"
