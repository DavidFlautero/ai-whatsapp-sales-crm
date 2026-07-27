#!/usr/bin/env bash
set -e

echo "== Doctor Ventas IA =="

test -f package.json && echo "OK package.json"
test -f apps/api/package.json && echo "OK api package"
test -f apps/api/src/index.ts && echo "OK api entry"
test -f .env.example && echo "OK env example"

echo "Folders:"
ls apps
ls packages

echo "Done."
