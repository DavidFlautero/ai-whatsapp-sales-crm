# Delibocados — checkout QR en carta.html

## Estado
El checkout QR seguro ya existe en API puerto 4000:
- POST /public/delibocados-qr/context
- POST /public/delibocados-qr/order

Nginx YA tiene publicadas estas rutas exactas en el virtual host HTTPS
para delibocados.online. NO introducir un proxy /qr-checkout/.

El instalador agrega al final de /var/www/delibocados-public/carta.html un
adaptador JavaScript que verifica QR/mesa, solicita nombre y teléfono, compara
carrito con el menú oficial, y llama al checkout interno. No cambia Nginx.

## Instalación (sin habilitar pedidos públicos)

Desde /var/www/control obtener LOS DOS archivos nuevos desde la rama:
feature/delibocados-qr-checkout-frontend-20261112

  git fetch origin feature/delibocados-qr-checkout-frontend-20261112
  mkdir -p scripts/delibocados
  git show FETCH_HEAD:scripts/delibocados/qr-checkout.js > scripts/delibocados/qr-checkout.js
  git show FETCH_HEAD:scripts/delibocados/install-qr-checkout.sh > scripts/delibocados/install-qr-checkout.sh
  bash -n scripts/delibocados/install-qr-checkout.sh
  bash scripts/delibocados/install-qr-checkout.sh --check
  bash scripts/delibocados/install-qr-checkout.sh --apply

La comprobación de API usa POST con JSON {} que no puede crear pedidos y
espera 503 QR_CHECKOUT_NOT_ENABLED, 400 INVALID_INPUT o 429 QR_RATE_LIMIT.
El HTML se modifica SOLO después de superar la comprobación. Si falla la
verificación del HTML, se restaura el respaldo.

Respaldo: /var/backups/delibocados-qr-checkout-<TIMESTAMP>/carta.html.
La versión anterior se restaura copiando ese archivo a la ruta original.

## Comprobaciones antes de habilitar operaciones

1. Migraciones QR 20261108210000 y 20261108213000 deben estar instaladas.
2. Ejecutar:
   pnpm --filter @ventas/api exec tsx src/scripts/delibocados-qr-readiness.ts
3. Se observaron 16 mesas QR activas pero el plano local tiene 16 mesas y
   4 barras. Las barras aún requieren vinculación verificada si se usan por QR.
4. Corroborar que token QR, UUID de mesa del editor y UUID de
   restaurant_ops_qr_tables coincidan. Un 200 en editor no lo demuestra.
5. Asegurar que el catálogo público coincide con IDs o nombre/precio únicos
   del catálogo oficial. Productos no resueltos deben bloquear pedido.
6. Solo tras pruebas de extremo a extremo habilitar
   DELIBOCADOS_QR_CHECKOUT_ENABLED=1 en la API; no se activa aquí.
7. Probar idempotencia, pagos y ticket interno antes de anunciar pedidos online.
8. POS360/SmartPOS NO está integrado: el informe de preparación indicó cero
   mapeos, integración pending/false y puente Windows sin verificar.
   Un pedido interno confirmado no implica impresión física.

## Prueba de un QR impreso existente (sin exponer el token)

La API antigua del editor responde 200 con `tables: []`, mientras que el
registro de checkout tiene 16 mesas habilitadas. El editor Python y el checkout
no se consideran sincronizados por ese resultado.

Para verificar si el QR físico de Mesa 4 es reutilizable:

  git fetch origin feature/delibocados-qr-checkout-frontend-20261112
  git show FETCH_HEAD:apps/api/src/scripts/delibocados-qr-token-check.ts > apps/api/src/scripts/delibocados-qr-token-check.ts
  read -rs -p 'Pega la URL del QR de Mesa 4: ' QR_URL; echo
  printf '%s' "$QR_URL" | pnpm --filter @ventas/api exec tsx src/scripts/delibocados-qr-token-check.ts
  unset QR_URL

El script compara SHA-256 con las 16 mesas activas; no imprime enlace, token ni
hash. No se crean pedidos ni se cambian datos. Si no coincide el token, NO
activar pedidos: se necesita emitir nuevos QR seguros.

El adaptador actualizado también permite el formato de QR independiente del
editor antiguo:

  https://delibocados.online/menu#kind=table&tableId=<UUID>&token=<token-opaco>

Los tokens de esa URL deben ser secretos, aleatorios de 32+ caracteres y el
hash debe estar registrado en la tabla checkout. Nunca insertar claves reales
en Git o chats.
