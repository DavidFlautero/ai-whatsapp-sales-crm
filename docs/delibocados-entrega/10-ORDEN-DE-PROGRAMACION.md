# EJECUTAR TODA LA PROGRAMACIÓN DE DELIBOCADOS — instrucciones para el implementador

Esta es una **orden de trabajo técnica lista para pasar a un agente de programación**. Leé `00-INICIO-IMPLEMENTACION.md` y los documentos `01` a `09`; ese paquete es la especificación funcional y el contrato de aceptación. **No son código ya terminado.**

## Misión única

Entregar un producto verificable de extremo a extremo:

```text
WhatsApp (Whapi)
  -> persistir mensaje y deduplicar
  -> agente conversa / carrito seguro
  -> cotización real + revisión de banco / efectivo
  -> CONFIRMAR PEDIDO -> DB con p_source_key estable
  -> restaurant_ops_pos_exports (solo WhatsApp -> Toteat)
  -> POST Toteat (con permisos aprobados y document validado)
  -> accepted / unknown / rejected
  -> webhook Toteat autenticado e inbox durable
  -> Cocina / Print Server / ticket comprobado
  -> preparing -> ready
  -> pickup: retiro físico y cierre
  -> delivery: courier asignado -> out_for_delivery
             -> evidencia real de entrega -> completed
  -> efectivo/transferencia conciliados
  -> WhatsApp de cada cambio real
  -> informes + auditoría + incidencias
```

## Cómo trabajar en código

1. Crear rama de implementación desde la rama actual `feature/delibocados-toteat-safe-integration-20261109` (PR #26). No trabajar directo sobre producción ni borrar código funcional.
2. Detectar qué existe exactamente por archivo; primero **reutilizar** `restaurant_ops_create_order`, `restaurant_ops_pos_claim_toteat`, `restaurant_ops_pos_finish_toteat`, `restaurant_ops_transition_order`, `restaurant_ops_assign_courier` y el outbox. Evitar duplicar motor, ticket o servicio WhatsApp.
3. **Etapa 01:** corregir y desplegar aprobación del SKU `deli-055` (COP 8001 y DB1132). Mapear y aprobar 133/133 con salvaguardas y auditoría. No cambiar precio a ojo.
4. **Etapa 02:** incorporar código del agente, salida sólo testPhone, correcciones de audio, ubicación, recuperación de borrador y pago. Pruebas con diálogo real.
5. **Etapa 03 (PRIORIDAD MÁXIMA):** implementar el POST a Toteat, tomando **exactamente** el schema OpenAPI oficial del restaurante, contrato de producto/tributos, idempotencia, un solo envío, `unknown` y reconciliación.
6. **Etapa 04:** asegurar webhook con payload real, impresión y control de estados de cocina; panel de cocina, fallback operator si no hay KDS.
7. **Etapa 05:** validar origen, polígonos, rutas, 2 bicis + 3 motos, tarifa, asignación, prueba de entrega y cierre de pedido.
8. **Etapa 06:** conciliar efectivo, transferencia, pagos mixtos, reembolsos, avisos Whapi basados en eventos y dedupe.
9. **Etapa 07:** conectar panel, incidencias, métricas, RBAC; inventario separado hasta que negocio confirme recetas/fuente de stock.
10. **Etapas 08/09:** automatizar matriz E01–E35 y release seguro, 3 pedidos supervisados, validación de papel/entrega real, soporte y handoff.
11. Por cada etapa: crear código, pruebas, migraciones idempotentes, integración API/UI, changelog y una salida de auditoría con PASS/FAIL. No reemplazar código por mocks en producción.
12. Mantener flags LIVE apagados hasta aceptación. No imprimir claves, evitar fuga de PII y jamás ejecutar `supabase db reset` en producción.

## Dependencias que NO resuelve el código

- El dueño debe habilitar en Toteat **Carga de Órdenes Externas** y el webhook y confirmar el canal y el formulario de pedido.
- Token Whapi válido y sender verificado; si el canal está impago, el código no lo vuelve activo.
- Google Maps habilitado y dirección/zonas reales verificadas; no inventar coordenadas.
- Print Server de Toteat en Windows y prueba física con un operador en el restaurante.
- Nombre, tarifa y disponibilidad real de 5 repartidores y método de evidencia de entrega.
- Comprobante bancario real y responsable autorizado de caja.
- Aprobación del restaurante para órdenes de prueba y producción.

## Criterio estricto para declarar "terminado"

No alcanza con que TypeScript compile. Se necesita:
- CI verde;
- menús y mapeos 133/133 en DB;
- pedido único recibido en Toteat con orderId verificado;
- ticket observado en cocina;
- cocina actualiza status;
- courier recibe y entrega pedido con evidencia;
- caja concilia COP y WhatsApp confirma solo hechos;
- pruebas de red/duplicados/cancelaciones;
- acta del dueño y rollback listo.

**No afirmar «terminado» hasta tener esas pruebas.**

## Primer comando operativo en VPS (solo lectura)

```bash
cd /root/delibocados-toteat-review-20261109
git fetch origin feature/delibocados-toteat-safe-integration-20261109
git switch --detach FETCH_HEAD
pnpm --filter @ventas/api typecheck
pnpm --filter @ventas/api exec tsx src/scripts/delibocados-delivery-readiness.ts
```

No desplegar ni habilitar LIVE por ejecutar este bloque. La copia aislada usa `.env` enlazado únicamente si ya se configuró de forma privada y conserva sus dependencias.
