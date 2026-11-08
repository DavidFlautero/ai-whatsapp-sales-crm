#!/usr/bin/env bash
# One-command application of the owner-approved postal address.
# Never supplies Google API credentials, invents GPS or enables customer AI.
apply_delibocados_approved_address() {
  local db database applied address backup stamp
  if [[ "$EUID" -ne 0 ]]; then
    echo "BLOQUEADO: ejecutar como root en la VPS"; return 1
  fi
  if ! cd /var/www/control; then
    echo "BLOQUEADO: no existe el repositorio"; return 1
  fi
  if ! touch /root/delibocados-ai.stop; then
    echo "BLOQUEADO: no pudo garantizarse IA pausada"; return 1
  fi
  for bin in git docker; do
    if ! command -v "$bin" >/dev/null 2>&1; then
      echo "BLOQUEADO: falta $bin"; return 1
    fi
  done
  if [[ "$(git branch --show-current)" != main ]]; then
    echo "BLOQUEADO: solo desde main"; return 1
  fi
  if [[ -n "$(git diff --cached --name-only)" ||
        -n "$(git diff --name-only -- . ':!apps/dashboard/next-env.d.ts')" ]]; then
    echo "BLOQUEADO: cambios locales, revisar antes de actualizar"; return 1
  fi
  if ! git fetch origin main || ! git merge --ff-only origin/main; then
    echo "BLOQUEADO: no se actualizó Git de forma segura"; return 1
  fi
  if [[ ! -f supabase/migrations/20261108043000_delibocados_approved_origin_address.sql ]]; then
    echo "BLOQUEADO: falta la migración de la dirección"; return 1
  fi

  db="$(docker ps --format '{{.Names}}' | grep -E '(^|[-_])supabase[-_]db($|[-_])' | head -n1)"
  if [[ -z "$db" ]]; then
    echo "BLOQUEADO: no se encontró PostgreSQL"; return 1
  fi
  database="$(docker exec "$db" sh -c 'printf "%s" "$POSTGRES_DB"' 2>/dev/null)"
  if [[ -z "$database" ]]; then database=postgres; fi
  stamp="$(date -u +%Y%m%d-%H%M%S)"
  backup="/root/backups/delibocados-address-$stamp"
  if ! install -d -m 700 "$backup"; then return 1; fi
  if ! docker exec "$db" pg_dump -U postgres -d "$database" -Fc > "$backup/before.dump"; then
    echo "BLOQUEADO: no se completó la copia de seguridad"; return 1
  fi
  chmod 600 "$backup/before.dump"
  if [[ ! -s "$backup/before.dump" ]]; then
    echo "BLOQUEADO: copia de seguridad vacía"; return 1
  fi

  applied="$(docker exec "$db" psql -U postgres -d "$database" -At -v ON_ERROR_STOP=1 \
    -c "SELECT COUNT(*) FROM public.commerce_schema_migrations WHERE version='20261108043000'" 2>/dev/null)"
  if [[ "$applied" == 0 ]]; then
    if ! docker exec -i "$db" psql -U postgres -d "$database" \
      -X -v ON_ERROR_STOP=1 < supabase/migrations/20261108043000_delibocados_approved_origin_address.sql; then
      echo "BLOQUEADO: no se guardó la dirección"; return 1
    fi
  elif [[ "$applied" != 1 ]]; then
    echo "BLOQUEADO: estado inesperado de migraciones"; return 1
  fi

  address="$(docker exec "$db" psql -U postgres -d "$database" -At -v ON_ERROR_STOP=1 \
    -c "SELECT location_address FROM public.restaurant_agent_business_profiles WHERE company_id='delibocados'" 2>/dev/null)"
  if [[ "$address" != "Calle 9 #10A-28, Funza, Cundinamarca, Colombia" ]]; then
    echo "BLOQUEADO: el dato final no coincide"; return 1
  fi
  echo "=== DIRECCIÓN GUARDADA EN VPS ==="
  echo "$address"
  echo "Respaldo: $backup"
  echo "Origen GPS: pendiente de verificar en Google Maps"
  echo "9 zonas: no activadas sin cobertura geográfica"
  echo "IA de clientes: PAUSADA"
}
apply_delibocados_approved_address
