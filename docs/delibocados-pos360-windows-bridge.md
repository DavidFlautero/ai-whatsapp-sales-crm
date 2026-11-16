# Delibocados — puente seguro QR → SmartPOS/POS360 Windows

## Estado contrastado (2026-11-16)

- La aplicación local observada previamente fue SmartPOS 3.9.9 en laboratorio
  Windows, motor MySQL 5.7.40 en localhost:3307, base `smartpos` con 57 tablas,
  entre ellas `orders`, `sharedtickets`, `ticketlines`, `places`,
  `products`, `tickets`, `receipts`. **Es una base del laboratorio, no
  evidencia del funcionamiento de la máquina de caja del restaurante.**
- Existía una plantilla/importador de 127 productos para ese laboratorio
  (códigos `DLB-0001`, etc.), pero **no se confirmó** la correspondencia
  uno-a-uno con los productos actuales de la carta ni los impuestos.
- Un clic local en «Orden» del software desencadenaba el flujo interno de
  comanda; ni el flujo SQL exacto ni una API local externa de ingreso
  de pedidos fueron validados. No insertar directamente en `orders`,
  `sharedtickets`, `ticketlines`, `receipts` ni crear ventas desde MySQL.
- El POS local no está conectado en producción. Las impresoras Windows
  «Cocina»/«CAJA» observadas en el entorno anterior no prueban que la
  cola Neuromind→SmartPOS→impresora funcione.

## Arquitectura preparada (desactivada por defecto)

```
QR único de mesa → pedido nuevo PostgreSQL
  → restaurant_ops_pos_exports (provider=pos360, pending)
  → API /public/delibocados-pos360-bridge/claim (token fuerte)
  → Windows: delibocados-pos360-pull-bridge.ps1
  → **ADAPTADOR NATIVO A IMPLEMENTAR según contrato SmartPOS verificado**
  → comprobante de aceptación POS360 (externalOrderId)
  → API /ack → status accepted
  → comprobación APARTE de impresión física en cocina.
```

Cada nueva comanda genera un ID y externalReference inmutable; el bridge
reclama un registro una sola vez. Estados `sending` y `unknown` exigen
conciliación, **no reintento automático**. El ACK HTTP no es comprobante de
impresión, y el éxito de un trabajo de impresora no significa que SmartPOS
haya registrado esa venta.

### Instalación VPS (sin activar pedidos externos)

```bash
cd /var/www/control
git pull --ff-only origin main
bash scripts/deploy/delibocados-pos360-bridge-apply.sh
```

Este script valida TypeScript, respalda PostgreSQL, aplica la migración
`20261116170000` y reinicia la API con
`DELIBOCADOS_POS360_BRIDGE_ENABLED=0`. No reclama pedidos, no envía
transacciones a POS360 ni imprime.

### Inspección local (solo lectura)

En la máquina Windows con SmartPOS, ejecutar con PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\delibocados-smartpos-inspect-readonly.ps1
```

Archivos versionados: `scripts/windows/delibocados-smartpos-inspect-readonly.ps1`
y `scripts/windows/delibocados-pos360-pull-bridge.ps1`.

La inspección informa ejecutables/puertos/impresoras **sin credenciales**.
Con esas salidas y la documentación/SDK del fabricante habrá que implementar
un `AdapterScript` real, probado contra la aplicación local. La API REST
publicitada por SmartPOS Colombia para terceros documenta facturación/DIAN;
no asumir que acepta comandas de restaurante en SmartPOS 3.9.9 local.

### Preparación comercial antes de conectar

1. Contrato validado para ingresar pedidos en **la instalación local**:
   interfaz del fabricante (API/SDK/plugin/SmartOrder), su autenticación,
   ID real de mesa, producto, variantes, impuestos y formato de respuesta.
2. Mapeo de **todos los productos usados**: para cada producto local
   `restaurant_ops_pos_product_map` con provider `pos360`,
   `external_product_code` correcto, `active=true` y `reviewed_at`
   tras comprobación humana. No aprobar por coincidencia de nombre.
3. Instalar adaptador nativo en Windows que reciba JSON de la comanda y
   devuelva uno de los siguientes resultados **solamente con evidencia**:
   `{"outcome":"accepted","externalOrderId":"ID_POS_REAL"}`,
   `{"outcome":"rejected"}`, `{"outcome":"unknown"}`.
4. Proteger la clave del bridge en archivo privado Windows y registrar
   **solo SHA-256** en `DELIBOCADOS_POS360_BRIDGE_KEY_SHA256` del VPS;
   activar `DELIBOCADOS_POS360_BRIDGE_ENABLED=1` **solo después** de
   validar el adaptador. Nunca pegar el secreto bruto en un chat ni GitHub.
5. Después de completar estas pruebas, marcar integración `pos360`
   `connected/enabled` con control administrativo; recién entonces
   el claim RPC liberará pedidos con mapeo y pago autorizados.

### Pruebas de aceptación indispensables

- Un pedido QR crea una comanda interna y **una** exportación pos360.
- El adaptador toma exclusivamente productos **de esa comanda**, sin volver
  a imprimir el total acumulado de mesa.
- Segunda comanda de Mesa 12: mismo `table_session_id`, otra referencia
  de exportación y solo sus ítems nuevos.
- Ver pedido **dentro de SmartPOS** y papel físico en cocina, confirmar ID.
- Cortar conexión a mitad de envío: se marca `unknown` y no se reenvía
  hasta conciliar manualmente.
- Cancelación y transferencia pendiente nunca disparan pedido sin revisión.
- Cierre de mesa y nuevos clientes no invalidan el QR permanente.
