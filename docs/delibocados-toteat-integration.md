# Delibocados: IA conversacional -> Toteat -> cocina -> repartidores

## Responsabilidades

- La IA conversa de forma natural y decide cuándo consultar menú, carrito, cobertura, pagos o estado.
- El backend valida catálogo, variantes, cantidades, precio y domicilio. El cliente confirma el total antes de guardar un pedido.
- Efectivo pendiente de recaudo no es dinero cobrado. La transferencia se revisa con movimiento bancario; una captura no confirma pago.
- El POS Toteat es el destino transaccional de los pedidos confirmados. Un webhook de Toteat y su Print Server gestionan recepción, comanda y estados de cocina.
- El CRM/WhatsApp notifica únicamente eventos corroborados y registra idempotencia para impedir pedidos duplicados.

## Evidencia de la API oficial

Documentación actual: https://developers.toteat.com/

- URL base recomendada de producción: https://api.toteat.com/mw/or/1.0/
- URL base recomendada de desarrollo: https://apidev.toteat.com/mw/or/1.0/
- Toteat permite Carga de Órdenes Externas, consulta de estados y webhooks de pedidos.
- Se debe habilitar Configuración > Print Server & API > API Config > Pedidos > Carga de Órdenes Externas, establecer origen, permisos y delivery.
- Toteat exige token de API y los IDs de restaurante, local y usuario; configurarlos en secretos del tenant en VPS, no en un chat.
- La creación de orden incluye restaurantId, localNumber, orderReference, type, channel, comment y document. La estructura completa de document y los identificadores de producto deben verificarse con el OpenAPI oficial y el menú real antes de generar un POST.
- Para los productos se requiere sincronización con el catálogo Toteat y mapeo de ID de nuestro menú al ID del POS; nunca asumir que los IDs internos son equivalentes.
- Asegurar la referencia idempotente orderReference usando el UUID de nuestro pedido. Un timeout requiere consulta/conciliación antes de reintento.
- Límite documentado: un envío de orden por segundo.
- Los webhooks requieren HTTPS, confirmación HTTP 200 rápida, autenticación y procesamiento idempotente.
- La impresión física depende del Print Server y de impresoras de la sede; no se debe informar comanda impresa sin la señal real.

## Estados para la integración (diseño, no código desplegado)

1. confirmed_local: pedido grabado y confirmado; no implica envío a Toteat.
2. waiting_payment: transferencia sin confirmar; no enviar a cocina.
3. pending_export: validación de precios y mapeo de productos Toteat, un solo pedido por referencia.
4. sending: worker de salida toma el pedido de una cola atómica.
5. unknown: timeout; conciliar con Toteat antes de reenviar.
6. accepted: respuesta de Toteat con orden identificada; listo para operación POS.
7. printed / preparing / ready: estados solo observados en Toteat/Print Server.
8. delivered / failed / incident: avisos, repartidor y auditoría.

## Situación real a noviembre de 2026

El repositorio actual contiene pedido local y comanda interna, pero NO tiene cliente exportador Toteat funcionando ni verificación de impresión física. No se debe afirmar que el POS recibió pedidos. El próximo desarrollo debe añadir un conector de salida con outbox idempotente, catálogo sincronizado y webhooks autenticados.

## Pruebas supervisadas

- Primero: conversación inteligente con el único testPhone (sin difusión pública).
- Segundo: pedido en Toteat desarrollo, o en entorno real de prueba autorizado, sin duplicados.
- Tercero: impresión de ticket físico confirmada en la sede y actualización de estados.
- Después, tres ventas reales una por una y bajo supervisión humana. Habilitación pública solo tras cada revisión.