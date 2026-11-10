# Delibocados — expediente de programación hasta entrega final

**Base:** rama `feature/delibocados-toteat-safe-integration-20261109`; PR #26, todavía borrador. Referencia VPS: `/var/www/control`. Fecha del levantamiento: 2026-11-09.

## Objetivo de aceptación

**WhatsApp del cliente → interpretación segura → carrito → total oficial → dirección/retirada → verificación de pago → confirmación explícita → pedido local único → Toteat (si fuente WhatsApp) → aceptación POS → Print Server/cocina → preparando → listo → asignación → en reparto → entrega real → cobro conciliado → WhatsApp de cierre → informes/auditoría.**

Mismo identificador y trazabilidad, no duplicar pedidos, no inventar cobros, entregas, impresión ni disponibilidad. Para pedidos QR de mesa el proveedor es **POS360**, no Toteat. Origen "panel" no se exporta automáticamente salvo contrato explícito.

## Qué ya está construido

- CRM y menú local, checkout determinista + agente conversacional, mensajes durables Whapi.
- Migración core de pedidos, líneas, tickets, estados, incidentes, couriers, zonas, outbox de notificaciones.
- Pago efectivo, transferencia con revisión y pago mixto; cobro al repartidor sigue requiriendo evidencia.
- Preparador de líneas para Toteat; mapeo de códigos, outbox durable `restaurant_ops_pos_exports`, política `restaurant_ops_pos_claim_toteat`, webhook duradero y sincronización parcial de estados.
- Panel /panel/{pedidos,cocina,reparto,zonas,pagos,conversaciones,clientes,integraciones,incidencias,informes,menu}.
- GET real a Toteat responde 200; 147 filas y 132 de 133 coincidencias verificadas; propietario confirmó `deli-055` / $8.001 / DB1132.
- Etapas 01/02: código en PR #26 y CI. **No aplicadas a la base ni desplegadas todavía**. 15 pruebas anteriores en VPS, pruebas CI adicionales en la rama.

## Estado real: no confundir con producción

- Exportación real **POST** Toteat: no existe ni funciona todavía.
- La base sigue requiriendo aprobar `deli-055` y 133 mapeos desde VPS, con secreto local.
- La recepción real, impresión física, y eventos webhook de una orden aceptada por Toteat no han sido probados.
- Google Maps, origen verificado, 9 polígonos y WhatsApp/Whapi tienen pendientes de configuración o activación.
- No anunciar que el sistema puede aceptar ventas autónomas hasta la etapa 09.

## Orden obligatorio de implementación

| Etapa | Documento | Bloqueo de aceptación |
|---|---|---|
| 01 | `01-catalogo.md` | 133/133 verificados y mapeados |
| 02 | `02-agente-carrito.md` | conversación→carrito→pedido único en testPhone |
| 03 | `03-toteat-exportacion.md` | pedido real autorizado aceptado en Toteat una sola vez |
| 04 | `04-cocina-estados.md` | aceptación POS, comanda real y estados de cocina |
| 05 | `05-domicilios-repartidores.md` | ruta y tarifa verificadas; entrega real registrada |
| 06 | `06-pagos-notificaciones.md` | conciliación económica y WhatsApp basado en hechos |
| 07 | `07-panel-inventario-reportes.md` | operación del equipo, incidencias, visibilidad |
| 08 | `08-pruebas-e2e.md` | pruebas funcionales, negativas y de fallos |
| 09 | `09-despliegue-entrega.md` | puesta en producción supervisada y acta de entrega |

Las etapas 03/04 y 05/06 pueden programarse en paralelo, **pero no habilitarse** hasta que las dependencias y las pruebas estén aprobadas.

## Reglas no negociables de desarrollo

1. **No modificar** `/var/www/control` hasta pasar CI y pruebas en worktree; hacer backup y tener rollback.
2. No imprimir ni subir secretos; no pegar `.env`, token Toteat, clave Google Maps o Whapi a GitHub.
3. **Sin simulaciones que parezcan éxito**: distinguí `pending` / `accepted` / `unknown` / `completed`.
4. Toteat: máximo 1 POST/seg; timeout implica **unknown + conciliación**, no reintento ciego.
5. `source=whatsapp`→Toteat; `source=qr`→POS360; no enviar la misma orden a dos POS.
6. Transacciones, precios, zonas, pagos y estados se validan en SQL/API, nunca en texto generado por IA.
7. WhatsApp solo `testPhone` durante integración; `DELIBOCADOS_CHECKOUT_LIVE=0`.
8. Caja/transferencia: un comprobante no acredita pago; efectivo por cobrar no es saldo liquidado.
9. Mensajes de cocina y reparto solo cuando exista evidencia del estado en DB/POS.
10. Datos personales y geolocalización limitados a roles, mínima exposición y retención controlada.

## Comandos de validación existentes

```bash
cd /var/www/control
pnpm --filter @ventas/api typecheck
pnpm --filter @ventas/api exec tsx --test src/services/restaurant-ops/*.test.ts
pnpm --filter @ventas/api exec tsx src/scripts/delibocados-e2e-readiness.ts
```

Usar los scripts existentes para validar, pero revisar que el shell glob coincida con el filtro y no ejecutar comandos de escritura en producción fuera de una ventana aprobada.

## Fuente API externa

Documentación técnica oficial: https://developers.toteat.com/. La descripción disponible incluye los contratos de "Ingreso nueva orden en Toteat", estado, webhooks y límite de una inserción por segundo. **Antes de implementar el POST** consultar el OpenAPI exacto del local: no inferir `document`, impuestos ni semántica de extras.
