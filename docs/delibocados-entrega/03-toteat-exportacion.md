# ETAPA 03 — Exportador REAL de pedidos WhatsApp → Toteat

**ESTADO: NO IMPLEMENTADO. P0, bloquea la operación.**
La lectura GET de productos funciona; que GET funcione **no** demuestra permiso de escritura. La cola de exportación y su contrato de seguridad ya existen. No repetirlos.

## Entradas verificadas

- Orden `restaurant_ops_orders`: `company_id=delibocados`, `source=whatsapp`, `status=confirmed`, `payment_status in ('verified','cash_on_delivery')`.
- Líneas inmutables de `restaurant_ops_order_items`: productos, cantidades, precios COP, preparación.
- `restaurant_ops_pos_product_map`: mapeo activo y revisado de cada línea.
- Credencial cifrada de `company_integrations` / `company_integration_secrets`, `environment`, restaurante, local, usuario y token. **Nunca en logs**.
- `restaurant_ops_pos_exports`: exactamente una fila/destino por orden, referencia `delibocados-<uuid>`, `attempts <= 1`. Estado `pending/blocked/sending/accepted/unknown/rejected`.
- `restaurant_ops_pos_claim_toteat('delibocados')` para tomar SOLO UNA orden; `restaurant_ops_pos_finish_toteat(...)` para registrar resultado inequívoco.

## Archivos actuales a conservar y extender

- `apps/api/src/services/restaurant-ops/restaurant-pos-routing.service.ts`
- `apps/api/src/services/restaurant-ops/restaurant-toteat-preparation.service.ts`
- `apps/api/src/services/restaurant-ops/restaurant-toteat-readonly.service.ts`
- `apps/api/src/services/integrations/integration-secrets.repository.ts`
- `supabase/migrations/20261108190000_delibocados_pos_export_outbox.sql`
- `apps/api/src/scripts/delibocados-toteat-export-dry-run.ts`
- `docs/delibocados-toteat-integration.md`

## Archivos de código por crear

1. `apps/api/src/services/restaurant-ops/restaurant-toteat-order-payload.service.ts` — constructor **puro** y validación de `document`, fecha, canal, tipo, productos, extras, precios, cargos, impuestos y datos obligatorios contra OpenAPI REAL.
2. `apps/api/src/services/restaurant-ops/restaurant-toteat-order-payload.test.ts` — snapshots del documento con ejemplo aprobado de restaurante, campos obligatorios y límites.
3. `apps/api/src/services/restaurant-ops/restaurant-toteat-order-client.service.ts` — POST autorizado, dominio HTTPS fijo y timeout; response parser estricto sin imprimir URL con token.
4. `apps/api/src/services/restaurant-ops/restaurant-toteat-order-client.test.ts` — mock HTTP, 200 aceptado, 400 rechazo, 401/403 permisos, 5xx/error de red `unknown`.
5. `apps/api/src/services/restaurant-ops/restaurant-toteat-export-worker.service.ts` — worker serial con `claim`, validación de cada línea, rate-limit de 1 POST/seg, resultado persistente, alarma y switch de corte.
6. `apps/api/src/services/restaurant-ops/restaurant-toteat-export-worker.test.ts` — no más de una orden, transacciones dobles, crash, resultados inciertos, corte de función.
7. `apps/api/src/scripts/delibocados-toteat-export-reconcile.ts` — consulta GET/por `orderReference` o por orden para aclarar exportaciones `unknown` sin reenviar.
8. `supabase/migrations/<nueva>_delibocados_toteat_export_audit.sql` **si** se necesitan campos nuevos: registro de respuesta redactada, latencia, provider request id, momento de reconciliación, error sin secretos.
9. `apps/dashboard/src/app/panel/integraciones/page.tsx` y `/panel/pedidos/page.tsx` — mostrar cola, `unknown`, `accepted`, referencia, reintento solo mediante conciliación autorizada.

## Contrato del POST — no improvisar

La documentación oficial Toteat en https://developers.toteat.com/ define ingreso de orden con body:
`restaurantId`, `localNumber`, `orderReference`, `status`, `type`, `channel`, `document` y otros campos opcionales/requeridos según contexto; autenticación por `xir/xil/xiu/xapitoken` y endpoint POST. **La estructura interior de `document` debe extraerse del OpenAPI descargable y validarse contra la configuración concreta del local**. La ruta exacta y los nombres de los identificadores del producto deben obtenerse de esa especificación, no inventarse.

Reglas:
- `orderReference` estable por UUID del pedido local.
- `type=pickup` para retiro, `delivery` para domicilio, sólo si el contrato lo admite.
- `channel` y `vendorName` configurados conforme al origen autorizado en Toteat.
- Prohibido agregar productos, descuentos, impuestos, domicilios o extras ficticios.
- Tras la validación local, `claim` atómico y **UN POST**.
- Si la respuesta documentada contiene éxito y orderId válido, marcar `accepted`.
- Si el proveedor confirma rechazo explícito, `rejected`.
- Si timeout, 5xx, error de red o respuesta inválida/ambigüa, `unknown`; **NO reintentar el POST**. Conciliar con Toteat por referencia; no afirmar que no llegó.
- 16+ dígitos: preservar ID de Toteat como texto exacto y no serializar a Number de JS inseguro.
- Integración cerrada hasta permiso del propietario: `pending / enabled=false`; no activarla con un mero GET.

## Precondiciones externas obligatorias

1. Propietario en Toteat: Configuración → Print Server & API → API Config → Pedidos, activar **Carga de Órdenes Externas** con canal origen específico y ruta autorizada.
2. Confirmar si cuenta es Legacy o migrada, canal, montos e impuestos, turnos, métodos de pago y ejemplo real `document`.
3. Verificar `/products` con 133 mapeos y `shiftstatus` con turno operativo.
4. Validar al menos un POST en entorno de desarrollo o pedido de prueba autorizado, con quien opere Toteat en el restaurante.

## Pruebas de aceptación de etapa 03

- Dos llamadas concurrentes para mismo pedido → una sola fila/export y máximo un POST.
- Pedido QR/panel de otro tenant o transferencia no verificada → 0 POST.
- `accepted` exige orderId; `unknown` impide cualquier reintento hasta conciliación.
- Restaurante sin permiso → no habilitar worker; ningún cliente recibe falsa confirmación de cocina.
- Pedido controlado #TEST: operador comprueba recepción en interfaz de Toteat y referencia única.

**Terminado cuando:** existe el POST de verdad, la prueba autorizada confirma `accepted` y el panel puede diagnosticar `unknown` sin repetir pedidos. La impresión pertenece a etapa 04, no a esta.
