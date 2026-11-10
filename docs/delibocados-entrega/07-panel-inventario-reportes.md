# ETAPA 07 — Panel operativo completo, inventario, soporte, reportes

**ESTADO:** pantallas existen para los módulos principales. Hace falta confirmar que están conectadas a operaciones reales con estados, permisos, errores y UX de tienda. Inventario está en levantamiento, no asumir catálogo de ingredientes.

## Rutas existentes

- `apps/dashboard/src/app/panel/pedidos/page.tsx` — colas y detalle.
- `apps/dashboard/src/app/panel/cocina/page.tsx` — bandeja de comandas y cambios.
- `apps/dashboard/src/app/panel/reparto/page.tsx` — despacho y repartidores.
- `apps/dashboard/src/app/panel/zonas/page.tsx` — polígonos, costos y rutas.
- `apps/dashboard/src/app/panel/pagos/page.tsx` — bancos, comprobantes, caja.
- `apps/dashboard/src/app/panel/conversaciones/page.tsx` y `/panel/operador/page.tsx` — WhatsApp y toma por humano.
- `apps/dashboard/src/app/panel/clientes/page.tsx` — CRM, historial verificado.
- `apps/dashboard/src/app/panel/incidencias/page.tsx`, `/panel/reclamos/page.tsx`.
- `apps/dashboard/src/app/panel/informes/page.tsx` — métricas.
- `apps/dashboard/src/app/panel/menu/page.tsx`, `/panel/menu/upload/route.ts`.
- `apps/dashboard/src/app/panel/integraciones/page.tsx`, `/panel/ia/page.tsx`.
- `apps/dashboard/src/app/dashboard-api/restaurant-ops/[...segments]/route.ts` — proxy autenticado a API.

## Completar panel real

1. Cada botón enlazado con endpoint válido, rol permitido y refresh del estado; nada de botones decorativos ni datos mock en producción.
2. Mostrar claramente `pendiente pago`, `confirmado localmente`, `pendiente Toteat`, `aceptado POS`, `en cocina`, `listo`, `reparto`, `entregado`, `incidencia`.
3. Colas ordenadas por fecha/prioridad; filtros + búsqueda por número de pedido y estado, sin consultar otras compañías.
4. Mostrar `version` y conflictos optimistas (`409`) en cambios, jamás pisar la transición de otro operador.
5. Botones para "Tomar conversación" y "Devolver a IA"; respetar operator mode en el canal.
6. Gestión: aprobar/rechazar prueba de transferencia, asignar courier, revisar `unknown` Toteat, incidencias y evidencias.
7. Reportes separar pedidos realizados, aceptados por POS, entregados, pagados, saldo pendiente, errores cocina, retrasos y reparto por actor; no medir ventas sólo por «registrado».
8. Accesibilidad móvil para repartidores; componentes con estados loading/empty/error y confirmaciones para acciones irreversibles.
9. Telemetría: auditoría por usuario/rol + orden, sin log de credenciales ni PII innecesaria.

## Inventario — preparar análisis antes de programar

Inventario NO es lo mismo que catálogo de venta. Antes de escribir módulos de stock, exigir del restaurante:
- Quién descuenta ingredientes (Toteat, POS360 o nuestro software) y quién es fuente de verdad.
- Recetas y gramajes por producto/variante, unidades y equivalencias; control de merma.
- Compras/proveedores, lotes y vencimientos, costo unitario, impuestos, bodegas y transferencias.
- Punto de reposición, reservas por pedido, devolución/cancelación, recetas con extras, conteos y ajustes.
- Quién autoriza ajustes, inventario inicial, tolerancias y cierres por turno.
- Si Toteat ya gestiona movimientos, integrar mediante lectura autorizada; evitar doble descuento.

## Archivos nuevos propuestos para inventario (tras aprobar alcance)

- `supabase/migrations/<nueva>_restaurant_inventory.sql`: `ingredients`, `recipes`, `recipe_lines`, `stock_locations`, `stock_movements`, `stock_counts`, `purchase_receipts`; foreign keys tenant y transacciones.
- `apps/api/src/services/restaurant-ops/restaurant-inventory.service.ts` + test (movimientos atómicos y reversión).
- `apps/api/src/services/restaurant-ops/restaurant-recipe-costing.service.ts` + test (gramos, merma, costo COP).
- `apps/api/src/services/restaurant-ops/restaurant-inventory-toteat-sync.service.ts` + test SI API habilitada y datos verificados.
- `apps/api/src/routes/restaurant-inventory.routes.ts` con RBAC.
- `apps/dashboard/src/app/panel/inventario/page.tsx`, `/proveedores/page.tsx`, `/compras/page.tsx`.
- `apps/api/src/scripts/delibocados-inventory-smoke.ts` read-only + pruebas SQL con DB aislada.

**Dependencia comercial:** inventario completo puede ser una fase posterior a la primera venta operativa si el dueño no aprobó recetas/stock. No dejar que bloquee la prueba mínima de WhatsApp→cocina→entrega.

## Aceptación

- Cada vista principal responde con datos reales autenticados y cambios correctos.
- Dos operadores concurrentes no pisan estados de pedidos.
- Auditoría registra actor, motivo y hora para reembolsos, pago, cancelación y entrega.
- Inventario no descuenta dos veces ni mezcla compañías; sólo pasa a «listo» con fuente de stock definida, recetas y conteo inicial aprobado.
