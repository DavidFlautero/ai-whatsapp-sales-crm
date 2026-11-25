# Delibocados · Mesa 1: piloto QR de una sola orden (24 Nov 2026)

## Estado verificado antes de esta implementación

- VPS `/var/www/control`, `neuromind-api` PM2 online; POST autenticado a
  `/api/public/delibocados-pos360-bridge/health` devuelve
  `{ok:true,state:"listening"}` desde Windows.
- Worker `delibocados-pos360-pull-bridge-pilot-v5.ps1` instalado en Windows;
  ejecutado sin `-RunPilotOnce`: autenticado, `CLAIM=0`.
- Adaptador `SmartPOS-Adapter-v5.ps1` validado con Preflight solo lectura:
  Mesa 1 libre, `deli-006` Hamburguesa Res, `DLB-P-0006`, COP 14.000,
  `ROUNDTRIP=OK`, `UNAPPROVED=0`, `WRITES=0`.
- Integración empresa POS360: inicialmente `pending/false` (NO habilitada).
- Seis exportaciones POS360 históricas `pending`, sin aprobar en allowlist.
  La función `restaurant_ops_pos360_claim_pilot` y su tabla existen; 0
  entradas de allowlist activas.
- Original SmartPOS Mesa 4 tiene dos hamburguesas persistidas; Cocina mostró
  visualmente la segunda (id=10, estado NULL) DESPUÉS de corregir su estado.
  NO está demostrado que un pedido nuevo se muestre como Nueva por sí solo.
- `DELIBOCADOS_QR_CHECKOUT_ENABLED` OFF, checkout público bloqueado. Se
  corrigió el origen CORS para `delibocados.online` directamente en VPS.
- PR #40 es un borrador (sin merge). No asumir que su contenido está desplegado.

## Cambios específicos de este piloto

1. `restaurant-qr-public.routes.ts`: agrega
   `DELIBOCADOS_QR_MESA1_PILOT_ENABLED` (OFF si no es `1`).
   Rechaza mezclarlo con checkout público general. Con el piloto armado, el
   `context` únicamente habilita pedidos de Mesa 1 y muestra exclusivamente
   `deli-006` a COP 14.000. No cambia el QR ni el token existente.
2. Migración `20261124150000_delibocados_qr_mesa1_single_use.sql`: crea
   `restaurant_ops_qr_single_use_pilot` con un único registro, deshabilitado;
   provisiona Mesa 1 solo si su registro es único y activo.
   `restaurant_ops_create_qr_order_pilot` revalida QR, mesa, SKU, precio,
   pago en efectivo, aprobación POS360, revisión del menú y tiempo de
   autorización; bloquea el registro con `FOR UPDATE`, crea orden + outbox
   en UNA transacción y marca puerta consumida. Solamente la misma
   `sourceKey` puede repetir el resultado de forma idempotente.
3. No modifica SmartPOS, Cocina, trabajador de Windows ni las 6 exportaciones.

## Despliegue en modo seguro, SIN activar checkout

1. Copiar desde la rama del PR solo la ruta QR y la migración al VPS. Hacer
   copias y verificar cambios locales previamente; NO hacer `git pull`
   ciego (el VPS tiene modificaciones locales en `routes/index.ts`).
2. Ejecutar `pnpm --filter @ventas/api typecheck` en VPS.
3. Aplicar migración con `psql -v ON_ERROR_STOP=1`. Al fallar, no iniciar
   checkout; PostgreSQL hace rollback del bloque `BEGIN/COMMIT`.
4. Reiniciar exclusivamente `neuromind-api` con
   `DELIBOCADOS_QR_CHECKOUT_ENABLED=0` y
   `DELIBOCADOS_QR_MESA1_PILOT_ENABLED=0`.
5. Comprobar: `restaurant_ops_qr_single_use_pilot.enabled=false`,
   `consumed_at IS NULL`, seis exportaciones originales todavía pendientes,
   `/order` devuelve 503 mientras el piloto está deshabilitado.

