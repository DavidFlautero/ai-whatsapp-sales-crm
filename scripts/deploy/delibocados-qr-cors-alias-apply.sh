#!/usr/bin/env bash
# Fix CORS + alias for QR behind existing /api/ Nginx rewrite.
# No Nginx, Next, database or order changes.
set -euo pipefail
MODE="${1:---check}"
ROOT="/var/www/control"
BRANCH="fix/delibocados-qr-panel-real-20261113"
FILES=("apps/api/src/server/createApp.ts" "apps/api/src/routes/index.ts")
[[ "$MODE" == "--check" || "$MODE" == "--apply" ]] || { echo "USO: $0 --check|--apply"; exit 2; }
cd "$ROOT"
for app in git pm2 pnpm node curl; do command -v "$app" >/dev/null || { echo "FALTA: $app"; exit 1; }; done
git fetch origin "$BRANCH"
for file in "${FILES[@]}"; do
 [[ -f "$file" ]] || { echo "BLOQUEADO: falta $file"; exit 1; }
 git cat-file -e "HEAD:$file"
 git cat-file -e "FETCH_HEAD:$file"
done
TMP="$(mktemp -d /tmp/delibocados-qr-cors-XXXXXXXX)"
chmod 700 "$TMP"
trap 'rm -rf "$TMP"' EXIT
for file in "${FILES[@]}"; do
 mkdir -p "$TMP/$(dirname "$file")"
 if git diff --quiet HEAD -- "$file"; then
   git show "FETCH_HEAD:$file" > "$TMP/$file"
 else
   git show "HEAD:$file" > "$TMP/base.txt"
   git show "FETCH_HEAD:$file" > "$TMP/incoming.txt"
   if ! git merge-file --diff3 --stdout "$file" "$TMP/base.txt" "$TMP/incoming.txt" > "$TMP/$file"; then
     echo "BLOQUEADO: conflicto local en $file"; exit 1
   fi
   echo "MERGE OK: se conservaran cambios locales de $file"
 fi
done
node <<'JS'
const {execFileSync}=require("node:child_process");
const apps=JSON.parse(execFileSync("pm2",["jlist"],{encoding:"utf8"}));
const api=apps.find(x=>x.name==="neuromind-api");
if(!api || api.pm2_env?.status!=="online" ||
    String(api.pm2_env?.DELIBOCADOS_QR_CHECKOUT_ENABLED||"0")==="1"){
  console.error("BLOQUEADO: API inactiva o checkout QR real habilitado");
  process.exitCode=2;
}
JS
echo "PRECHECK OK: solo CORS restringido y alias QR, sin pedidos."
if [[ "$MODE" == "--check" ]]; then exit 0; fi
[[ "$(id -u)" -eq 0 ]] || { echo "BLOQUEADO: requiere root"; exit 1; }
install -d -m 700 /root/backups
BACKUP="$(mktemp -d /root/backups/delibocados-qr-cors-XXXXXXXX)"
chmod 700 "$BACKUP"
for file in "${FILES[@]}"; do
 mkdir -p "$BACKUP/$(dirname "$file")"
 cp -a "$file" "$BACKUP/$file"
done
RESTARTED=0
rollback(){
 echo "ERROR: restaurando el codigo de API original"
 for file in "${FILES[@]}"; do cp -a "$BACKUP/$file" "$file"; done
 if [[ "$RESTARTED" == 1 ]]; then
   pm2 restart neuromind-api --update-env >/dev/null 2>&1 || true
 fi
 echo "RESPALDO: $BACKUP"
}
trap rollback ERR
for file in "${FILES[@]}"; do cp "$TMP/$file" "$file"; done
pnpm --filter @ventas/api typecheck
RESTARTED=1
pm2 restart neuromind-api --update-env
sleep 4
COUNT=0
for target in "http://127.0.0.1:4000/delibocados-qr/order" \
              "https://panel.delibocados.online/api/delibocados-qr/order"; do
 COUNT=$((COUNT + 1))
 if [[ "$target" == https:* ]]; then
   RESOLVE=(--resolve panel.delibocados.online:443:127.0.0.1)
 else
   RESOLVE=()
 fi
 STATUS="$(curl --noproxy '*' --silent --show-error --max-time 15 \
   "${RESOLVE[@]}" -D "$BACKUP/headers-$COUNT.txt" -o "$BACKUP/body-$COUNT.json" \
   -w '%{http_code}' -H 'Origin: https://panel.delibocados.online' \
   -H 'Content-Type: application/json' --data '{}' "$target")"
 CODE="$(node -e 'const fs=require("fs");try{const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(String(d.error||""))}catch{process.stdout.write("NON_JSON")}' "$BACKUP/body-$COUNT.json")"
 echo "$target => HTTP $STATUS $CODE"
 [[ "$STATUS" == 503 && "$CODE" == QR_CHECKOUT_NOT_ENABLED ]] || false
 grep -iq '^X-Deli-QR-Handler: api-qr-alias-v1' "$BACKUP/headers-$COUNT.txt" || {
   echo "BLOQUEADO: peticion no llego al alias QR"; false;
 }
done
trap - ERR
echo "OK: QR API publico enrutado; pedidos QR siguen DESACTIVADOS."
echo "RESPALDO: $BACKUP"
