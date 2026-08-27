#!/usr/bin/env bash
set -Eeuo pipefail

MIN_AVAILABLE_MB="${VOICE_MIN_AVAILABLE_MB:-220}"
AVAILABLE_MB="$(
  awk '/MemAvailable:/ {print int($2 / 1024)}' /proc/meminfo
)"

echo "RAM_DISPONIBLE_MB=$AVAILABLE_MB"

if test "$AVAILABLE_MB" -lt "$MIN_AVAILABLE_MB"; then
  echo "VOICE_RESOURCES=CRITICAL"
  exit 2
fi

echo "VOICE_RESOURCES=OK"
