# Delibocados: IA conversacional -> Toteat -> cocina -> repartidores

## Responsabilidades

- La IA conversa de forma natural y decide cuándo consultar menú, carrito, cobertura, pagos o estado.
- El backend valida catálogo, variantes, cantidades, precio y domicilio. El cliente confirma el total antes de guardar un pedido.
- Efectivo pendiente de recaudo no es dinero cobrado. La transferencia se revisa con movimiento bancario; una captura no confirma pago.
- El POS Toteat es el destino transaccional de los pedidos confirmados. Un webhook de Toteat y su Print Server gestionan recepción, comanda y estados de cocina.
- El CRM/WhatsApp notifica únicamente eventos corroborados y registra idempotencia para impedir pedidos duplicados.

## Evidencia de la API oficial

Documentación actual: https://developers.toteat.com/

- URL base recomendada de producción: https://api.toteat.com/mw/or/1.0/
- URL base recomendada de desarrollo: https://apidev.toteat.com/mw/or/1.0/
- Toteat permite Carga de Órdenes Externas, consulta de estados y webhooks de pedidos.
- Se debe habilitar Configuración > Print Server & API > API Config > Pedidos > Carga de Órdenes Externas, establecer origen, permisos y delivery.
- Toteat exige token de API y los IDs de restaurante, local y usuario; configurarlos en secretos del tenant en VPS, no en un chat.
- La creación de orden incluye restaurantId, localNumber, orderReference, type, channel, comment y document. La estructura completa de document y los identificadores de producto deben verificarse con el OpenAPI oficial y el menú real antes de generar un POST.
- Para los productos se requiere sincronización con el catálogo Toteat y mapeo de ID de nuestro menú al ID del POS; nunca asumir que los IDs internos son equivalentes.
- Asegurar la referencia idempotente orderReference usando el UUID de nuestro pedido. Un timeout requiere consulta/conciliación antes de reintento.
- Límite documentado: un envío de orden por segundo.
- Los webhooks requieren HTTPS, confirmación HTTP 200 rápida, autenticación y procesamiento idempotente.
- La impresión física depende del Print Server y de impresoras de la sede; no se debe informar comanda impresa sin la señal real.

## Estados para la integración (diseño, no código desplegado)

1. confirmed_local: pedido grabado y confirmado; no implica envío a Toteat.
2. waiting_payment: transferencia sin confirmar; no enviar a cocina.
3. pending_export: validación de precios y mapeo de productos Toteat, un solo pedido por referencia.
4. sending: worker de salida toma el pedido de una cola atómica.
5. unknown: timeout; conciliar con Toteat antes de reenviar.
6. accepted: respuesta de Toteat con orden identificada; listo para operación POS.
7. printed / preparing / ready: estados solo observados en Toteat/Print Server.
8. delivered / failed / incident: avisos, repartidor y auditoría.

## Situación real a noviembre de 2026

El repositorio actual contiene pedido local y comanda interna, pero NO tiene cliente exportador Toteat funcionando ni verificación de impresión física. No se debe afirmar que el POS recibió pedidos. El próximo desarrollo debe añadir un conector de salida con outbox idempotente, catálogo sincronizado y webhooks autenticados.

## Pruebas supervisadas

- Primero: conversación inteligente con el único testPhone (sin difusión pública).
- Segundo: pedido en Toteat desarrollo, o en entorno real de prueba autorizado, sin duplicados.
- Tercero: impresión de ticket físico confirmada en la sede y actualización de estados.
- Después, tres ventas reales una por una y bajo supervisión humana. Habilitación pública solo tras cada revisión.
## Avance en código — outbox durable (2026-11-08)

Migración nueva: `supabase/migrations/20261108190000_delibocados_pos_export_outbox.sql`.
**No aplicada automáticamente en la VPS.** Se despliega mediante un proceso controlado,
con respaldo y migración, cuando haya acceso al servidor.

- Cada NUEVO pedido `source=whatsapp` de Delibocados crea dentro de la misma transacción
  UNA sola intención `restaurant_ops_pos_exports`, destino `toteat`, referencia
  estable `delibocados-<uuid>`. Los pedidos `qr` no producen exportación Toteat.
