#!/usr/bin/env bash
# Installs the POS360 outbox bridge safely. NO enablement, NO live SmartPOS writes.
set -euo pipefail
cd /var/www/control
[[ "$(git branch --show-current)" == "main" ]] || { echo "BLOQUEADO: usar main"; exit 1; }
[[ -z "$(git diff --name-only)" && -z "$(git diff --cached --name-only)" ]] ||
  { echo "BLOQUEADO: cambios tracked locales"; exit 1; }
for tool in docker pnpm pm2; do
 command -v "$tool" >/dev/null || { echo "BLOQUEADO: falta $tool"; exit 1; }
done
migration="supabase/migrations/20261116170000_delibocados_pos360_bridge_outbox.sql"
[[ -f "$migration" ]] || { echo "BLOQUEADO: falta migración"; exit 1; }
pnpm --filter @ventas/api typecheck
db="$(docker ps --format '{{.Names}}' | grep -E '(^|[-_])supabase[-_]db($|[-_])' | head -n 1)"
[[ -n "$db" ]] || { echo "BLOQUEADO: contenedor PostgreSQL no identificado"; exit 1; }
dbname="$(docker exec "$db" sh -c 'printf "%s" "$POSTGRES_DB"' 2>/dev/null || true)"
dbname="${dbname:-postgres}"
query(){ docker exec "$db" psql -U postgres -d "$dbname" -X -At -v ON_ERROR_STOP=1 -c "$1"; }
ready="$(query "SELECT to_regclass('public.restaurant_ops_pos_exports') IS NOT NULL AND to_regclass('public.restaurant_ops_pos_product_map') IS NOT NULL AND to_regclass('public.restaurant_ops_table_sessions') IS NOT NULL")"
[[ "$ready" == t ]] || { echo "BLOQUEADO: falta infraestructura POS360 existente"; exit 1; }
version=20261116170000
found="$(query "SELECT count(*) FROM public.commerce_schema_migrations WHERE version='$version'")"
if [[ "$found" == 0 ]]; then
 backup="/root/backups/delibocados-pos360-bridge-$(date -u +%Y%m%d-%H%M%S)"
 install -d -m 700 "$backup"
 docker exec "$db" pg_dump -U postgres -d "$dbname" -Fc > "$backup/pos360-before.dump"
 chmod 600 "$backup/pos360-before.dump"
 [[ -s "$backup/pos360-before.dump" ]] || { echo "BLOQUEADO: respaldo vacío"; exit 1; }
 docker exec -i "$db" pg_restore -l < "$backup/pos360-before.dump" >/dev/null
 echo "Respaldo verificado: $backup"
 docker exec -i "$db" psql -U postgres -d "$dbname" -X -v ON_ERROR_STOP=1 < "$migration"
else
 [[ "$found" == 1 ]] || { echo "BLOQUEADO: migración inconsistente"; exit 1; }
 echo "Migración ya instalada."
fi
[[ "$(query "SELECT count(*) FROM public.commerce_schema_migrations WHERE version='$version'")" == 1 ]] ||
 { echo "BLOQUEADO: migración no confirmada"; exit 1; }

# Explicitly leave the transport DISABLED regardless of inherited PM2 env.
DELIBOCADOS_POS360_BRIDGE_ENABLED=0 pm2 restart neuromind-api --update-env

echo "=== POS360 BRIDGE PREPARADO (SIN ACTIVACIÓN) ==="
git log -1 --oneline
pnpm --filter @ventas/api exec tsx src/scripts/delibocados-pos-onboarding.ts status
echo "El puente permanece OFF; no se ha reclamado ni enviado pedido a SmartPOS."
echo "Para activar se necesitan: adaptador nativo probado, mapeos revisados, clave y prueba Windows."
