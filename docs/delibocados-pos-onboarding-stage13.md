# Delibocados — integración sincronizada / preparación (etapa 13)

## Objetivo real

Preparar de forma segura el registro empresarial de **Toteat** y **POS360**,
centralizar el control de la cola, exportar catálogo para revisión y permitir
cargar las credenciales Toteat cifradas **sin activar ningún envío**.

El código no afirma que colocar una API key haga funcionar un POS. El transporte
Toteat, la estructura POST validada, el puente Windows de POS360, la comprobación
de impresión y el mapeo del catálogo real todavía dependen de accesos del
restaurante o de documentación del proveedor.

## Comandos en la VPS

En `root@neuromind33:/var/www/control`, después de fusionar y actualizar
`main`:

```bash
pnpm --filter @ventas/api exec tsx src/scripts/delibocados-pos-onboarding.ts prepare
pnpm --filter @ventas/api exec tsx src/scripts/delibocados-pos-onboarding.ts status
pnpm --filter @ventas/api exec tsx src/scripts/delibocados-pos-onboarding.ts catalog-template
```

- `prepare`: solo inserta las integraciones que FALTAN en
  `company_integrations`, con `status=pending`, `enabled=false`. Nunca cambia
  registros existentes ni declara conexiones verificadas.
- `status`: consulta integraciones, indicadores de secretos cifrados,
  vinculación con producto del menú, outboxes y estado QR; **no ve** los secretos
  ni llama a proveedores. `secreto cifrado almacenado=SI` no es evidencia de
  autenticación, permiso para escribir pedidos o conectividad.
- `catalog-template`: genera CSV privados modo 0600 bajo
  `/root/backups/delibocados-pos-onboarding/`. Solo contiene IDs locales;
  `external_product_code` vacío a propósito. El personal debe revisar el
  catálogo real de Toteat y POS360 antes de importar códigos al SQL.
  Una segunda ejecución con la misma revisión del menú bloquea sobrescribir
  las plantillas (seguridad).

## Cuando el administrador entrega las credenciales Toteat

Iniciar en una terminal interactiva de la VPS (NO en el chat):

```bash
pnpm --filter @ventas/api exec tsx src/scripts/delibocados-pos-onboarding.ts toteat-key
```

El asistente recibe ambiente `development`/`production`,
`restaurantId`, `localNumber`, `userId` y `apiToken` mediante entrada
oculta. La configuración JSON se cifra usando el repositorio ya existente
`company-secret.repository.ts` con clave maestra del servidor; se verifica
que pueda descifrarse en memoria, nunca se imprime el contenido.

**Requisito**: `COMPANY_INTEGRATION_MASTER_KEY_HEX` o
`INTEGRATIONS_MASTER_KEY` debe estar configurada para ejecutar el asistente;
no crear claves nuevas sin un plan de persistencia y respaldo.

Después se puede ejecutar el diagnóstico **GET-only**, expresamente opt-in:

```bash
DELIBOCADOS_TOTEAT_READONLY_PROBE=1 \
  pnpm --filter @ventas/api exec tsx src/scripts/delibocados-toteat-readiness.ts
```

El registro de Toteat continúa `pending/disabled` aun después del éxito.

## Lo que continúa pendiente para integración real

1. **Toteat**: permiso Carga de Órdenes Externas, especificación de POST y
   respuesta del `document` verificada, referencia idempotente y conciliación,
   mapeo revisado de cada producto, estado de la sede y señal de impresión.
2. **POS360**: definir protocolo soportado por Windows/SmartPOS (API, plugin,
   bridge autorizado), servicio local seguro, heartbeat y recepción/impresión
   auditada. Sin especificación confirmada no crear falsas peticiones HTTP ni
   manipular MySQL directamente.
3. **QR**: sincronizar mesas del editor con
   `restaurant_ops_qr_tables`, generar QR tokenizados y reimprimir si se requiere,
   validar en dispositivos reales, y habilitar `DELIBOCADOS_QR_CHECKOUT_ENABLED`
   únicamente después de probar la cadena con el POS.
4. **Pagos**: conciliación entre efectivo realmente recibido y estado del
   pedido; el histórico #1 `cash_on_delivery` NO prueba cobro.
5. **Domicilios**: validar API Google Maps, coordenadas del local y polígonos de
   las nueve zonas antes de automatizar cálculo.

**Nunca activar por este paso** IA pública, API de pedidos QR, envío real POS,
auto-reintentos ni mensajes masivos.