- Si el pago está pendiente, la intención queda `blocked`. La verificación real
  del banco la libera. Las órdenes canceladas antes del envío se suprimen.
- Los pedidos históricos NO se reenvían por instalar la migración.
- `restaurant_ops_pos_product_map` almacena códigos verificados de Toteat. El
  procedimiento de reserva `restaurant_ops_pos_claim_toteat` rechaza pedidos
  si falta una línea mapeada, el pago no es elegible o la integración está deshabilitada.
- Un solo intento por orden. `unknown` implica consulta y conciliación, **nunca**
  repetir POST después de un timeout sin verificar la referencia externa.
- `restaurant_ops_pos_finish_toteat` registra aceptación con ID de Toteat,
  rechazo o estado incierto, pero no afirma que la comanda se imprimió.
- Preparador puro en
  `restaurant-toteat-preparation.service.ts` verifica precios COP, cantidades,
  producto de Toteat confirmado y referencia estable. Todavía no forma un
  `document` externo que no haya sido contrastado con el OpenAPI del local.
- No existe transporte POST habilitado. La política de conexión y las credenciales
  cifradas deben verificarse antes de implementar el último eslabón.

**Preflight de solo lectura**, una vez aplicada la migración:

```bash
cd /var/www/control
pnpm --filter @ventas/api exec tsx src/scripts/delibocados-toteat-readiness.ts
```

Este script comprueba existencia de integración, legibilidad de secreto cifrado
(sin revelar valores), cantidad de mapeos revisados y estado de exportación por pedido.

Para cerrar el POST efectivo: confirmar `restaurantId`, `localNumber`,
`userId`, token, permisos de "Carga de Órdenes Externas", códigos del menú
`/products`, `document` según el OpenAPI del ambiente correspondiente,
respuesta/estado por `orderReference`, y señal real de Print Server.
Respetar el límite documentado de 1 inserción de orden por segundo.
En un timeout o desconexión de red, NO reintentar sin reconciliar con Toteat.

La fuente de verificación de Toteat es su documentación:
https://developers.toteat.com/.

## Comprobación de credenciales reales sin exponerlas (2026-11-08)

El módulo `restaurant-toteat-readonly.service.ts` permite **únicamente GET**
contra los hosts oficiales `api.toteat.com` (producción) y
`apidev.toteat.com` (desarrollo). Los parámetros de autenticación son
`xir`, `xil`, `xiu` y `xapitoken`. No se imprimen el secreto, las URLs
autenticadas, las respuestas sin filtrar ni los errores de red.

El secreto cifrado del tenant `delibocados` debe ser **JSON** con un
ambiente explícito (no asumir producción). Formato de estructura, SIN valores:
```json
{
  "environment": "development",
  "restaurantId": "<id-real>",
  "localNumber": "<id-real>",
  "userId": "<id-real>",
  "apiToken": "<token-real>"
}
```
No copiarlo a GitHub, chat, archivos temporales públicos ni argumentos del
comando. El modo de lectura no marca la integración como `connected`.

Después de aplicar la migración en la VPS y comprobar configuración:
```bash
cd /var/www/control
DELIBOCADOS_TOTEAT_READONLY_PROBE=1 \
  pnpm --filter @ventas/api exec tsx src/scripts/delibocados-toteat-readiness.ts
```

Esta ejecución usa **una** consulta GET a `/shiftstatus` para comprobar
autenticación de la API. Agregar `DELIBOCADOS_TOTEAT_READONLY_PRODUCTS=1`
habilita **una** GET a `/products` para contar productos activos sin mostrar
códigos ni precios. Respetar la limitación oficial de **3 consultas/minuto**
a `/products` y evitar sondeos repetitivos.

Una respuesta `ok:true` en GET acredita únicamente acceso a ese recurso;
NO verifica permisos de *Carga de Órdenes Externas*, ni el turno abierto,
ni que el documento POST sea válido. La impresión física se valida en la sede.
El cliente de escritura sigue bloqueado hasta confirmar el contrato completo.