## Antes de armar el único envío

Todos los puntos son obligatorios:
- Verificar en vivo el worker piloto real y adaptador local exactos (los
  trabajadores de producción anteriores NO usan la allowlist).
- Habilitar `company_integrations(provider=pos360)` solo después de la
  verificación operacional y con `FULL_CLAIM_ENABLED=0`.
- Confirmar Mesa 1 libre, impresora/Cocina bajo observación, puente local
  en `CONTROLLED_CANARY` para Mesa 1 solo por intervalo breve; validar
  ausencia de una orden QR con el mismo `sourceKey`.
- Crear allowlist Windows para el `exportId` NUEVO solamente; asegurar
  `approved_for_dispatch` en el mapeo local únicamente Mesa 1.
- Confirmar 0 aprobaciones previas y 6 históricos excluidos. No autorizar
  exportaciones antiguas. Evitar usar un job sintetizado con UUID arbitrario
  como si hubiera sido creado en el VPS.

## Armado acotado, SOLO después de todos los controles

Configurar proceso API exclusivamente para piloto, manteniendo el checkout
general apagado:

```bash
DELIBOCADOS_QR_CHECKOUT_ENABLED=0 DELIBOCADOS_QR_MESA1_PILOT_ENABLED=1 \
  pm2 restart neuromind-api --update-env
```

Autorizar UNA ventana en PostgreSQL; el registro debe existir, estar libre,
ser Mesa 1 y estar deshabilitado:

```sql
UPDATE public.restaurant_ops_qr_single_use_pilot
SET enabled=true, valid_from=now(), expires_at=now()+interval '10 minutes',
    approved_by='operator-20261124'
WHERE singleton=1 AND company_id='delibocados'
  AND enabled=false AND consumed_at IS NULL
  AND order_id IS NULL AND source_key IS NULL
  AND table_id=(SELECT id FROM public.restaurant_ops_qr_tables
    WHERE company_id='delibocados' AND label='Mesa 1' AND enabled=true);
```

Comprobar `UPDATE 1`; cualquier otro resultado impide el envío.

Desde el QR físico Mesa 1 crear **una** Hamburguesa Res x1 por COP 14.000,
efectivo, sin modificadores, anotación `PRUEBA - NO COBRAR`.
El servicio crea un pedido/una exportación pendientes y consume la puerta.
En ese instante **no** afirma que POS360 ni Cocina lo hayan recibido.

Consultar solamente el `exportId` NUEVO mediante la tabla puerta +
`restaurant_ops_pos_exports`, aprobar ese UUID en VPS en
`restaurant_ops_pos360_pilot_allowlist` con vencimiento breve, y en la
allowlist local de Windows; sin esto no se puede reclamar.
Ejecutar el worker en modo piloto de UNA ejecución, supervisado. No usar
`/claim` general ni polling continuo.

Verificar físicamente original SmartPOS y Cocina, y consultar en MySQL que
`auxiliary IS NULL AND completetime IS NULL` en la nueva línea. Si está
`auxiliary=3` u otro estado incorrecto, DETENER y no usar en producción.
Conciliar export `accepted/unknown/rejected`, no volver a ejecutar el
`commit` ni reabrir el QR para crear otra orden.

## Apagar inmediatamente después

```bash
DELIBOCADOS_QR_CHECKOUT_ENABLED=0 DELIBOCADOS_QR_MESA1_PILOT_ENABLED=0 \
  pm2 restart neuromind-api --update-env
```

Desactivar la puerta en SQL si no se consumió y mantener
`DELIBOCADOS_POS360_FULL_CLAIM_ENABLED=0`.
Volver a puente local `Disabled`; no dejar `CONTROLLED_CANARY` abierto.

**Advertencia**: Aun con el API `/health` autenticado, el envío E2E REAL
NO ha sido probado. No activar checkout general hasta confirmar estado
inicial de Cocina, persistencia y comprobante nativo, pagos e impresión.
