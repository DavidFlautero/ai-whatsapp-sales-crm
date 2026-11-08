# Delibocados: pedido único, destinos por canal (decisión 2026-11-08)

## Decisión comercial y técnica

| Origen | Destino único | Requisito |
| --- | --- | --- |
| WhatsApp del restaurante | **Toteat** | Cliente confirma productos/total, pago permitido, producto sincronizado con el POS. |
| QR individual de una mesa del salón | **POS360/SmartPOS** | QR activo y no adivinable resuelto en el backend a mesa real. |
| QR general expuesto **dentro del local** | **POS360/SmartPOS** | El cliente **primero selecciona una mesa**, validada en servidor. |
| Enlace público sin mesa o pedido desde panel | **Pendiente de regla comercial** | Nunca asumir que un pedido sin mesa va a POS360 ni duplicarlo en Toteat. |

**No mandar el mismo pedido a los dos POS.** PostgreSQL es el libro maestro de pedidos y eventos. Cada pedido debe tener una referencia única/idempotente en el sistema de destino. La confirmación local NO implica aceptación externa, y un ticket de cocina interno NO implica impresión física.

El nuevo helper `decideDelibocadosPosRoute` establece el contrato de ruteo y pruebas. Es una función pura, no un conector activo ni un worker de producción.

## Estado auditado en el repositorio

- **Existe** checkout transaccional WhatsApp: `restaurant-whatsapp-checkout.service.ts` crea mediante RPC `restaurant_ops_create_order`; persiste pedido, líneas, evento y ticket interno de cocina.
- **Existe** menú editable y QR general/por mesa: `native-qr.tsx` usa el editor Python del puerto 3500 a través de `menu-proxy.ts`; el QR general permite elegir mesa. No hay en este repositorio una ruta pública que valide el token QR, cree un pedido QR y lo envíe a POS360.
- **Existe** registro de integraciones `company_integrations` con proveedores `toteat` y `pos360`, y cifrado para secretos empresariales. Que exista un proveedor en ese registro **no demuestra** que haya token correcto ni autorización en el POS.
- **NO existe** en el repositorio principal un cliente de envío de órdenes Toteat, una cola de exportación POS específica y operativa, ni un acuse de impresión física.
- El archivo `docs/delibocados-toteat-integration.md` documenta la API; NO constituye implementación del envío.
- En la VPS podrían existir scripts/credenciales no versionados o almacenados cifrados; no afirmar que son válidos sin diagnóstico local del proceso y prueba de lectura no destructiva.
- El modelo de órdenes `restaurant_ops_orders` acepta `pickup` y `delivery`; todavía NO acepta `dine_in` ni identidad verificada de mesa. La UI del QR, por sí sola, no es checkout de mesa.
- Google Maps y las zonas de domicilios quedan en pausa. Probar primero el canal **WhatsApp + retiro local**.

## Contrato para completar antes de cualquier envío real

1. **Ingreso**: una sola API de checkout backend, distinta de la UI: valida menú, precios, disponibilidad, variantes, confirmación, origen y, en QR, token/mesa.
2. **Base de datos**: guardar transacción con `company_id`, `order_id`, `source`, `fulfillment_mode`, `verified_table_id` (solo QR local), `payment_status`, `pos_target`, `external_reference`, `export_status`. Ajustar esquema para `dine_in` sin degradar pickups existentes.
3. **Export outbox**: crear registro atómico asociado al pedido mediante commit único, llave única por pedido, `pending -> sending -> accepted | unknown | failed`. Después de timeout usar conciliación, **nunca POST ciego de nuevo**.
4. **Toteat**: comprobar en VPS presencia (sin exponer valores) de token, restaurantId, localId, userId, origen y opción Carga de Órdenes Externas. Consultar menú/turno con permiso real; mapear cada ID interno al `productCode` Toteat; generar `orderReference` estable usando el UUID local. Respetar 1 solicitud de orden/segundo. Primero ambiente de desarrollo/orden de prueba autorizada.
5. **POS360**: comprobar interfaz soportada/licencia del SmartPOS Windows, versión, acceso a mesas y driver/comandera; crear puente local autenticado con confirmación de recepción, cola offline y reintento seguro. No escribir directamente en MySQL de SmartPOS sin contrato validado.
6. **Cocina**: distinguir `registered_local`, `accepted_by_pos`, `printed`, `preparing`, `ready`, `delivered`; los cambios de estado verificados se notifican por WhatsApp/CRM. Enviar efectivo pendiente solo conforme al método habilitado del POS y política del restaurante; transferencias no verificadas siguen retenidas.
7. **Pruebas**: chat de prueba terminado en 1787 → confirmación → una fila de pedido y un ticket interno → una orden Toteat (sin duplicados) → papel observado → actualización de estado; después QR individual → POS360, QR general sin mesa bloqueado y con mesa validada → POS360.

## Fuentes de contrato
- Repositorio: `apps/api/src/services/restaurant-ops/restaurant-whatsapp-checkout.service.ts`, `supabase/migrations/20261106170000_restaurant_operations_core.sql`, `apps/dashboard/src/components/restaurant-os/native-qr.tsx`.
- API oficial Toteat: https://developers.toteat.com/ (requiere token, IDs y habilitar carga externa).
