#!/usr/bin/env bash

cd /opt/ventas-ia-mayorista || exit 1

echo "===== TYPECHECK ====="

pnpm --filter @ventas/api typecheck || {
  echo "❌ typecheck falló"
  exit 1
}

echo "✅ typecheck OK"

echo
echo "===== BUILD DIST ====="

rm -rf apps/api/dist

pnpm --filter @ventas/api exec tsc \
  -p tsconfig.json \
  --noEmit false \
  --outDir dist \
  --sourceMap false \
  --declaration false || {
    echo "❌ build falló"
    exit 1
  }

echo "✅ dist generado"

echo
echo "===== PREPARAR HARDENED ====="

rm -rf apps/api/dist-hardened

cp -a \
  apps/api/dist \
  apps/api/dist-hardened || exit 1

echo "✅ copia hardened creada"

cd apps/api || exit 1

echo
echo "===== HARDENING ====="

pnpm exec terser \
  dist/services/runtime/core-state.service.js \
  --module \
  --compress passes=2 \
  --mangle toplevel \
  --comments false \
  --output dist-hardened/services/runtime/core-state.service.js \
  || exit 1

pnpm exec terser \
  dist/routes/whatsapp.routes.js \
  --module \
  --compress passes=2 \
  --mangle toplevel \
  --comments false \
  --output dist-hardened/routes/whatsapp.routes.js \
  || exit 1

pnpm exec terser \
  dist/services/agent/sales-agent.service.js \
  --module \
  --compress passes=2 \
  --mangle toplevel \
  --comments false \
  --output dist-hardened/services/agent/sales-agent.service.js \
  || exit 1

pnpm exec terser \
  dist/services/vision/product-vision.service.js \
  --module \
  --compress passes=2 \
  --mangle toplevel \
  --comments false \
  --output dist-hardened/services/vision/product-vision.service.js \
  || exit 1

pnpm exec terser \
  dist/services/learning/conversation-learning.service.js \
  --module \
  --compress passes=2 \
  --mangle toplevel \
  --comments false \
  --output dist-hardened/services/learning/conversation-learning.service.js \
  || exit 1

pnpm exec terser \
  dist/services/catalog/catalog.repository.js \
  --module \
  --compress passes=2 \
  --mangle toplevel \
  --comments false \
  --output dist-hardened/services/catalog/catalog.repository.js \
  || exit 1

pnpm exec terser \
  dist/services/ninox/ninox-catalog-search.service.js \
  --module \
  --compress passes=2 \
  --mangle toplevel \
  --comments false \
  --output dist-hardened/services/ninox/ninox-catalog-search.service.js \
  || exit 1

echo
echo "✅ HARDENING COMPLETO"

echo
echo "===== LIMPIEZA HARDENED ====="

rm -f \
  /opt/ventas-ia-mayorista/apps/api/dist-hardened/scripts/license-selftest.js

echo "✅ archivos internos de diagnóstico removidos"
