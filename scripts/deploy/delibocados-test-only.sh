#!/usr/bin/env bash
# Activar Delibocados SOLO para el testPhone cifrado de Whapi.
# Ejecutar: bash scripts/deploy/delibocados-test-only.sh
# No habilita bots públicos. No cambia otros tenants ni Nginx.
delibocados_test_only() {
  local stamp confirmed flags pid online
  stamp="$(date -u +%Y%m%d-%H%M%S)"
  printf '%s\n' '=== DELIBOCADOS / PRUEBA SOLO UN NUMERO ==='
  if [[ "$EUID" -ne 0 ]]; then
    echo "BLOQUEADO: ejecutar en la VPS como root"
    return 1
  fi
  if ! cd /var/www/control; then
    echo "BLOQUEADO: falta /var/www/control"
    return 1
  fi
  for bin in git pm2 pnpm curl node; do
    if ! command -v "$bin" >/dev/null 2>&1; then
      echo "BLOQUEADO: falta $bin"
      return 1
    fi
  done
  if [[ "$(git branch --show-current)" != "main" ]]; then
    echo "BLOQUEADO: producción no está en main"
    return 1
  fi
  if [[ ! -f /root/delibocados-ai.stop ]]; then
    echo "BLOQUEADO: el archivo de pausa no está presente. Revisar estado actual antes de activar."
    return 1
  fi
  if [[ ! -f apps/api/src/scripts/delibocados-verify-test-phone.ts ]]; then
    echo "BLOQUEADO: la versión de VPS no incluye la verificación de número"
    return 1
  fi
  if ! pm2 describe neuromind-api >/dev/null 2>&1; then
    echo "BLOQUEADO: neuromind-api no aparece en PM2"
    return 1
  fi
  if ! git merge-base --is-ancestor db21508ae35d74d9d270363c9ceddc24a29cd3be HEAD; then
    echo "BLOQUEADO: faltan los cambios de Restaurant OS de noviembre"
    return 1
  fi
  if [[ ! -t 0 ]]; then
    echo "BLOQUEADO: esta activación necesita confirmación humana en SSH interactivo"
    return 1
  fi

  echo "Confirmá tu número personal autorizado, NO el número del restaurante."
  read -r -p 'Últimos cuatro dígitos de TU WhatsApp: ' confirmed
  if [[ ! "$confirmed" =~ ^[0-9]{4}$ ]]; then
    echo "BLOQUEADO: ingresá exactamente cuatro dígitos"
    return 1
  fi
  if ! DELIBOCADOS_EXPECT_TEST_LAST4="$confirmed" \
       pnpm --filter @ventas/api exec tsx src/scripts/delibocados-verify-test-phone.ts; then
    echo "BLOQUEADO: preflight de Whapi, menú, migraciones o número de prueba no superado"
    return 1
  fi

  # Reiniciar primero CON la pausa puesta. No habilitar live de ninguna clase.
  if ! DELIBOCADOS_CHECKOUT_TEST=1 \
       DELIBOCADOS_ORDER_NOTIFICATIONS_TEST=1 \
       DELIBOCADOS_CHECKOUT_LIVE=0 \
       DELIBOCADOS_ORDER_NOTIFICATIONS_LIVE=0 \
       pm2 restart neuromind-api --update-env; then
    echo "BLOQUEADO: PM2 no pudo instalar el modo de prueba, IA sigue pausada"
    return 1
  fi
  flags="$(node - <<'JS'
const { execFileSync } = require("node:child_process");
const apps = JSON.parse(execFileSync("pm2",["jlist"],{encoding:"utf8"}));
const app = apps.find(x => x.name === "neuromind-api");
if (!app) {
  console.log("INVALID");
} else {
  const env=app.pm2_env || {};
  const good=env.status==="online" &&
    env.DELIBOCADOS_CHECKOUT_TEST==="1" &&
    env.DELIBOCADOS_ORDER_NOTIFICATIONS_TEST==="1" &&
    env.DELIBOCADOS_CHECKOUT_LIVE!=="1" &&
    env.DELIBOCADOS_ORDER_NOTIFICATIONS_LIVE!=="1";
  console.log(good ? "TEST_ONLY" : "INVALID");
}
JS
)"
  if [[ "$flags" != "TEST_ONLY" ]]; then
    echo "BLOQUEADO: PM2 no refleja aislamiento de prueba; IA sigue pausada"
    return 1
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
    echo "BLOQUEADO: API no responde /health después de los intentos; la IA sigue pausada"
    echo "Diagnóstico sin secretos: ss -ltnp | grep ':4000'; pm2 logs neuromind-api --lines 35 --nostream"
    return 1
  fi
  if ! mv /root/delibocados-ai.stop "/root/delibocados-ai.stop.before-test-$stamp"; then
    echo "BLOQUEADO: no se pudo levantar la pausa"
    return 1
  fi
  echo "=== PRUEBA ACTIVADA ==="
  echo "Respuestas IA: SOLO testPhone de Whapi, terminado en $confirmed"
  echo "Notificaciones de pedidos: SOLO testPhone"
  echo "Respuestas públicas: DESHABILITADAS"
  echo "REPAUSA INMEDIATA: touch /root/delibocados-ai.stop"
  echo "VER LOGS: pm2 logs neuromind-api --lines 80"
  echo "Primera prueba: enviá HOLA desde TU número autorizado al WhatsApp de Delibocados"
}
delibocados_test_only
