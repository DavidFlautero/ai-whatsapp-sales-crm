# ETAPA 06 — Pagos reales y avisos automáticos de WhatsApp

**ESTADO:** módulos de pago y outbox existen. Falta probar conciliación de caja, asegurar doble entrega de webhooks y conectar WhatsApp real en testPhone.

## Archivos existentes

- `apps/api/src/services/restaurant-ops/restaurant-payment-intake.service.ts`
- `apps/api/src/services/restaurant-ops/restaurant-split-payment.service.ts`
- `apps/api/src/services/restaurant-ops/restaurant-notifications.service.ts`
- `apps/api/src/services/whapi/delibocados-channel.service.ts`
- `apps/api/src/services/whapi/delibocados-live-reply.service.ts`
- `apps/api/src/routes/restaurant-ops.routes.ts`: revisión de pagos, cuentas, split y efectivo.
- `apps/dashboard/src/app/panel/pagos/page.tsx`, `/panel/conversaciones/page.tsx`.
- `supabase/migrations/20261106200000_restaurant_payment_review.sql`
- `supabase/migrations/20261107190000_restaurant_verified_split_payments.sql`
- `restaurant_ops_outbox` — no enviar WhatsApp directamente en transacciones SQL.

## Lógica financiera requerida

1. **Efectivo:** pedido puede entrar en cocina con `cash_on_delivery`, pero ese estado indica **por cobrar**, no dinero recaudado. Al entregar, repartir responsabilidad: repartidor registra importe, caja concilia; diferencia se marca incidencia.
2. **Transferencia:** captura/comprobante se almacena en zona segura y entra en `proof_submitted`; sólo owner/admin o integrador bancario verificado puede marcar `verified`. Nunca usar OCR o el modelo como prueba de ingreso bancario.
3. **Mixto:** validar suma de transferencia confirmada + efectivo cobrado contra total COP exacto; cada componente tiene importe, momento, actor y recibo; si falta uno, pedido no se declara liquidado.
4. **Cambios de precio:** si cambió el carrito después de elegir pago, invalidar confirmación y volver a cotizar. No modificar precio de orden ya aceptada sin operación compensatoria.
5. **Cancelación/reembolso:** evidenciar autorización, estado del POS, pago de origen y reconciliación; si POS ya aceptó orden, no suprimir sin informar a cocina/operador.
6. **Contabilidad:** diferenciar `payment_status` de conciliación de caja; no equiparar `completed` (entrega) con `verified` (cobro).
7. **RLS/RBAC:** supervisores pueden consultar según rol; solo personal autorizado valida banco o caja. No incluir datos bancarios sensibles en logs.

## Secuencia de avisos

- Al registrar el pedido: «Pedido #n registrado» (NO «enviado a cocina» sin aceptación).
- Transferencia: «comprobante recibido y pendiente de revisión»; «pago verificado» sólo si en DB.
- Al entrar realmente a preparación: «estamos preparando», desde transición auditable.
- Al estar listo: pickup «listo para retirar»; delivery «listo para reparto».
- Courier asignado: aviso opcional con datos mínimos.
- Al despacharse: «en camino» SOLO tras `out_for_delivery` legítimo.
- Al entregarse: «entregado» SOLO tras `completed` con evidencia.
- Error de Whapi: mensaje pendiente/failed en outbox y reintento idempotente con clave de evento/recipient; no duplicar conversación.
- Si la conversación la lleva humano, no responder automáticamente.

## Archivos por crear o completar

- `apps/api/src/services/restaurant-ops/restaurant-cash-settlement.service.ts` + test: diferencia de cobro, caja, split, devoluciones.
- `supabase/migrations/<nueva>_restaurant_cash_settlement.sql`: importes, auditoría, restricción de unicidad por evento, rol, idempotencia.
- `apps/api/src/services/restaurant-ops/restaurant-notification-dedupe.service.ts` + test: decisión de envío por id `outbox_id` y `sourceMessageId`; idempotencia del proveedor, no spam.
- `apps/api/src/services/restaurant-ops/restaurant-notifications.service.ts`: lease/retry seguros, visibilidad de failed vs sent, respeto `stop` y scopes.
- `apps/dashboard/src/app/panel/pagos/page.tsx`: conciliaciones y discrepancias; `/panel/informes/page.tsx`: efectivo por cobrar, transferencias pendientes y saldo.
- `apps/api/src/scripts/delibocados-whapi-message-smoke.ts`: enviar **solo** a testPhone con permiso; test en seco por defecto.

## Seguridad de canal

- Modo actual test: `DELIBOCADOS_CHECKOUT_LIVE=0`; `DELIBOCADOS_ORDER_NOTIFICATIONS_LIVE=0`.
- `DELIBOCADOS_ORDER_NOTIFICATIONS_TEST=1` sólo con testPhone confirmado, tokens vigentes, modo operador IA y autorización de test.
- Verificar sender con `/health` de Whapi; no considerar prueba completa si canal inactivo o pausado.
- No activar avisos masivos sin medir errores y conciliación de eventos.

## Aceptación

- Efectivo pendiente no figura como dinero cobrado.
- Transferencia sin conciliación queda bloqueada para Toteat.
- Mixto cuadra exactamente y no liquida por screenshot.
- Una transición produce exactamente un aviso; replay no duplica.
- Error de Whapi no modifica estados de cocina o pago.
- En el testPhone se ven mensajes reales de confirmación, preparación, listo, reparto y entrega, cada uno después de evento válido.

**Terminado cuando:** caja, pago, saldo y WhatsApp reales quedan conciliados para un pedido pickup y otro delivery supervisados.
