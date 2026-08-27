#!/usr/bin/env bash
set -Eeuo pipefail

cd /opt/ventas-ia-mayorista

set -a
test -f .env && source .env
source apps/voice-worker/.env.voice-pro
set +a

export PYTHONPATH=/opt/ventas-ia-mayorista/apps/voice-worker

exec /opt/ventas-ia-mayorista/apps/voice-worker/.venv/bin/python \
  -m uvicorn \
  voice_worker.pro.server:app \
  --host "${VOICE_HOST:-127.0.0.1}" \
  --port "${VOICE_PORT:-4200}" \
  --workers 1 \
  --no-access-log
