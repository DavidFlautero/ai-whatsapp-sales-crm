# Delibocados — integración Toteat, despliegue seguro (9 noviembre 2026)

Estado: **implementación parcial protegida**, en rama de revisión. No enviar pedidos, pagos ni impresión automáticamente.

## Verificado en VPS (diagnóstico del propietario, 9/11)
- API del tenant configurada en **production**.
- GET /shiftstatus -> 200, ok:true.
- GET /products -> 200, 147 registros (incluye modificadores).
- Menú propio: 133 productos (127 + 6 bebidas retornables).
- `company_integrations` Toteat: `pending`, `enabled=false`.
- `restaurant_ops_pos_product_map`: 0 revisados.
- Cola de exportaciones: sin órdenes enviadas.
- Existe cola de tickets local; **no** prueba impresión física.
- No existe en el repositorio contrato validado para `document` de POST a Toteat, por lo que el transporte de escritura **NO se activa**.

## Componentes nuevos
1. `restaurant-toteat-catalog-map.service.ts`: coincidencia estricta por nombre normalizado, precio COP, y `localCode`. Rechaza modificadores, duplicados y precios ambiguos.
2. `delibocados-toteat-map-reconcile.ts`: GET de catálogo real y previsualización; `--stage` inserta propuestas `active=false`; `--approve` requiere revisión explícita.
3. `restaurant-toteat-status-sync.service.ts`: interpreta campos `orderReference`, `orderId`, `orderStatus` y `deliveryStatusId` de webhook Toteat; no inventa saltos de estado.
4. `/webhooks/delibocados-toteat/orders`: receptor de cabecera personalizada autenticada, limitado a IDs del restaurante/local y referencias de la integración; guarda eventos idempotentes en inbox.
5. Migración `20261109120000_delibocados_toteat_webhook_inbox.sql`: inbox duradera, RLS y claim atómico.
6. Worker de estados: desactivado salvo consentimiento explícito; requiere `company_integrations` conectado y una **exportación previamente aceptada con ID externo**. Usa la RPC transaccional existente para cambiar estado y emitir notificaciones, nunca registra pago o impresión.
7. `delibocados-toteat-export-dry-run.ts`: inspección de elegibilidad y consistencia sin enviar POST.

## Prueba de código (sin tocar producción)
Desde `/var/www/control/apps/api` con esta rama desplegada:
```bash
pnpm exec tsx --test \
  src/services/restaurant-ops/restaurant-toteat-catalog-map.test.ts \
  src/services/restaurant-ops/restaurant-toteat-status-sync.test.ts \
  src/services/restaurant-ops/restaurant-toteat-readonly.test.ts \
  src/services/restaurant-ops/restaurant-toteat-preparation.test.ts
pnpm exec tsc -p tsconfig.json --noEmit
```
Un fallo de tests o typecheck bloquea el despliegue. No reiniciar PM2 automáticamente.

## Mapeo de productos
Respetar límite de Toteat `/products`: máximo 3 solicitudes/minuto.
```bash
pnpm exec tsx src/scripts/delibocados-toteat-map-reconcile.ts
# Si da exactamente 133/133 y 0 conflictos:
pnpm exec tsx src/scripts/delibocados-toteat-map-reconcile.ts --stage
# Tras revisión humana de códigos, categorías y precios:
DELIBOCADOS_TOTEAT_MAPPING_APPROVE=REVIEWED_133 \
  pnpm exec tsx src/scripts/delibocados-toteat-map-reconcile.ts --approve
```
No aprobar a ciegas. Si alguno de los 133 no coincide, resolver el catálogo antes de activar.

## Migración de inbox (revisión y respaldo obligatorio)
Antes: instalar la migración existente `20261108190000`, hacer respaldo `pg_dump -Fc` y revisar esquema. La nueva SQL **no envía datos fuera de Supabase**.
```bash
docker exec -i <CONTENEDOR_SUPABASE_DB> psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/migrations/20261109120000_delibocados_toteat_webhook_inbox.sql
```
Sustituir contenedor/DB reales; verificar antes la instalación del proyecto y credenciales. El acceso a `psql` depende del despliegue.

## Seguridad del webhook
Toteat permite `Custom Headers` en los webhooks de `API Config → Pedidos`. Configurar un **secreto nuevo, independiente del token de Toteat**, en su panel y como variable privada del API. No copiarlo a GitHub.
- Cabecera: `X-Delibocados-Toteat-Secret`
- Variable de servidor: `DELIBOCADOS_TOTEAT_WEBHOOK_SECRET` (mínimo 32 caracteres aleatorios)
- `DELIBOCADOS_TOTEAT_WEBHOOK_ENABLED=1` habilita **únicamente recepción**. Default: deshabilitado.
- `DELIBOCADOS_TOTEAT_STATUS_SYNC_LIVE=1` habilita transiciones automáticas, pero SOLO después de integración conectada, exportación aceptada, y pruebas end-to-end. Default: deshabilitado.
- Ruta: `https://<DOMINIO_VERIFICADO_API>/webhooks/delibocados-toteat/orders`. Verificar la ruta efectiva de Nginx: puede tener prefijo `/api`.
- Toteat debe recibir HTTP 200 en menos de 3 segundos; el handler solo valida y persiste. Los eventos se deduplican.
- La cabecera no protege contra una filtración del servidor: habilitar HTTPS y control de acceso. No habilitar sin configurarla.
- No reintentar el envío de un pedido tras timeout sin conciliarlo primero con Toteat; prohibido duplicar órdenes.

## Estados Toteat
Los códigos documentados: 40 nuevo, 90 impresión reportada, 100 preparando, 110 listo, 120 repartiendo, 180 entregado; 170/172 cancelado, 175 no recibido, 200 recaudación.
Solo se sincronizan transiciones permitidas de una orden de Delibocados **aceptada por Toteat**:
- confirmed + 100 → preparing
- preparing + 110 → ready
- ready + 120 + repartidor ya asignado → out_for_delivery
- ready (pickup) + 180 → completed
- out_for_delivery + 180 → completed
No se actualiza `printed_at`, no se confirma pago y no se automatizan cancelaciones sin gestión humana.

## Bloqueos que permanecen
- **POST externo**: hace falta confirmar contrato exacto del objeto `document` con el OpenAPI del ambiente y permiso `Carga de Órdenes Externas`. La cuenta solo confirmó permiso de lectura, no escritura. Se conserva la cola de salida desactivada.
- **KDS**: se verifica en plan/pantalla del restaurante, no con GET /products.
- **Impresión real**: comprobar Print Server Windows y papel físico; `deliveryStatusId=90` por sí solo no constituye confirmación física.
- **Pagos**: `pending` no es ingreso bancario. Conciliar con pago real.
- **WhatsApp**: si el proveedor está suspendido, las notificaciones quedan separadas de los estados internos; no prometer entrega de mensajes.
- **Despliegue**: los commits en GitHub **no modifican** el VPS hasta instalar la rama, migración y reiniciar de manera controlada.

Fuente: https://developers.toteat.com/
