#!/usr/bin/env bash
# Delibocados: apply reviewed QR dine-in schema + POS360 outbox (NO POS transports).
# This never enables any QR, launches workers, prints or sends external orders.
set -euo pipefail
cd /var/www/control
if [[ "${EUID}" -ne 0 ]]; then echo "BLOQUEADO: requiere root"; exit 1; fi
for dep in git docker pnpm; do command -v "$dep" >/dev/null || { echo "FALTA $dep"; exit 1; }; done
[[ "$(git branch --show-current)" == main ]] ||
  { echo "BLOQUEADO: se requiere main"; exit 1; }
if [[ -n "$(git diff --cached --name-only)" ||
      -n "$(git diff --name-only -- . ':!apps/dashboard/next-env.d.ts')" ]]; then
  echo "BLOQUEADO: cambios tracked locales; no sobrescribir"; exit 1
fi
touch /root/delibocados-ai.stop
git fetch origin main
git merge --ff-only origin/main
pnpm --filter @ventas/api typecheck
migrations=(
  "20261108210000_restaurant_qr_checkout_foundation.sql"
  "20261108213000_restaurant_pos360_export_queue.sql"
)
db="$(docker ps --format '{{.Names}}' | grep -E '(^|[-_])supabase[-_]db($|[-_])' | head -n 1)"
[[ -n "$db" ]] || { echo "BLOQUEADO: falta PostgreSQL Supabase"; exit 1; }
database="$(docker exec "$db" sh -c 'printf "%s" "$POSTGRES_DB"' 2>/dev/null || true)"
database="${database:-postgres}"
query(){ docker exec "$db" psql -U postgres -d "$database" -X -At -v ON_ERROR_STOP=1 -c "$1"; }
ready="$(query "SELECT to_regclass('public.restaurant_ops_orders') IS NOT NULL
 AND to_regclass('public.restaurant_ops_pos_exports') IS NOT NULL
 AND to_regclass('public.commerce_schema_migrations') IS NOT NULL")"
[[ "$ready" == t ]] || { echo "BLOQUEADO: faltan migraciones previas"; exit 1; }
for file in "${migrations[@]}"; do
  [[ -f "supabase/migrations/$file" ]] ||
    { echo "BLOQUEADO: no llegó $file desde GitHub"; exit 1; }
done
backup="/root/backups/delibocados-qr-foundation-$(date -u +%Y%m%d-%H%M%S)"
install -d -m 700 "$backup"
git rev-parse HEAD > "$backup/git.sha"
docker exec "$db" pg_dump -U postgres -d "$database" -Fc > "$backup/postgres-before.dump"
chmod 600 "$backup/postgres-before.dump"
[[ -s "$backup/postgres-before.dump" ]] ||
  { echo "BLOQUEADO: respaldo vacío"; exit 1; }
docker exec -i "$db" pg_restore -l < "$backup/postgres-before.dump" >/dev/null
for file in "${migrations[@]}"; do
  version="${file%%_*}"
  installed="$(query "SELECT count(*) FROM public.commerce_schema_migrations
    WHERE version='$version'")"
  if [[ "$installed" == 1 ]]; then
    echo "OK: migración $version ya aplicada"
  elif [[ "$installed" == 0 ]]; then
    echo "INSTALANDO esquema: $version"
    docker exec -i "$db" psql -U postgres -d "$database" -X -v ON_ERROR_STOP=1 \
      < "supabase/migrations/$file"
  else
    echo "BLOQUEADO: estado anómalo de $version"; exit 1
  fi
done
ok="$(query "SELECT to_regclass('public.restaurant_ops_qr_tables') IS NOT NULL
 AND to_regclass('public.restaurant_ops_qr_general') IS NOT NULL
 AND to_regprocedure('public.restaurant_ops_create_qr_order(text,text,text,text,uuid,text,text,jsonb,integer,text,text,boolean,text)') IS NOT NULL")"
[[ "$ok" == t ]] || { echo "BLOQUEADO: QR schema/RPC incompleto"; exit 1; }
echo "=== QR FOUNDATION INSTALADA SIN PUBLICAR ==="
echo "Respaldo: $backup"
echo "Tablas QR habilitadas: $(query "SELECT count(*) FROM public.restaurant_ops_qr_tables WHERE enabled=true")"
echo "QR general habilitado: $(query "SELECT count(*) FROM public.restaurant_ops_qr_general WHERE enabled=true")"
echo "Envíos externos POS360: NO implementados/activados"
echo "IA pública: PAUSADA"
echo "Los códigos QR actuales del editor requieren importación/revisión manual."
