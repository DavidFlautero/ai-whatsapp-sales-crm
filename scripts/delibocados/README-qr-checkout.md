# Delibocados: checkout QR de mesa — instalacion controlada

## Alcance

La pagina de produccion esta fuera del repositorio, en:
  /var/www/delibocados-public/carta.html

El instalador no reemplaza la carta. Inyecta el adaptador directamente en el HTML y crea
copias de seguridad de HTML y Nginx antes de modificar produccion.

El adaptador de navegador:
- Solo habilita el checkout para QR de mesa con token opaco verificado.
- Espera el UUID de mesa proporcionado por el editor QR existente.
- Hace POST /qr-checkout/context para validar mesa y menu.
- Envia IDs de productos del menu verificado, revision, telefono y metodo de pago.
- Usa sourceKey UUID estable para prevenir pedidos duplicados en reintentos.
- Hace POST /qr-checkout/order; muestra el numero de pedido solo al recibir
  respuesta confirmada del backend.
- No promete envio a SmartPOS ni impresion fisica.
- Mantiene el pedido directo, retiro y domicilio deshabilitados.

## Instalar frontend y proxy (NO habilita checkout publico)

Copiar estos dos archivos de la rama de trabajo al directorio del servidor:
  scripts/delibocados/qr-checkout.js
  scripts/delibocados/install-qr-checkout.sh

Desde la VPS:
  cd /var/www/control
  bash scripts/delibocados/install-qr-checkout.sh --check
  bash scripts/delibocados/install-qr-checkout.sh --apply

Se crea el respaldo en /var/backups/delibocados-qr-checkout-TIMESTAMP. No requiere una URL adicional para servir el JavaScript.
Se verifica la sintaxis de Nginx y la disponibilidad del HTML y la API QR antes de finalizar. Si falla, revierte.

## Prerequisitos para habilitar pedidos de verdad

1. Verificar instaladas las migraciones:
   20261108210000_restaurant_qr_checkout_foundation
   20261108213000_restaurant_pos360_export_queue

2. Ejecutar chequeo sin modificar la base:
   cd /var/www/control
   pnpm --filter @ventas/api exec tsx src/scripts/delibocados-qr-readiness.ts

3. Verificar 20 mesas QR activas, mapeadas a 16 mesas y 4 barras. Los
   registros UUID y hashes de token en restaurant_ops_qr_tables deben
   corresponder con los QR del editor del puerto 3500. HTTP 200 en
   /restaurant-qr/tables no prueba esta correspondencia.

4. Comprobar que el menu publico y el documento de menu oficial comparten
   IDs de productos o nombres/precios unicos y equivalentes.

5. Activar la variable DELIBOCADOS_QR_CHECKOUT_ENABLED=1 solo tras los
   chequeos anteriores y una prueba de backend. El instalador NO lo hace.
   Probar respuesta de context y de order con una mesa autorizada.

6. Revisar en panel que una misma sourceKey no genere dos pedidos.
   Transferencia debe quedar pendiente de verificacion. Confirmar que la
   cocina recibe ticket interno y que el pago en efectivo no se registra
   como cobrado hasta que el encargado lo confirme.

7. SmartPOS/POS360: la base SOLO genera una exportacion pendiente; falta
   transporte Windows y prueba de impresora. No se debe afirmar que se
   imprimio ni que SmartPOS recibio un pedido.

## Reversion

Recuperar desde la ruta de respaldo indicada:
  cp -a /var/backups/RUTA/carta.html /var/www/delibocados-public/carta.html
  cp -a /var/backups/RUTA/delibocados-online.conf /etc/nginx/conf.d/delibocados-online.conf
  nginx -t && systemctl reload nginx

El adaptador va dentro de carta.html; restaurar HTML y Nginx alcanza para deshacer esta instalacion. Un recurso JS residual de instalaciones previas puede quedar en disco sin ser servido.

## API existente

POST /public/delibocados-qr/context
POST /public/delibocados-qr/order

Nginx agrega el proxy publico /qr-checkout/ a la API local 4000.
El backend conserva control de token, mesa, revision, precios e idempotencia.
