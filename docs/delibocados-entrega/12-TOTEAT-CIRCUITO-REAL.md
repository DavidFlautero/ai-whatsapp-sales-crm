# Delibocados — WhatsApp → Toteat → cocina / impresión / seguimiento

## Antecedente de campo (no repetir)
- La orden técnica *Chicharrón Porción / DB1132 / COP 8.001* fue creada en Toteat tras el POST del 10/11/2026 04:13 UTC (HTTP 200, recibo inicial inconcluso).
- El dueño la encontró y **la canceló**.
- Por lo tanto: **POST a Toteat acreditado por testimonio del dueño**; **NO** hay confirmación de impresión física, número ID exacto o flujo desde el CRM.
- La referencia `delibocados-prueba-ed4a6223-32f2-4353-8a4d-cc9e69bb3a72` está preservada en el journal de pruebas. **Nunca borrar ni repetir ese POST**.

## Código nuevo (rama de pruebas; NO producción)
1. `restaurant-toteat-receipt.service.ts`: maneja IDs enteros de 16+ dígitos como texto; HTTP 200 sin orderId no equivale a `accepted`.
2. `restaurant-toteat-order-client.service.ts`: POST único; si inconcluso, un GET de órdenes abiertas por referencia, sin segundo POST.
3. `restaurant-toteat-order-payload.service.ts`: documento con líneas y precios registrados, efectivo pendiente, transferencia verificada o mixto conciliado. El cargo de domicilio requiere SKU exacto en Toteat.
4. `restaurant-toteat-export-worker.service.ts`: consulta la cola `restaurant_ops_pos_exports` y prepara pedidos `source=whatsapp`, **solo nuevos** y con pago elegible. Valida turno, menú local actual, /products, IDs y totales. Requiere flags opt-in + integración habilitada.
5. `20261110210000_delibocados_toteat_controlled_export_claim.sql`: nuevo claim RPC con cutoff obligatorio, modo piloto un solo UUID, filtrado de domicilios y lease global de 30 s. No vuelve a enviar una orden con attempts=1.
6. `index.ts`: inicializa worker **apagado por defecto**; el resto de la API sigue igual.
7. `delibocados-toteat-kitchen-audit.ts`: verifica en modo read-only órdenes del CRM aceptadas, consulta `GET /orderstatus?ic=`, compara referencia e ID, muestra estado interno, ticket y **separa señal Toteat de impresión de prueba física**.
8. Nuevos tests de POST, doble envío, importe/copago, duplicados de respuesta, control de rollout y precios.

## Dependencias para que opere

### VPS
1. Hacer backup `pg_dump -Fc` y revisar las migraciones; confirmar instalada la migración previa `20261108190000`.
2. Validar rama en worktree, typecheck, tests, panel build. No hacer `git pull` en `/var/www/control` ni reiniciar PM2 sin release aprobado.
3. Instalar la **nueva migración** en BD con el procedimiento de release existente.
4. Desplegar el commit aprobado en API mediante release atómico y mantener todos los flags apagados.
5. Confirmar conexión Whapi del `testPhone` y que el turno Toteat esté abierto.

### Restaurante
1. Propietario confirma que la API en Toteat tiene permiso **Carga de Órdenes Externas** y que la prueba del Chicharrón se anuló en el POS. La evidencia de la orden cancela la duda sobre la creación, pero no resuelve la impresión.
2. Verificar que Print Server Windows está **conectado al Toteat correcto**, no sólo que imprime páginas de prueba.
3. Una persona debe observar si sale papel con la referencia del pedido **nuevo**.
4. Para delivery, verificar cuál SKU real de Toteat representa el **cargo de domicilio**. Si no existe SKU a la tarifa de la zona, dejar delivery desactivado. Nunca omitir cargos.
5. Configurar webhook de estados, HTTPS y cabecera compartida, desplegar inbox `20261109120000` y worker de estados. Una orden `accepted` es prerrequisito para cambiar estado.

## Flags de activación (NO copiarlos a PM2 sin autorización)

