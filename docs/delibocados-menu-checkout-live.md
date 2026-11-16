# Delibocados menú café — checkout público

## Qué hace
- Conserva carta.html y el diseño café. Sustituye únicamente el comportamiento de `button.disabled-submit`.
- Usa POST /public/delibocados-qr/context y /order, ya publicados en Nginx.
- Recupera productos y precios del catálogo oficial de PostgreSQL.
- Crea pedidos de **retiro** en `restaurant_ops_orders` usando `restaurant_ops_create_order`, con validación de menú y precio, ticket interno de cocina, evento y outbox.
- Forma de pago: efectivo por cobrar o transferencia pendiente de verificación. No realiza cargos ni marca transferencias pagadas.
- Domicilio: exige `quoteVerifiedDeliveryAddress` (GPS verificado, geocoding y zonas activas). Si la geografía está desactivada, no admite órdenes de entrega.
- Mesa QR: se mantiene autenticación segura por UUID/token; sin QR validado no acepta pedidos de mesa.
- No envía a Toteat/POS360, no imprime en SmartPOS ni envía WhatsApp. Estos canales requieren integración y pruebas independientes.

## Despliegue controlado

```bash
cd /var/www/control
git fetch origin feature/delibocados-menu-live-checkout-20261113
git show FETCH_HEAD:apps/api/src/routes/restaurant-qr-public.routes.ts > /tmp/delibocados-menu-checkout-route.ts
git show FETCH_HEAD:scripts/delibocados/menu-checkout-live.js > /tmp/delibocados-menu-checkout.js
git show FETCH_HEAD:scripts/deploy/delibocados-web-checkout-apply.sh > /tmp/delibocados-web-checkout-apply.sh
bash -n /tmp/delibocados-web-checkout-apply.sh
bash /tmp/delibocados-web-checkout-apply.sh --check
bash /tmp/delibocados-web-checkout-apply.sh --apply
```

Si falla `typecheck` o el smoke HTTP, se recupera el HTML y el código API original. Al reiniciar se deshabilita el checkout público. No se crean pedidos de prueba automáticamente.

## Prueba manual

1. Abrir `https://delibocados.online/menu` en ventana privada y seleccionar `Retiro`.
2. Agregar un producto disponible, ingresar nombre y teléfono, seleccionar efectivo, confirmar casilla.
3. Confirmar una sola vez. Debe recibir número de pedido y total desde el backend.
4. El administrador debe comprobar ese número en `https://panel.delibocados.online/panel/pedidos` y en cocina. El ticket interno no significa impresión física.
5. Si falla el carrito, no repetir al azar; anotar el mensaje del checkout y verificar el formato de `delibocados-v2-cart`.

## Seguridad y límites
- Flag público independiente `DELIBOCADOS_WEB_CHECKOUT_ENABLED=1`. La ruta QR antigua mantiene su propio flag.
- Sin precios ni costos de domicilio procedentes del navegador.
- Límite por IP de 3 pedidos/minuto en memoria; requiere protección adicional antes de alto tráfico.
- Una caída de red posterior al envío puede dejar estado incierto; la UI bloquea reintentos automáticos.
- Los enlaces QR antiguos no se consideran enlazados al registro seguro.
- Publicar la carta desde el editor Python podría regenerar `carta.html` y quitar el adaptador; se debe integrar en el publicador antes de dar el trabajo por definitivo.
