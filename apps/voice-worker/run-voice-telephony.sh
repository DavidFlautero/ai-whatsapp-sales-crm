#!/usr/bin/env bash
set -Eeuo pipefail

cd /opt/ventas-ia-mayorista

set -a
test -f .env && source .env
source apps/voice-worker/.env.voice-pro
set +a

export PYTHONPATH=/opt/ventas-ia-mayorista/apps/voice-worker

exec /opt/ventas-ia-mayorista/apps/voice-worker/.venv/bin/python \
  -m voice_worker.pro.telephony_gateway
