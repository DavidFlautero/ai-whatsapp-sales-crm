# Delibocados — programación etapas 1 y 2 (9/11/2026)

## Qué implementamos

**Etapa 1 — Catálogo**
- El restaurante autorizó expresamente el precio **8.001 COP** del producto
  `deli-055 / Chicharrón Porción / DB1132`.
- `apps/api/src/scripts/delibocados-approve-reviewed-product.ts`: comprueba
  de nuevo **GET /products** de Toteat, valida que coincide nombre, precio y código,
  y marca únicamente ese producto como revisado mediante bloqueo optimista
  `company_id + revision`. Mantiene todos los demás datos y sube la revisión.
- `delibocados-toteat-map-reconcile.ts`: compara los 133 productos con los
  147 registros de Toteat; previsualiza, guarda mapeos inactivos y requiere
  aprobación explícita para activar los mapeos. **No activa exportación**.
- `delibocados-stage12-readiness.ts`: auditoría de 133 productos, mapeos activos
  y simulación de compra **sin modificar datos ni enviar órdenes**.

**Etapa 2 — Conversación, carrito y seguridad**
- `restaurant-natural-checkout-routing.service.ts`: compra expresa pasa por
  checkout determinista incluso si el cliente pregunta el precio y dice
  "para retirar" o "a domicilio" en el mismo mensaje.
- Se conserva la modalidad desde el primer mensaje. Se bloquean cambios
  contradictorios sin confirmación explícita.
- Respuestas de checkout conocidas (nombre, pago, confirmación, minutos) se
  procesan sin la decisión probabilística del modelo.
- Se admiten nombres como "Soy Carolina" y "Me llamo Juan Pérez".
- `restaurant-cart-intake.service.ts`: anotaciones precisas de cocina
  "una hamburguesa sin cebolla" o "dos hamburguesas, una de esas sin cebolla"
  se guardan como líneas separadas; los extras con precio no verificado y
  las modificaciones ambiguas **no** se aplican silenciosamente.
- Términos de alergia o intolerancia fuerzan una revisión humana,
  sin registrar/modificar el pedido automáticamente.
- Se mantienen el motor transaccional, revisión de precios, confirmación
  explícita, pago pendiente y clave idempotente `wa-<draft.id>` existentes.
- CI ejecuta regresiones del pedido real con hamburguesa y Coca Cola, del
  descuento/extra no inventado, notas, alergias y doble envío evitado.

## Qué no hemos hecho
- Los cambios todavía no están desplegados en la VPS ni activados en Whapi.
- No hemos probado una compra real por WhatsApp a través de un número activo.
- No hemos enviado una orden a Toteat ni comprobado impresión física.
- La etapa 3 (POST de órdenes) tiene requisitos externos independientes.

## Actualizar copia aislada de pruebas (NO producción)
```bash
git -C /root/delibocados-toteat-review-20261109 fetch origin \
  feature/delibocados-toteat-safe-integration-20261109
git -C /root/delibocados-toteat-review-20261109 switch --detach FETCH_HEAD
cd /root/delibocados-toteat-review-20261109
pnpm --filter @ventas/api typecheck
pnpm --filter @ventas/api exec tsx --test \
  src/services/restaurant-ops/restaurant-natural-checkout-routing.test.ts \
  src/services/restaurant-ops/restaurant-cart-intake.test.ts \
  src/services/restaurant-ops/restaurant-whatsapp-checkout.test.ts \
  src/services/restaurant-ops/restaurant-toteat-catalog-map.test.ts
```

## Aplicar la aprobación ya confirmada en producción
**Solo desde la copia de pruebas, con los secretos enlazados y bajo supervisión.**
No imprimir ni compartir `.env`.

```bash
cd /root/delibocados-toteat-review-20261109/apps/api
pnpm exec tsx src/scripts/delibocados-approve-reviewed-product.ts
# Revisa el resultado. Debe mostrar 8.001 COP y DB1132.
DELIBOCADOS_APPROVE_055=CONFIRM_8001_DB1132 \
  pnpm exec tsx src/scripts/delibocados-approve-reviewed-product.ts --apply
```

Este proceso cambia una **única marca de precio pendiente** en el JSON del
catálogo; incrementa su revisión de forma optimista. El precio sigue 8.001 COP.
Nunca adivinar un precio distinto.

## Conciliar los 133 códigos del POS
Respetar límite Toteat: máximo 3 GET a /products por minuto. No pegar
las tres operaciones en un bucle inmediato.

```bash
cd /root/delibocados-toteat-review-20261109/apps/api
pnpm exec tsx src/scripts/delibocados-toteat-map-reconcile.ts
# Si exactas=133, problemas=0:
pnpm exec tsx src/scripts/delibocados-toteat-map-reconcile.ts --stage
# Tras revisar los códigos y confirmaciones:
DELIBOCADOS_TOTEAT_MAPPING_APPROVE=REVIEWED_133 \
  pnpm exec tsx src/scripts/delibocados-toteat-map-reconcile.ts --approve
pnpm exec tsx src/scripts/delibocados-stage12-readiness.ts
```

`--stage` crea propuestas inactivas; `--approve` marca las coincidencias
revisadas. En todos los casos la integración Toteat continúa
`pending / enabled=false`. Se puede verificar los registros directamente
mediante la auditoría de solo lectura.

## Activación de código del agente
Después de fusionar la PR y pasar las pruebas de despliegue en VPS, desplegar
API con el procedimiento existente y realizar pruebas restringidas al
`testPhone`, con `DELIBOCADOS_AGENT_V2_TEST=1` y
`DELIBOCADOS_CHECKOUT_LIVE=0`. No activar WhatsApp público ni mensajes masivos.
La conexión Whapi debe estar autorizada y activa; una simulación local no la
reemplaza.

## Criterios de aceptación reales
1. 133/133 productos verificados, 133 mapeos activos y auditados.
2. La frase "Hola, quiero una hamburguesa tradicional y una Coca Cola
   Retornable 250 para retirar. ¿Cuánto me sale todo?" crea un **borrador de
   dos líneas** a precio publicado sin crear todavía una orden real.
3. "Soy Carolina" se toma como nombre "Carolina"; la modalidad permanece pickup.
4. "Sin cebolla" figura en la línea de cocina; modificación ambigua solicita
   aclaración; alergia deriva a humano.
5. No se registra venta hasta recibir `CONFIRMAR PEDIDO`; cualquier doble
   mensaje conserva una referencia idempotente.
6. Ninguna de estas pruebas envía ni imprime en Toteat.
