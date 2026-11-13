#!/usr/bin/env bash
# Deploy secure QR admin panel. Never enable public checkout or touch Nginx/DB.
set -euo pipefail
MODE="${1:---check}"
ROOT="/var/www/control"
BRANCH="fix/delibocados-qr-panel-real-20261113"
FILES=(
 "apps/api/src/routes/restaurant-ops.routes.ts"
 "apps/api/src/routes/restaurant-qr-public.routes.ts"
 "apps/dashboard/src/components/restaurant-os/native-qr.tsx"
 "apps/dashboard/src/app/qr-pedido/page.tsx"
 "apps/dashboard/src/components/restaurant-os/native-menu.tsx"
 "apps/dashboard/next.config.mjs"
 "apps/dashboard/package.json"
)
[[ "$MODE" == "--check" || "$MODE" == "--apply" ]] || {
 echo "USO: bash $0 --check|--apply"; exit 2;
}
cd "$ROOT"
for bin in git pnpm node pm2 curl; do
 command -v "$bin" >/dev/null || { echo "BLOQUEADO: falta $bin"; exit 1; }
done
for proc in neuromind-api delibocados-whatsapp-next; do
 pm2 describe "$proc" >/dev/null 2>&1 || {
   echo "BLOQUEADO: falta proceso PM2 $proc"; exit 1;
 }
done
for file in "${FILES[@]}"; do
 [[ -f "$file" ]] || { echo "BLOQUEADO: falta $file"; exit 1; }
done
[[ -f apps/dashboard/.next-delibocados/BUILD_ID ]] || {
 echo "BLOQUEADO: no existe build Delibocados actual para rollback"; exit 1;
}
git fetch origin "$BRANCH"
for file in "${FILES[@]}"; do
 git cat-file -e "FETCH_HEAD:$file" || { echo "BLOQUEADO: falta $file en rama"; exit 1; }
done
changes="$(git diff --name-only -- "${FILES[@]}")"
staged="$(git diff --cached --name-only -- "${FILES[@]}")"
if [[ -n "$changes" || -n "$staged" ]]; then
 echo "BLOQUEADO: cambios locales en archivos a instalar:"
 printf '%s\n%s\n' "$changes" "$staged"; exit 1
fi
echo "PRECHECK OK: no se tocara Nginx, PostgreSQL, pagos ni POS360."
echo "PRECHECK OK: el checkout publico NO se activara."
if [[ "$MODE" == "--check" ]]; then exit 0; fi
[[ "$(id -u)" == 0 ]] || { echo "BLOQUEADO: requiere root"; exit 1; }
install -d -m 700 /root/backups
BACKUP="$(mktemp -d /root/backups/delibocados-qr-panel-XXXXXXXX)"
chmod 700 "$BACKUP"
for file in "${FILES[@]}"; do
 mkdir -p "$BACKUP/$(dirname "$file")"
 cp -a "$file" "$BACKUP/$file"
done
[[ ! -f pnpm-lock.yaml ]] || cp -a pnpm-lock.yaml "$BACKUP/pnpm-lock.yaml"
OLD_BUILD="$ROOT/apps/dashboard/.next-delibocados"
NEW_BUILD="$ROOT/apps/dashboard/.next-delibocados-candidate"
MOVED_OLD=0
MOVED_NEW=0
rollback(){
 echo "ERROR: revirtiendo codigo y build del panel QR"
 for file in "${FILES[@]}"; do cp -a "$BACKUP/$file" "$file"; done
 if [[ -f "$BACKUP/pnpm-lock.yaml" ]]; then
   cp -a "$BACKUP/pnpm-lock.yaml" pnpm-lock.yaml
 fi
 if [[ "$MOVED_NEW" == 1 && -d "$OLD_BUILD" ]]; then
   mv "$OLD_BUILD" "$NEW_BUILD.failed-$(date +%s)" || true
 fi
 if [[ "$MOVED_OLD" == 1 && -d "$BACKUP/.next-delibocados" ]]; then
   mv "$BACKUP/.next-delibocados" "$OLD_BUILD" || true
 fi
 pnpm install --no-frozen-lockfile >/dev/null 2>&1 || true
 pm2 restart neuromind-api --update-env >/dev/null 2>&1 || true
 pm2 restart delibocados-whatsapp-next --update-env >/dev/null 2>&1 || true
 echo "ROLLBACK intentado. Respaldo: $BACKUP"
}
trap rollback ERR
for file in "${FILES[@]}"; do
 git show "FETCH_HEAD:$file" > "$file"
done
pnpm install --no-frozen-lockfile
pnpm --filter @ventas/api typecheck
pnpm --filter @ventas/dashboard typecheck
rm -rf "$NEW_BUILD"
DELIBOCADOS_BUILD=1 NEXT_PUBLIC_PANEL_INSTANCE=delibocados DELIBOCADOS_STAGING_BUILD=1 \
  pnpm --filter @ventas/dashboard exec next build
[[ -f "$NEW_BUILD/BUILD_ID" ]] || {
  echo "BLOQUEADO: Next no genero BUILD_ID candidato"; false;
}
if [[ -d "$OLD_BUILD" ]]; then
 mv "$OLD_BUILD" "$BACKUP/.next-delibocados"
 MOVED_OLD=1
fi
mv "$NEW_BUILD" "$OLD_BUILD"
MOVED_NEW=1
pm2 restart neuromind-api --update-env
pm2 restart delibocados-whatsapp-next --update-env
sleep 5
API_HTTP="$(curl --noproxy '*' -s -o /dev/null -w '%{http_code}' \
  --max-time 10 http://127.0.0.1:4000/admin/restaurant-ops/qr/secure-tables)"
PANEL_HTTP="$(curl --noproxy '*' -s -o /dev/null -w '%{http_code}' \
  --max-time 10 http://127.0.0.1:3700/panel/qr)"
CUSTOMER_HTTP="$(curl --noproxy '*' -s -o /dev/null -w '%{http_code}' \
  --max-time 10 http://127.0.0.1:3700/qr-pedido)"
echo "API admin anonima => $API_HTTP (esperado 401/403)"
echo "Panel QR => $PANEL_HTTP (puede redirigir a login)"
echo "Pagina del cliente => $CUSTOMER_HTTP"
[[ "$API_HTTP" == 401 || "$API_HTTP" == 403 ]] || false
[[ "$PANEL_HTTP" =~ ^(200|301|302|303|307|308|401|403)$ ]] || false
[[ "$CUSTOMER_HTTP" =~ ^(200|301|302|303|307|308)$ ]] || false
trap - ERR
echo "INSTALADO: panel QR seguro y emision privada de enlaces."
echo "NO ACTIVADO: pedidos QR, SmartPOS ni impresion."
echo "RESPALDO: $BACKUP"
