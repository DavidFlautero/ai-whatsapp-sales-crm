#!/usr/bin/env bash

cd /opt/ventas-ia-mayorista || exit 1

set -a
source /opt/ventas-ia-mayorista/.env
set +a

exec node \
  /opt/ventas-ia-mayorista/apps/api/dist-hardened/scripts/run-catalog-media-monitor.js
