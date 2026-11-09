# ETAPA 01 — Menú local, control de precios y 133 mapeos Toteat

**Estado del código:** implementado en PR #26. **Estado de datos:** pendiente de aplicar desde VPS. Se cierra sólo tras leer los 133 mapeos activos.

## Archivos reales que se usan

- `apps/api/src/scripts/delibocados-approve-reviewed-product.ts`
- `apps/api/src/scripts/delibocados-toteat-map-reconcile.ts`
- `apps/api/src/scripts/delibocados-stage12-readiness.ts`
- `apps/api/src/services/restaurant-ops/restaurant-toteat-catalog-map.service.ts`
- `apps/api/src/services/restaurant-ops/restaurant-toteat-catalog-map.test.ts`
- `supabase/migrations/20261108190000_delibocados_pos_export_outbox.sql`
- Tabla: `restaurant_menu_documents`, `restaurant_ops_pos_product_map`.

## Secuencia de programación y operación

1. Validar un único documento de menú para `company_id=delibocados` y revisión consistente.
2. Verificar con un solo GET `/products` que `deli-055` es `Chicharrón Porción`, COP **8001**, `localCode=DB1132`, `isModifier=false`.
3. Aplicar sólo `priceNeedsReview=false` para ese ID mediante compare-and-swap en revisión; no cambiar nombre, disponibilidad, cantidad ni precio.
4. GET nuevo y conciliación exacta de todos los artículos, no confiar en IDs posicionales. 147 registros remotos incluyen artículos y elementos que no deben mapearse.
5. `--stage`: guardar 133 propuestas `active=false`; verificar códigos y catálogo.
6. `--approve`: marcar únicamente las 133 propuestas validadas `active=true, reviewed_at`.
7. Añadir mecanismo de **invalidación futura**: cambio de precio / código / disponibilidad / modificación en Toteat invalida el mapeo correspondiente y pone el producto en revisión (futuro webhook de menú). No desactivar otros productos sin evidencia.
8. Añadir alerta de discrepancias (no un cambio silencioso de precios). Cualquier orden existente conserva snapshot del precio de confirmación.

## Comandos concretos, tras verificar CI y worktree

Desde `/root/delibocados-toteat-review-20261109/apps/api` con `.env` enlazado de forma privada:

```bash
pnpm exec tsx src/scripts/delibocados-approve-reviewed-product.ts
DELIBOCADOS_APPROVE_055=CONFIRM_8001_DB1132 \
  pnpm exec tsx src/scripts/delibocados-approve-reviewed-product.ts --apply
# Dejar >=20 s entre GET /products: límite oficial 3/min.
pnpm exec tsx src/scripts/delibocados-toteat-map-reconcile.ts
pnpm exec tsx src/scripts/delibocados-toteat-map-reconcile.ts --stage
DELIBOCADOS_TOTEAT_MAPPING_APPROVE=REVIEWED_133 \
  pnpm exec tsx src/scripts/delibocados-toteat-map-reconcile.ts --approve
pnpm exec tsx src/scripts/delibocados-stage12-readiness.ts
```

**No ejecutar toda la secuencia de consultas GET de forma inmediata**: esperar al menos 20 s por cada llamada a `/products`, evitar otras llamadas paralelas. `--stage` y `--approve` escriben en BD y requieren control humano. Esto NO enciende el envío de órdenes.

## Pruebas obligatorias

- 133/133 únicos, sin duplicados ni mapeos ambiguos.
- Producto `deli-055` a 8001 COP, código DB1132.
- Cambios de precio, duplicados, artículos inactivos y modificadores no se aprueban.
- Alteración de revisión concurrente bloquea escritura.
- Sin acceso al secreto Toteat, el comando se detiene; token nunca aparece en logs.

**Terminado cuando:** la lectura DB confirma 133 mapeos activos revisados, integración aún cerrada y prueba de conciliación sin problemas.
