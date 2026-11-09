# ETAPA 02 — WhatsApp IA → carrito verificado → pedido único

**Estado del código:** mejoras implementadas con tests en PR #26. **Pendiente:** desplegar API y probar conversa real con número autorizado; corregir eventuales fallos de medias, sesiones o flujo.

## Archivos de programación existentes

- `apps/api/src/services/whapi/delibocados-live-reply.service.ts` (canal, testPhone, envío).
- `apps/api/src/services/whapi/whapi-audio-processing.service.ts`, `whapi-location-parser.service.ts`, `whapi-durable-message.service.ts`.
- `apps/api/src/services/restaurant-ops/restaurant-natural-agent.service.ts`.
- `apps/api/src/services/restaurant-ops/restaurant-natural-checkout-routing.service.ts`.
- `apps/api/src/services/restaurant-ops/restaurant-whatsapp-checkout.service.ts`.
- `apps/api/src/services/restaurant-ops/restaurant-cart-intake.service.ts`.
- `apps/api/src/services/restaurant-ops/restaurant-line-modification.service.ts`.
- `apps/api/src/services/restaurant-ops/restaurant-whatsapp-location.service.ts`.
- `apps/api/src/services/restaurant-ops/restaurant-split-payment.service.ts`.
- `supabase/migrations/20261106170000_restaurant_operations_core.sql`.

## Contrato de cada mensaje entrante

1. Validar firma/webhook y origen del mensaje, `companyId=delibocados`, ID externo, teléfono y modo agente. Persistir mensaje una vez y deduplicar `sourceMessageId`.
2. Aplicar aislamiento de testPhone; si operador humano está atendiendo, NO responder.
3. Audio: transcripción fiable con captura de error; imagen/comprobante nunca se convierte en pago verificado. Pin GPS usa coordenadas numéricas y caducidad, no el texto `[location]`.
4. Clasificar primero **seguridad alimentaria, reclamos, modificaciones de pedido ya despachado**, luego señales explícitas de compra.
5. La IA puede contestar preguntas; **no decide precios ni modifica SQL**. La compra explícita pasa al parser determinista y crea/edita sólo un **borrador**.
6. Producto por nombre/código, cantidad 1–25, diferencias entre variantes, múltiples líneas, preparación por unidad y combos sólo si figuran con precio verificado.
7. Pedir sólo siguiente dato faltante: nombre, retiro/domicilio, tiempo o dirección, zona, notas, pago, resumen. `priceNeedsReview=true` bloquea compra.
8. Cotización de domicilio falla de forma segura si no hay origen/zonas válidas/Google Maps; no asumir cobertura de Bogotá ni distancia.
9. Efectivo queda por cobrar; transferencia/mixto exigen revisión; el texto de usuario no concilia el banco.
10. `CONFIRMAR PEDIDO` registra vía `restaurant_ops_create_order` con `p_source_key=wa-<draft.id>` idempotente y revisión de menú. Doble confirmación NO duplica.
11. Mensaje de respuesta solo afirma "registrado", nunca "recibido en Toteat" ni "impreso" antes de confirmación externa.
12. Recuperar borrador consistente hasta la política actual de caducidad (2h); responder por contexto verificado, no inventar memoria o estado.
13. Persistir outbound y resultado del proveedor; cola por teléfono reduce carreras; no saludar repetidamente al reintentar.

## Pruebas programadas y pendientes de dispositivo

- `restaurant-natural-checkout-routing.test.ts`
- `restaurant-cart-intake.test.ts`
- `restaurant-whatsapp-checkout.test.ts`
- `restaurant-line-modification.test.ts`, `restaurant-split-payment.test.ts`.
- Mensaje «quiero una hamburguesa tradicional y Coca Cola para retirar, ¿cuánto?» → borrador 2 líneas, no venta.
- «Soy Carolina», «sin cebolla», «otra unidad», «quitar la Coca Cola», «pago mixto», «confirmar pedido» → cambios conservan cálculos.
- «¿Cuánto cuesta?» sin compra → pregunta, NO crea orden.
- «Soy alérgico...» → humano, sin venta.
- Audio/texto duplicado mismo `sourceMessageId` → respuesta idempotente.
- Fallo Whapi/transcripción/timeout → mensaje rastreable, sin false positives.
- Dos clientes simultáneos → estado aislado por teléfono y compañía.
- La prueba REAL de Whapi se realiza exclusivamente con `testPhone` mientras el canal esté autorizado y operativo.

**Terminado cuando:** una conversación real testPhone completa un pedido pickup y uno delivery autorizado sin duplicados, con audios y media probados o declarados fuera de alcance, antes de cualquier rollout público.
