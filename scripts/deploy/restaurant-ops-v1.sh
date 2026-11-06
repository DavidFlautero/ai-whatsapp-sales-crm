#!/usr/bin/env bash
# Guarded deployment to /var/www/control. Run with bash, not source.
# Never removes /root/delibocados-ai.stop; never touches Nginx or existing webhook secrets.
deploy_restaurant_os() {
  local root=/var/www/control backup stamp db database check already sha
  stamp="$(date -u +%Y%m%d-%H%M%S)"
  backup="/root/backups/restaurant-ops-$stamp"
  echo "=== DELIBOCADOS / DESPLIEGUE SEGURO ==="
  if [[ "$EUID" -ne 0 ]]; then
    echo "BLOQUEADO: requiere root en neuromind33"; return 1
  fi
  if ! cd "$root"; then
    echo "BLOQUEADO: repositorio no encontrado"; return 1
  fi
  for bin in git docker pm2 pnpm curl; do
    if ! command -v "$bin" >/dev/null 2>&1; then
      echo "BLOQUEADO: falta $bin"; return 1
    fi
  done
  if [[ "$(git branch --show-current)" != main ]]; then
    echo "BLOQUEADO: checkout no está en main"; return 1
  fi
  if [[ -n "$(git diff --cached --name-only)" ]]; then
    echo "BLOQUEADO: archivos staged"; return 1
  fi
  local dirty
  dirty="$(git diff --name-only -- . ':!apps/dashboard/next-env.d.ts')"
  if [[ -n "$dirty" ]]; then
    echo "BLOQUEADO: archivos tracked con modificaciones:"
    printf '%s\n' "$dirty"; return 1
  fi
  if [[ ! -f .env ]]; then echo "BLOQUEADO: falta .env"; return 1; fi
  for proc in neuromind-api delibocados-whatsapp-next; do
    if ! pm2 describe "$proc" >/dev/null 2>&1; then
      echo "BLOQUEADO: no existe proceso $proc"; return 1
    fi
  done
  db="$(docker ps --format '{{.Names}}' | grep -E '(^|[-_])supabase[-_]db($|[-_])' | head -n 1)"
  if [[ -z "$db" ]]; then
    echo "BLOQUEADO: contenedor PostgreSQL no localizado"
    docker ps --format '{{.Names}}'
    return 1
  fi
  database="$(docker exec "$db" sh -c 'printf "%s" "$POSTGRES_DB"' 2>/dev/null)"
  if [[ -z "$database" ]]; then database=postgres; fi
  if ! docker exec "$db" psql -U postgres -d "$database" -Atc "SELECT current_database()" >/dev/null 2>&1; then
    echo "BLOQUEADO: no hay acceso PostgreSQL; sin modificaciones"; return 1
  fi
  check="$(docker exec "$db" psql -U postgres -d "$database" -At -v ON_ERROR_STOP=1 -c "
    SELECT to_regclass('public.commerce_companies') IS NOT NULL
     AND to_regclass('public.restaurant_menu_documents') IS NOT NULL
     AND to_regclass('public.commerce_schema_migrations') IS NOT NULL
     AND (SELECT count(*) FROM pg_roles
          WHERE rolname IN ('anon','authenticated','service_role'))=3
  " 2>/dev/null)"
  if [[ "$check" != t ]]; then
    echo "BLOQUEADO: esquema o roles Supabase incompletos"; return 1
  fi
  check="$(docker exec "$db" psql -U postgres -d "$database" -At -v ON_ERROR_STOP=1 \
    -c "SELECT count(*) FROM public.commerce_companies WHERE id='delibocados'" 2>/dev/null)"
  if [[ "$check" != 1 ]]; then
    echo "BLOQUEADO: empresa Delibocados no está en la BD elegida"; return 1
  fi
  if ! install -d -m 700 "$backup"; then
    echo "BLOQUEADO: no se pudo reservar carpeta de respaldo"; return 1
  fi
  git rev-parse HEAD > "$backup/git-before.sha"
  if [[ -f apps/dashboard/next-env.d.ts ]]; then
    cp -p apps/dashboard/next-env.d.ts "$backup/next-env.d.ts"
  fi
  echo "Respaldo PostgreSQL en: $backup"
  if ! docker exec "$db" pg_dump -U postgres -d "$database" -Fc > "$backup/postgres-before.dump"; then
    echo "BLOQUEADO: error pg_dump"; return 1
  fi
  chmod 600 "$backup/postgres-before.dump"
  if [[ ! -s "$backup/postgres-before.dump" ]]; then
    echo "BLOQUEADO: copia PostgreSQL vacía"; return 1
  fi
  if ! git fetch origin main; then
    echo "BLOQUEADO: fallo git fetch"; return 1
  fi
  if ! git merge-base --is-ancestor 0f9013a7d7c084570930423bb98ec3f3e5c04812 origin/main; then
    echo "BLOQUEADO: main no contiene el PR validado"; return 1
  fi
  if ! git merge --ff-only origin/main; then
    echo "BLOQUEADO: git no pudo actualizar sin sobrescribir cambios"; return 1
  fi
  if [[ ! -f supabase/migrations/20261106170000_restaurant_operations_core.sql ]]; then
    echo "BLOQUEADO: no está la migración"; return 1
  fi
  if ! pnpm --filter @ventas/api typecheck; then
    echo "BLOQUEADO: fallo typecheck API"; return 1
  fi
  if ! DELIBOCADOS_BUILD=1 NEXT_PUBLIC_PANEL_INSTANCE=delibocados \
      NEXT_PUBLIC_API_URL=http://127.0.0.1:4000 \
      pnpm --filter @ventas/dashboard exec next build; then
    echo "BLOQUEADO: fallo build dashboard"; return 1
  fi
  already="$(docker exec "$db" psql -U postgres -d "$database" -At -v ON_ERROR_STOP=1 \
    -c "SELECT count(*) FROM public.commerce_schema_migrations WHERE version='20261106170000'" 2>/dev/null)"
  if [[ "$already" == 0 ]]; then
    if ! docker exec -i "$db" psql -U postgres -d "$database" \
      -X -v ON_ERROR_STOP=1 \
      < supabase/migrations/20261106170000_restaurant_operations_core.sql; then
      echo "BLOQUEADO: migración fallida; no se reinició ningún proceso"; return 1
    fi
  elif [[ "$already" != 1 ]]; then
    echo "BLOQUEADO: estado de migración inesperado"; return 1
  fi
  if [[ ! -f supabase/migrations/20261106200000_restaurant_payment_review.sql ]]; then
    echo "BLOQUEADO: falta migración de comprobantes"
    return 1
  fi
  already="$(docker exec "$db" psql -U postgres -d "$database" -At -v ON_ERROR_STOP=1 \
    -c "SELECT count(*) FROM public.commerce_schema_migrations WHERE version='20261106200000'" 2>/dev/null)"
  if [[ "$already" == 0 ]]; then
    if ! docker exec -i "$db" psql -U postgres -d "$database" \
      -X -v ON_ERROR_STOP=1 \
      < supabase/migrations/20261106200000_restaurant_payment_review.sql; then
      echo "BLOQUEADO: migración de pagos fallida; no se reiniciaron procesos"
      return 1
    fi
  elif [[ "$already" != 1 ]]; then
    echo "BLOQUEADO: estado de migración de pagos inesperado"
    return 1
  fi
  check="$(docker exec "$db" psql -U postgres -d "$database" -At -v ON_ERROR_STOP=1 \
    -c "SELECT (to_regclass('public.restaurant_ops_orders') IS NOT NULL
       AND to_regclass('public.restaurant_ops_kitchen_tickets') IS NOT NULL
       AND to_regclass('public.restaurant_ops_couriers') IS NOT NULL
       AND to_regclass('public.restaurant_ops_payment_proofs') IS NOT NULL)" 2>/dev/null)"
  if [[ "$check" != t ]]; then
    echo "BLOQUEADO: no se localizaron tablas nuevas"; return 1
  fi
  if ! touch /root/delibocados-ai.stop; then
    echo "BLOQUEADO: no se puede garantizar IA pausada"; return 1
  fi
  if ! pm2 restart neuromind-api --update-env; then
    echo "ERROR: reinicio API fallido; revisar PM2"; return 1
  fi
  if ! pm2 restart delibocados-whatsapp-next --update-env; then
    echo "ERROR: reinicio Next fallido; revisar PM2"; return 1
  fi
  # PM2 reports "online" before Node has finished loading dependencies and binding the socket.
  local ready=0 attempt
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    if curl -fsS --max-time 3 http://127.0.0.1:4000/health >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 2
  done
  if [[ "$ready" != 1 ]]; then
    echo "ALERTA: API no responde /health después de los intentos; la IA sigue pausada"
    echo "Diagnóstico sin secretos: ss -ltnp | grep ':4000'; pm2 logs neuromind-api --lines 35 --nostream"
    return 1
  fi
  sha="$(git rev-parse --short HEAD)"
  echo "COMMIT: $sha"
  echo "RESPALDO: $backup"
  echo "API: OK"
  echo "IA AUTOMATICA: PAUSADA"
  echo "Pagos: bandeja de comprobantes instalada"
  echo "Toteat/POS360: sin envíos automáticos"
  echo "Siguiente verificación: abrir /panel/pedidos con sesión"
  echo "=== DESPLIEGUE TECNICO COMPLETADO ==="
}
deploy_restaurant_os
