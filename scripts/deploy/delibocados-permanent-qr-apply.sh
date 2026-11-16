#!/usr/bin/env bash
# Delibocados permanent table QR storage. Does not rotate or expire a single QR.
set -euo pipefail
cd /var/www/control
migration="supabase/migrations/20261116113000_delibocados_permanent_qr_reprint.sql"
[[ "$(git branch --show-current)" == "main" ]] || { echo "BLOQUEADO: usar rama main"; false; }
[[ -f "$migration" ]] || { echo "BLOQUEADO: migración ausente"; false; }
[[ -z "$(git diff --name-only)" && -z "$(git diff --cached --name-only)" ]] ||
  { echo "BLOQUEADO: hay cambios tracked sin guardar"; false; }
for command in docker pnpm pm2 git; do
  command -v "$command" >/dev/null || { echo "BLOQUEADO: falta $command"; false; }
done
# Verifies the canonical Delibocados master-key source without revealing any key.
pnpm --filter @ventas/api exec tsx src/scripts/delibocados-pos-onboarding.ts master-check
pnpm --filter @ventas/api typecheck
pnpm --filter @ventas/dashboard typecheck
db="$(docker ps --format '{{.Names}}' | grep -E '(^|[-_])supabase[-_]db($|[-_])' | head -n 1)"
[[ -n "$db" ]] || { echo "BLOQUEADO: no se encontró PostgreSQL Supabase"; false; }
dbname="$(docker exec "$db" sh -c 'printf "%s" "$POSTGRES_DB"' 2>/dev/null || true)"
dbname="${dbname:-postgres}"
query(){ docker exec "$db" psql -U postgres -d "$dbname" -X -At -v ON_ERROR_STOP=1 -c "$1"; }
[[ "$(query "SELECT to_regclass('public.restaurant_ops_qr_tables') IS NOT NULL")" == t ]] ||
  { echo "BLOQUEADO: no hay mesas QR"; false; }
installed="$(query "SELECT count(*) FROM public.commerce_schema_migrations WHERE version='20261116113000'")"
[[ "$installed" == 0 || "$installed" == 1 ]] || { echo "BLOQUEADO: estado de migración desconocido"; false; }
if [[ "$installed" == 0 ]]; then
 backup="/root/backups/delibocados-permanent-qr-$(date -u +%Y%m%d-%H%M%S)"
 install -d -m 700 "$backup"
 docker exec "$db" pg_dump -U postgres -d "$dbname" -Fc > "$backup/before.dump"
 chmod 600 "$backup/before.dump"
 [[ -s "$backup/before.dump" ]] || { echo "BLOQUEADO: respaldo falló"; false; }
 docker exec -i "$db" pg_restore -l < "$backup/before.dump" >/dev/null
 echo "Respaldo creado: $backup"
 docker exec -i "$db" psql -U postgres -d "$dbname" -X -v ON_ERROR_STOP=1 < "$migration"
else
 echo "Migración QR permanente ya instalada."
fi
[[ "$(query "SELECT count(*) FROM public.commerce_schema_migrations WHERE version='20261116113000'")" == 1 ]] ||
 { echo "BLOQUEADO: migración sin confirmar"; false; }

DELIBOCADOS_BUILD=1 NEXT_PUBLIC_PANEL_INSTANCE=delibocados DELIBOCADOS_STAGING_BUILD=1 \
 pnpm -C apps/dashboard exec next build
cd apps/dashboard
[[ -f .next-delibocados-candidate/BUILD_ID ]] ||
 { echo "BLOQUEADO: build incompleta"; false; }
stamp="$(date +%Y%m%d-%H%M%S)"
if [[ -d .next-delibocados ]]; then mv .next-delibocados ".next-delibocados.backup.$stamp"; fi
mv .next-delibocados-candidate .next-delibocados
cd ../..
pm2 restart neuromind-api --update-env
DELIBOCADOS_BUILD=1 NEXT_PUBLIC_PANEL_INSTANCE=delibocados DELIBOCADOS_STAGING_BUILD=0 \
 pm2 restart delibocados-whatsapp-next --update-env
echo "=== QR PERMANENTES DESPLEGADOS ==="
git log -1 --oneline
echo "Los QR impresos mantienen su hash. Nadie tiene que renovarlos cada día."
echo "Los QR anteriores no recuperables se reemiten solo si se perdió su imagen."