```dotenv
# default OFF
DELIBOCADOS_TOTEAT_ORDER_EXPORT=0
DELIBOCADOS_TOTEAT_EXPORT_ACK=
DELIBOCADOS_TOTEAT_EXPORT_ONLY_ORDER_ID=
DELIBOCADOS_TOTEAT_EXPORT_CUTOVER=
DELIBOCADOS_TOTEAT_EXPORT_PUBLIC=0
DELIBOCADOS_TOTEAT_DELIVERY_ENABLED=0
DELIBOCADOS_TOTEAT_DELIVERY_FEE_CODE=
DELIBOCADOS_TOTEAT_WEBHOOK_ENABLED=0
DELIBOCADOS_TOTEAT_STATUS_SYNC_LIVE=0
DELIBOCADOS_ORDER_NOTIFICATIONS_TEST=0
DELIBOCADOS_ORDER_NOTIFICATIONS_LIVE=0
DELIBOCADOS_CHECKOUT_LIVE=0
```

**Piloto:** habilitar **UNA orden WhatsApp creada luego del cutoff**, con el UUID exacto en `DELIBOCADOS_TOTEAT_EXPORT_ONLY_ORDER_ID`, `DELIBOCADOS_TOTEAT_ORDER_EXPORT=1`, confirmación `DELIBOCADOS_TOTEAT_EXPORT_ACK=OWNER_AUTHORIZED_REAL_ORDERS`, `company_integrations.toteat` conectado y habilitado por dueño. Dejar `EXPORT_PUBLIC=0`. Reiniciar API por release supervisado; worker toma máximo una orden elegible por claim. El modo piloto impide sacar pedidos de otros clientes.

**Público:** sólo tras prueba de papel + pagos + idempotencia + conciliación de webhooks y aceptación del dueño; el cutoff debe ser el instante de lanzamiento para evitar reenviar pedidos viejos. Dejar `EXPORT_ONLY_ORDER_ID` vacío y habilitar `EXPORT_PUBLIC=1` explícitamente. No hacerlo desde el chat.

## Resultado esperado de un único pedido real

1. WhatsApp de prueba crea draft (no orden aún), confirma precio y pago.
2. `CONFIRMAR PEDIDO` → orden SQL con `source_key=wa-...` y 1 fila en `restaurant_ops_pos_exports`.
3. Worker obtiene el pedido único y lo prepara; `POST /orders` a Toteat.
4. Recibo con ID exacto o match de `orderReference` en GET abiertos → `accepted`. Si no hay prueba: `unknown`, SIN retry.
5. Dueño ve orden en Toteat; cocina observa impresión física (o marca falta).
6. Webhook autenticado pasa estado `preparing` / `ready` al CRM; no atribuir un papel a un timestamp DB.
7. Notificaciones se emiten por los cambios **reales** y sólo al teléfono de prueba si así está configurado.

## Comandos de comprobación SIN envíos

```bash
cd /root/delibocados-toteat-review-20261109
git fetch origin feature/delibocados-toteat-safe-integration-20261109
git switch --detach FETCH_HEAD
pnpm --filter @ventas/api typecheck
pnpm --filter @ventas/api exec tsx --test \
 src/services/restaurant-ops/restaurant-toteat-receipt.test.ts \
 src/services/restaurant-ops/restaurant-toteat-order-payload.test.ts \
 src/services/restaurant-ops/restaurant-toteat-order-client.test.ts \
 src/services/restaurant-ops/restaurant-toteat-export-worker.test.ts
cd apps/api
pnpm exec tsx src/scripts/delibocados-toteat-export-dry-run.ts
pnpm exec tsx src/scripts/delibocados-toteat-kitchen-audit.ts
```

Todos los tests/mock son locales. El audit hace sólo consultas GET, no POST.

## No confundir
- **Código escrito y CI verde**: no equivale a despliegue.
- **Toteat HTTP 200**: no prueba ID de orden ni papel por sí solo.
- **Toteat `deliveryStatusId=90`**: reporta impresión de cocina, no observación del papel.
- **Whapi timeout**: no equivale a credenciales inválidas; debe recuperar salud de canal.
- **Entrega real**: requiere repato, zonas, conductor, pago, pruebas, no está cerrada todavía.
