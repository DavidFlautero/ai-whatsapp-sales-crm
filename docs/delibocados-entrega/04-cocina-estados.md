# ETAPA 04 — Toteat → comanda/Print Server → cocina → CRM

**ESTADO:** receptor y worker webhook preparados en rama, SIN despliegue ni prueba de orden real. Print Server físico ya tuvo una prueba manual desde el Windows del restaurante; eso no valida conexión del pedido por API.

## Archivos existentes

- \`apps/api/src/routes/webhooks/delibocados-toteat.routes.ts\`
- \`apps/api/src/services/restaurant-ops/restaurant-toteat-status-sync.service.ts\`
- \`apps/api/src/services/restaurant-ops/restaurant-toteat-webhook-worker.service.ts\`
- \`apps/api/src/services/restaurant-ops/restaurant-kitchen-board.service.ts\`
- \`apps/api/src/services/restaurant-ops/restaurant-kitchen-board.test.ts\`
- \`apps/api/src/routes/restaurant-ops.routes.ts\`: \`/kitchen/board\`, \`/orders/:id/transition\`.
- \`supabase/migrations/20261109120000_delibocados_toteat_webhook_inbox.sql\`.
- \`restaurant_ops_kitchen_tickets\`, \`restaurant_ops_order_events\`, \`restaurant_ops_outbox\`.

## Trabajo exacto de programación

1. Revisar con el OpenAPI la **estructura real del webhook** del local. El parser actual espera \`ok=true, restaurantId, localNumber, data[]\` y \`orderReference\`; comprobarlo contra payload documentado. Un fixture falso no basta.
2. HTTPS público, firma/header secreto configurado del lado Toteat, comparación constant-time, anti-replay y restricciones de tamaño. Se admite personalizar auth con \`Custom Headers\`; no usar webhook "sin autorización".
3. Persistir **inbox idempotente** antes de responder 200, procesamiento asíncrono. Dedupe por proveedor+referencia+id de evento si disponible; registrar integridad del payload.
4. Sólo actualizar una orden si \`restaurant_ops_pos_exports.status=accepted\` y \`external_reference\` coincide exactamente, \`company_id=delibocados\`, \`source=whatsapp\`. \`orderId\` de 16 dígitos se maneja como string.
5. Mapear hechos documentados sin saltar etapas:
   - 40 nuevo; 90 Toteat reporta impresión (NO demostrar papel);
   - 100 preparando → \`preparing\`;
   - 110 listo → \`ready\`;
   - 120 en reparto → \`out_for_delivery\` SOLO si repartidor asignado;
   - 180 entregado → \`completed\` SOLO si modo/etapa compatible y evidencia de entrega;
   - 170/172/175/200 → revisión humana o reglas específicas, NO cierre feliz por defecto.
6. Webhooks fuera de orden: cola, versiones del pedido y reconciliación GET; no descartar silenciosamente 110 que llegó antes de 100. Escalar conflicto y operador puede corregir estado con auditoría.
7. **Print Server**: validar que orderId aceptado por Toteat genera exactamente una comanda visible en \`Cocina\` y/o \`CAJA\` en el Windows del local (Toteat Print Server). No hacer SSH→Windows printing por otro canal si Toteat administra la impresión.
8. Si sólo imprimen papel, diseñar botón manual de «Preparando»/«Listo» RBAC en el panel. Si KDS está habilitado en su plan, verificar evento real por KDS.
9. Actualizar panel de cocina con origen, estado POS, evidencia de impresión, cola, demora, fallos, orden manual y ruta de reconciliación.
10. Las notificaciones WhatsApp salen de transiciones confirmadas en DB, nunca de inferencia de IA.

## Nuevos archivos sugeridos

- \`apps/api/src/services/restaurant-ops/restaurant-toteat-webhook-fixtures.test.ts\` con payload sanitizado REAL del restaurante.
- \`apps/api/src/services/restaurant-ops/restaurant-kitchen-reconcile.service.ts\` y \`.test.ts\` — eventos tardíos, estados contradictorios, evento cancelado y conciliación.
- \`apps/api/src/scripts/delibocados-toteat-kitchen-check.ts\` — lectura de export, orden, ticket y eventos sin activar cambios.
- \`apps/dashboard/src/app/panel/cocina/page.tsx\` — panel para operador, acciones con versión optimista.
- Migración nueva sólo si hace falta persistir evidencia de impresión/acuse.

## Criterios de aceptación

- Una orden aceptada por Toteat aparece una sola vez en cocina; comanda inspeccionada físicamente por personal del local.
- Al marcar «Preparando» → estado interno \`preparing\` y mensaje de evento; al marcar «Listo» → \`ready\`.
- Un webhook duplicado NO crea eventos/avisos repetidos.
- Un webhook inválido/otro tenant NO cambia estado.
- Caída del webhook recuperable mediante reconciliación de estados; 200 únicamente después de persistir inbox.
- Ningún estado de impresión físico se declara verificado sólo porque \`printed_at\` no sea NULL.

**Terminado cuando:** pedido de prueba sale realmente en papel o KDS autorizado y su avance se ve en CRM con evidencia y sin duplicados.
