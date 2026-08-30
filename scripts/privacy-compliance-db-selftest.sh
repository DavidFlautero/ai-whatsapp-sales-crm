#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(
  cd "$(dirname "${BASH_SOURCE[0]}")" &&
  pwd
)"

SQL_FILE="$SCRIPT_DIR/privacy-compliance-db-selftest.sql"

DB_NAME="${PRIVACY_TEST_DB_NAME:-}"
DB_USER="${PRIVACY_TEST_DB_USER:-postgres}"
DB_CONTAINER="${PRIVACY_TEST_DB_CONTAINER:-}"

if test -z "$DB_NAME"; then
  echo "ERROR=PRIVACY_TEST_DB_NAME_REQUERIDA"
  exit 1
fi

if ! printf '%s' "$DB_NAME" |
  grep -qE \
    '^privacy_compliance_test_[0-9]{8}_[0-9]{6}$'
then
  echo "ERROR=SOLO_SE_PERMITEN_BASES_DE_PRUEBA"
  exit 1
fi

if ! test -s "$SQL_FILE"; then
  echo "ERROR=SQL_DINAMICO_NO_ENCONTRADO"
  exit 1
fi

LOG_FILE="$(mktemp)"

cleanup() {
  rm -f "$LOG_FILE"
}

trap cleanup EXIT

run_psql() {
  if test -n "$DB_CONTAINER"; then
    docker exec -i \
      "$DB_CONTAINER" \
      psql \
      -X \
      -U "$DB_USER" \
      -d "$DB_NAME" \
      "$@"
  else
    psql \
      -X \
      -d "$DB_NAME" \
      "$@"
  fi
}

ACTIVE_DATABASE="$(
  run_psql \
    -Atqc \
    "select current_database();" \
    2>/dev/null
)"

if test "$ACTIVE_DATABASE" != "$DB_NAME"; then
  echo "ERROR=BASE_ACTIVA_NO_COINCIDE"
  exit 1
fi

ROWS_BEFORE="$(
  run_psql \
    -Atqc \
    "select count(*)
     from public.privacy_requests;" \
    2>/dev/null
)"

set +e

run_psql \
  -v ON_ERROR_STOP=1 \
  < "$SQL_FILE" \
  > "$LOG_FILE" 2>&1

TEST_STATUS=$?

set -e

cat "$LOG_FILE"

PASS_COUNT="$(
  grep -oE \
    'TEST_[A-Z0-9_]+=PASS' \
    "$LOG_FILE" |
  sort -u |
  wc -l |
  tr -d ' '
)"

ROWS_AFTER="$(
  run_psql \
    -Atqc \
    "select count(*)
     from public.privacy_requests;" \
    2>/dev/null
)"

DUAL_CONTROL_PASS=0

if grep -Fq \
  'TEST_DUAL_CONTROL=PASS' \
  "$LOG_FILE"
then
  DUAL_CONTROL_PASS=1
fi

echo "DYNAMIC_TEST_STATUS=$TEST_STATUS"
echo "DYNAMIC_TESTS_PASS=$PASS_COUNT"
echo "DUAL_CONTROL_PASS=$DUAL_CONTROL_PASS"
echo "ROWS_BEFORE=$ROWS_BEFORE"
echo "ROWS_AFTER=$ROWS_AFTER"

if test "$TEST_STATUS" -ne 0; then
  echo "RESULTADO_DB_SELFTEST=FALLO_SQL"
  exit 1
fi

if test "$PASS_COUNT" -ne 12; then
  echo "RESULTADO_DB_SELFTEST=PRUEBAS_INCOMPLETAS"
  exit 1
fi

if test "$DUAL_CONTROL_PASS" -ne 1; then
  echo "RESULTADO_DB_SELFTEST=CONTROL_DUAL_NO_VALIDADO"
  exit 1
fi

if test "$ROWS_BEFORE" != "$ROWS_AFTER"; then
  echo "RESULTADO_DB_SELFTEST=ROLLBACK_NO_CONFIRMADO"
  exit 1
fi

echo "RESULTADO_DB_SELFTEST=OK"
echo "PRUEBAS_DINAMICAS=12_DE_12"
echo "TRANSACCION_REVERTIDA=SI"
