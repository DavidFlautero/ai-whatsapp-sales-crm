#!/usr/bin/env bash
# Apply versioned table-check migration before restarting live API/dashboard.
# Does not send to POS360, print tickets, or change API checkout flags.
set -euo pipefail
cd /var/www/control
for command in docker pnpm pm2 git python3; do
  command -v "$command" >/dev/null || { echo "BLOQUEADO: falta $command"; exit 1; }
done
[[ "$(git branch --show-current)" == main ]] ||
  { echo "BLOQUEADO: desplegar solo desde main"; exit 1; }
[[ -z "$(git diff --name-only)" && -z "$(git diff --cached --name-only)" ]] ||
  { echo "BLOQUEADO: hay cambios locales tracked sin guardar"; exit 1; }
migration="supabase/migrations/20261116103000_delibocados_open_table_sessions.sql"
[[ -f "$migration" ]] || { echo "BLOQUEADO: falta migracion"; exit 1; }
python3 -m py_compile scripts/deploy/delibocados-legacy-optional-table-phone.py
pnpm --filter @ventas/api typecheck
pnpm --filter @ventas/dashboard typecheck

db="$(docker ps --format '{{.Names}}' | grep -E '(^|[-_])supabase[-_]db($|[-_])' | head -n 1)"
[[ -n "$db" ]] || { echo "BLOQUEADO: no hay contenedor Supabase DB"; exit 1; }
dbname="$(docker exec "$db" sh -c 'printf "%s" "$POSTGRES_DB"' 2>/dev/null || true)"
dbname="${dbname:-postgres}"
query(){ docker exec "$db" psql -U postgres -d "$dbname" -X -At -v ON_ERROR_STOP=1 -c "$1"; }
ready="$(query "SELECT to_regclass('public.restaurant_ops_qr_tables') IS NOT NULL AND to_regclass('public.restaurant_ops_orders') IS NOT NULL AND to_regclass('public.commerce_schema_migrations') IS NOT NULL")"
[[ "$ready" == t ]] || { echo "BLOQUEADO: tablas previas QR no instaladas"; exit 1; }
version=20261116103000
installed="$(query "SELECT count(*) FROM public.commerce_schema_migrations WHERE version='$version'")"
[[ "$installed" == 0 || "$installed" == 1 ]] || { echo "BLOQUEADO: migraciones en estado desconocido"; exit 1; }
if [[ "$installed" == 0 ]]; then
  backup="/root/backups/delibocados-open-tables-$(date -u +%Y%m%d-%H%M%S)"
  install -d -m 700 "$backup"
  git rev-parse HEAD > "$backup/git.sha"
  docker exec "$db" pg_dump -U postgres -d "$dbname" -Fc > "$backup/before.dump"
  chmod 600 "$backup/before.dump"
  [[ -s "$backup/before.dump" ]] || { echo "BLOQUEADO: respaldo vacío"; exit 1; }
  docker exec -i "$db" pg_restore -l < "$backup/before.dump" >/dev/null
  echo "Respaldo PostgreSQL: $backup"
  docker exec -i "$db" psql -U postgres -d "$dbname" -X -v ON_ERROR_STOP=1 < "$migration"
else
  echo "Migración ya instalada. Sin cambios en PostgreSQL."
fi
[[ "$(query "SELECT count(*) FROM public.commerce_schema_migrations WHERE version='$version'")" == 1 ]] ||
  { echo "BLOQUEADO: migración no confirmada"; exit 1; }

DELIBOCADOS_BUILD=1 NEXT_PUBLIC_PANEL_INSTANCE=delibocados DELIBOCADOS_STAGING_BUILD=1 \
  pnpm -C apps/dashboard exec next build
cd apps/dashboard
[[ -f .next-delibocados-candidate/BUILD_ID ]] ||
  { echo "BLOQUEADO: no se publicó build incompleto"; exit 1; }
stamp="$(date +%Y%m%d-%H%M%S)"
if [[ -d .next-delibocados ]]; then
  mv .next-delibocados ".next-delibocados.backup.$stamp"
fi
mv .next-delibocados-candidate .next-delibocados
cd ../..
pm2 restart neuromind-api --update-env
DELIBOCADOS_BUILD=1 NEXT_PUBLIC_PANEL_INSTANCE=delibocados DELIBOCADOS_STAGING_BUILD=0 \
  pm2 restart delibocados-whatsapp-next --update-env
python3 scripts/deploy/delibocados-legacy-optional-table-phone.py
echo "=== DELIBOCADOS TABLE CHECKS DESPLEGADOS ==="
git log -1 --oneline
pm2 describe neuromind-api | grep -E 'status|script path' || true
echo "POS360: transport and physical printing NOT VERIFIED."
