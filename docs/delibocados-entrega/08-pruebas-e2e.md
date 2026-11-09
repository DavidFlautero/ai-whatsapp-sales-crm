# ETAPA 08 — Matriz de pruebas funcionales y contra fallos

**Objetivo:** demostrar resultados en DB + proveedor externo + operación en sede. Los tests de CI son necesarios, NO suficientes.

## Niveles de prueba

1. Unitarias: parser, catálogo, montos, rutas, transiciones, pagos, webhook, reintentos, producto no verificado, instrucciones cocina, RLS.
2. Integración simulada: Supabase de prueba + mock Whapi/Google/Toteat; fixtures de payload oficial.
3. End-to-end en VPS aislado: testPhone + API desplegada en modo pruebas, SQL real, tracing por UUID; provider POST cerrado.
4. End-to-end con proveedor: orden expresamente autorizada contra Toteat desarrollo o test en local, Print Server y KDS/papel.
5. Piloto real: tres pedidos supervisados, al menos uno retiro y uno domicilio con cobro conciliado.

## Matriz de aceptación, ejecutable por personas y automatizable en tests

| ID | Escenario | Resultado obligatorio |
|---|---|---|
| E01 | Pregunta precio sin comprar | Respuesta; ninguna orden ni carrito involuntario |
| E02 | Pedido doble producto con retiro en misma frase | Borrador 2 líneas, precio total exacto, modalidad pickup |
| E03 | Cambia una unidad a "sin cebolla" | Instrucciones solo esa unidad, no duplica ni cambia precio |
| E04 | Modificación ambigua / extra no tarifado | Solicita aclaración; no inventa suplemento |
| E05 | Alergia / intolerancia | Derivación humana, pedido no enviado |
| E06 | Cliente corrige nombre y producto | Contexto preservado; total se recalcula y reconfirma |
| E07 | Doble "CONFIRMAR PEDIDO" | Una fila DB, una cola POS, una respuesta idempotente |
| E08 | Transferencia con captura | Pago pendiente, 0 POST Toteat |
| E09 | Transferencia validada por operador | Se habilita sólo pedido correcto; auditoría |
| E10 | Pago mixto | Suma exacta; el efectivo sigue por recaudar |
| E11 | Pickup | Tarifa 0, ningún courier y no pide dirección |
| E12 | Domicilio fuera de zona | Bloqueado o humano; ningún cobro/POST falso |
| E13 | Dirección/pin válido | Zona, tarifa y ruta verificados en servidor |
| E14 | Cambio de zona/precio | Requiere reconfirmación; no cambia una orden pagada silenciosamente |
| E15 | Toteat 401/403 | No hay aceptación; registro auditable y alerta |
| E16 | Toteat timeout luego de enviar | \`unknown\`, no segundo POST, reconciliación |
| E17 | Toteat 200 con recibo válido | \`accepted\`, ID guardado como texto exacto |
| E18 | Doble webhook de cocina | Una transición y no dos avisos |
| E19 | Webhook fuera de orden | Conciliación; no saltar estado silenciosamente |
| E20 | Código 90 de Toteat | "Toteat reporta impresión", sin declarar papel físico |
| E21 | Cocina marca preparando → listo | Ticket, estados y eventos consistentes |
| E22 | Courier disponible y asignado | Una asignación atómica y estado ready→out_for_delivery |
| E23 | Dos asignaciones simultáneas | Una gana, la otra devuelve conflicto; sin doble reserva |
| E24 | Entrega real y cobro | Comprobante/actor, \`completed\`, saldo conciliado |
| E25 | No entregado / cliente ausente | Incidencia y retorno; NO \`completed\` ni cobro inventado |
| E26 | WhatsApp caído | Outbox pendiente/error, no modifica cocina, sin duplicar |
| E27 | Cliente atendido por humano | La IA no interviene ni manda saludo |
| E28 | Otro tenant o QR | No usa integración Toteat de Delibocados |
| E29 | Cambio de precio producto | Mapeo invalidado; pedido sin reconfirmación no sale |
| E30 | Restaurar VPS tras caída | DB, outbox, estados y webhooks conservan idempotencia |
| E31 | Print Server desconectado | Estado visible, operador avisado, no marcar impreso |
| E32 | Cancelación tras aceptación POS | No se oculta: conciliación con cocina y rembolso manual |
| E33 | Separación horarios | No prometer que restaurante abrió sin datos confirmados |
| E34 | Evidencia de reparto ajena | Courier de otra orden no puede cerrar ésta |
| E35 | Auditoría y privacidad | Sin token ni PII sensible en logs o reportes públicos |

## Comandos existentes de lectura (no envían pedidos)

\`\`\`bash
cd /var/www/control
pnpm --filter @ventas/api typecheck
pnpm --filter @ventas/api exec tsx src/scripts/delibocados-stage12-readiness.ts
pnpm --filter @ventas/api exec tsx src/scripts/delibocados-toteat-export-dry-run.ts
pnpm --filter @ventas/api exec tsx src/scripts/delibocados-e2e-readiness.ts
\`\`\`

Estos comandos tienen supuestos de entorno y pueden consultar la DB; revisarlos en copia aislada. Los scripts de prueba real deben requerir una variable \`ALLOW_REAL_TEST_ORDER\` y un identificador explícito autorizado, NUNCA ejecutar ventas automáticamente.

## Evidencia que guardar por escenario

- UUID interno, orderReference, ID Toteat (sin secreto).
- Totales COP y estado de pago, comparados con DB.
- Hash/ID de webhook, estado previo→nuevo, operador y hora.
- Pantalla POS y ticket físico observado (sin PII compartida).
- Courier asignado, prueba autorizada de entrega y diferencia de caja.
- Mensaje de WhatsApp recibido de verdad con ID del proveedor.

**Terminado cuando:** E01–E35 resultan PASS o cada caso declarado fuera de alcance tiene aprobación escrita del dueño; cualquier fallo de dinero/idempotencia/seguridad bloquea lanzamiento.
