#!/usr/bin/env bash
# Apply the reviewed Delibocados POS export schema, without sending any order.
# Usage on neuromind33: bash scripts/deploy/delibocados-toteat-outbox-apply.sh
set -euo pipefail
cd /var/www/control
if [[ "${EUID}" -ne 0 ]]; then echo "BLOQUEADO: requiere root"; exit 1; fi
for bin in git docker pnpm; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "BLOQUEADO: falta $bin"; exit 1
  fi
done
if [[ "$(git branch --show-current)" != main ]]; then
  echo "BLOQUEADO: requiere rama main"; exit 1
fi
if [[ -n "$(git diff --cached --name-only)" ||
      -n "$(git diff --name-only -- . ':!apps/dashboard/next-env.d.ts')" ]]; then
  echo "BLOQUEADO: cambios tracked no permitidos"; exit 1
fi
touch /root/delibocados-ai.stop
git fetch origin main
git merge --ff-only origin/main

migration="supabase/migrations/20261108190000_delibocados_pos_export_outbox.sql"
if [[ ! -f "$migration" ]]; then echo "BLOQUEADO: falta migración POS"; exit 1; fi
pnpm --filter @ventas/api typecheck

db="$(docker ps --format '{{.Names}}' | grep -E '(^|[-_])supabase[-_]db($|[-_])' | head -n1)"
if [[ -z "$db" ]]; then echo "BLOQUEADO: falta contenedor Supabase PostgreSQL"; exit 1; fi
database="$(docker exec "$db" sh -c 'printf "%s" "$POSTGRES_DB"' 2>/dev/null || true)"
database="${database:-postgres}"
query(){ docker exec "$db" psql -U postgres -d "$database" -At -X -v ON_ERROR_STOP=1 -c "$1"; }
schema="$(query "SELECT to_regclass('public.restaurant_ops_orders') IS NOT NULL
  AND to_regclass('public.company_integrations') IS NOT NULL
  AND to_regclass('public.restaurant_ops_order_items') IS NOT NULL
  AND to_regclass('public.commerce_schema_migrations') IS NOT NULL")"
if [[ "$schema" != t ]]; then echo "BLOQUEADO: tablas anteriores no instaladas"; exit 1; fi
installed="$(query "SELECT count(*) FROM public.commerce_schema_migrations WHERE version='20261108190000'")"
if [[ "$installed" != 0 && "$installed" != 1 ]]; then
  echo "BLOQUEADO: estado inesperado de migración"; exit 1
fi

backup="/root/backups/delibocados-pos-outbox-$(date -u +%Y%m%d-%H%M%S)"
install -d -m 700 "$backup"
git rev-parse HEAD > "$backup/git.sha"
docker exec "$db" pg_dump -U postgres -d "$database" -Fc > "$backup/postgres-before.dump"
chmod 600 "$backup/postgres-before.dump"
if [[ ! -s "$backup/postgres-before.dump" ]]; then
  echo "BLOQUEADO: respaldo de base vacío"; exit 1
fi

if [[ "$installed" == 0 ]]; then
  docker exec -i "$db" psql -U postgres -d "$database" -X -v ON_ERROR_STOP=1 < "$migration"
else
  echo "Migración POS ya instalada. No se volverá a ejecutar."
fi
ready="$(query "SELECT to_regclass('public.restaurant_ops_pos_exports') IS NOT NULL
  AND to_regclass('public.restaurant_ops_pos_product_map') IS NOT NULL
  AND to_regprocedure('public.restaurant_ops_pos_claim_toteat(text)') IS NOT NULL")"
if [[ "$ready" != t ]]; then echo "BLOQUEADO: esquema incompleto"; exit 1; fi
echo "=== POS OUTBOX INSTALADO SIN ACTIVAR ENVÍOS ==="
echo "Respaldo PostgreSQL: $backup"
echo "IA de clientes: PAUSADA"
echo "No se exportó ni reenvió ningún pedido histórico"
echo "Sin worker HTTP ni impresión de comanda"
pnpm --filter @ventas/api exec tsx src/scripts/delibocados-toteat-readiness.ts
