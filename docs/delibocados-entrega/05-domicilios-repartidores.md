# ETAPA 05 — Google Maps, zonas, cinco repartidores y entrega final

**ESTADO:** motor de cotización y geocercas existe; origen y polígonos NO verificados en la última consulta (nueve zonas sin polígonos válidos). No se debe prometer domicilio automático aún.

## Código ya existente

- `apps/api/src/services/restaurant-ops/restaurant-delivery-routing.service.ts`
- `apps/api/src/services/restaurant-ops/restaurant-zones.service.ts`
- `apps/api/src/services/restaurant-ops/restaurant-whatsapp-location.service.ts`
- `apps/api/src/routes/restaurant-ops.routes.ts`: `POST /delivery/quote-address`, `POST /orders/:id/assign`, `POST /orders/:id/transition`.
- `apps/dashboard/src/app/panel/zonas/page.tsx`
- `apps/dashboard/src/app/panel/reparto/page.tsx`
- `supabase/migrations/20261106170000_restaurant_operations_core.sql`: `restaurant_ops_zones`, `restaurant_ops_couriers`, `restaurant_ops_assign_courier`.
- Perfil `restaurant_agent_business_profiles` con `origin_lat`, `origin_lng`, `origin_verified`.

## Flujo de punta a punta

1. **Origen de local:** propietario verifica dirección real y coordenadas. Sólo `origin_verified=true` al ser confirmado por humano.
2. **Cobertura:** cargar las 9 zonas como polígonos GeoJSON válidos o desactivar las que no estén verificadas. `containsPoint` en coordenadas WGS84 (GeoJSON = [longitud,latitud]). Fuera de polígono=sin cobertura, no "está cerca".
3. **Geocoding:** Google Maps desde servidor con clave restringida por API/servidor. Dirección escrita o pin WhatsApp con lat/lon verificado; no usar una captura como ubicación.
4. **Tarifa:** determinar zona activa, tarifa COP y ETA configurados; distancia de ruta por Google Routes o API disponible. Evitar confundir trayecto en coche con tiempo real de motocicleta/bici. Si Google Maps falla, **no cotizar automáticamente**.
5. **Cotización inmutable:** guardar ID de zona, tarifa, dirección/pin, coordenadas y versión de la cotización al confirmar; un cambio de tarifa/zona requiere reconfirmación del cliente ANTES de generar orden.
6. **Tipos de servicio:** retiro no lleva tarifa ni courier. Domicilio sólo para cobertura Funza/Mosquera confirmada; Bogotá no es zona permitida sin decisión formal del comercio.
7. **Personal:** registrar 5 repartidores confirmados (2 bicicleta, 3 motocicleta), únicos, activos, vehículo y disponibilidad. Evitar asignar courier `busy`, inactivo o con pedido incompatible.
8. **Asignación:** cuando `order.status=ready`, asignar uno con `restaurant_ops_assign_courier` (transacción/versionamiento en DB) y emitir evento auditable. Las sugerencias son por disponibilidad, NO ubicación GPS si no hay seguimiento.
9. **Despacho:** `ready` + courier asignado + pago elegible → `out_for_delivery`; registrar momento de recogida y no volver a enviar la misma orden.
10. **Entrega real:** `out_for_delivery` → `completed` sólo cuando existe confirmación del repartidor o encargado: recibido por cliente, referencia, hora y actor; si no hubo entrega, incidente/retorno/otro resultado explícito.
11. **Evidencia de entrega:** propuesta de código OTP comunicado al cliente, firma o foto consentida y privada; dato mínimo, sin fotos de documentos personales. No atribuir una entrega al evento 180 sin conciliar con nuestro actor/ruta.
12. **Pago en efectivo:** en la entrega registrar cuánto recibió realmente el repartidor y saldo esperado; diferencia → incidencia y conciliación del encargado, sin marcar como cobrado por inferencia.
13. **Estados y auditoría:** eventos `courier_assigned`, `out_for_delivery`, `delivery_attempted`, `delivered`, `failed_delivery`, `cash_collected`, con actor y timestamp. Deduplicación por petición/idempotency key.
14. **Panel:** cola por zona, vehículo, estado, pedido, nombre y teléfono parcialmente enmascarado; acción de recoger, entregar, no entregado y cerrar caja; RBAC courier solo órdenes propias.

## Archivos por programar / completar

- `apps/api/src/services/restaurant-ops/restaurant-delivery-quote-snapshot.service.ts` y `.test.ts`: precio firmado/versión/expiración, protección ante zona modificada.
- `apps/api/src/services/restaurant-ops/restaurant-courier-dispatch.service.ts` y `.test.ts`: disponibilidad, asignación, retiro, devolución.
- `apps/api/src/services/restaurant-ops/restaurant-proof-of-delivery.service.ts` y `.test.ts`: OTP/confirmación real, duplicados, privacidad.
- `supabase/migrations/<nueva>_restaurant_delivery_proof.sql`: evidencia mínima y RLS por tenant/rol/courier, evento único, fecha, motivo de entrega fallida y tabla conciliación.
- `apps/api/src/routes/restaurant-courier.routes.ts`: endpoints autenticados, idempotentes, con versionamiento (no exponer operación de admin al repartidor).
- `apps/dashboard/src/app/panel/reparto/page.tsx`: filtros, asignación, inicio, prueba de entrega y cobros; vista móvil para courier si se habilita.
- `apps/api/src/scripts/delibocados-delivery-smoke.ts`: cotización y chequeo read-only de zonas/couriers; test completo en DB de ensayo.
- `apps/api/src/services/restaurant-ops/restaurant-delivery-routing.service.ts`: reforzar fallo de Google Maps, seguridad de URL y límites.

## Condiciones que debe proporcionar el restaurante

- Dirección y pin verificados; Google Maps/API habilitada y presupuestada.
- Tabla aprobada de 9 zonas: barrio, tarifa, polígono, medio (moto/bici) si aplica, ETA orientativo.
- Datos y disponibilidad reales de 2 bicis + 3 motos.
- Método autorizado de entrega (OTP, botón del operador, foto consentida).
- Quién recibe y concilia el efectivo.

## Pruebas obligatorias

1. Pickup→sin courier/cargo; delivery fuera de cobertura→bloqueado.
2. Pin válido y pin falsificado/caducado → sólo válido cotiza.
3. Fee y total coinciden antes/después de confirmación (no recalcular sorpresivamente).
4. Concurrencia de dos asignaciones → un solo courier por pedido y no courier asignado a dos pedidos simultáneos.
5. No se cambia `out_for_delivery` sin courier; no `completed` sin confirmación de entrega.
6. Un repartidor no puede ver órdenes de otro ni cambiar precios/pagos.
7. Entrega fallida crea incidente, **no** un `completed` engañoso.
8. Efectivo entregado al repartidor no es pago liquidado hasta conciliación.

**Terminado cuando:** entrega física supervisada registrada con actor, hora y evidencia autorizada; cliente recibe aviso correcto y el pedido/cuadre de caja son consistentes.
