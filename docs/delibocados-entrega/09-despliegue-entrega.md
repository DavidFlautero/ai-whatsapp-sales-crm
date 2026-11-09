# ETAPA 09 — Release, observabilidad, rollback y entrega al restaurante

**Regla:** no conectar servicios externos públicos a una rama experimental y no activar pedidos reales de forma masiva por un test de CI.

## Preparación

1. Congelar commit/PR que aprobó CI, revisar diferencias del branch con `main`, revisar migraciones pendientes y RBAC. No fusionar si hay cambios no auditados.
2. Respaldo probado: BD, .env cifrado, mappings, archivos de configuración PM2, uploads, builds actuales. Probar restauración en entorno aislado; proteger backups.
3. Documentar responsables de negocio: propietario, encargado de cocina, caja y repartidores. Horarios, ubicaciones y tarifario firmado.
4. Confirmar derechos API Toteat: GET + Carga de Órdenes Externas + webhook y Print Server del Windows local; confirmar Whapi activo, Google Maps autorizado, sender/testPhone correcto.
5. Preparar despliegue en carpeta aislada o release atómico: `pnpm install --frozen-lockfile`, API typecheck, dashboard typecheck+build, tests, migraciones incrementales con revisión.
6. Mantener **todos los flags LIVE OFF** antes de reiniciar: `DELIBOCADOS_CHECKOUT_LIVE=0`, `DELIBOCADOS_ORDER_NOTIFICATIONS_LIVE=0`, export Toteat off, webhook off hasta credenciales verificadas.
7. Migraciones en orden y una sola vez. Nunca aplicar `supabase db reset` en producción. Validar esquema final, índices, RLS, roles y triggers.

## Release escalonado

**R0 — preflight solo lectura.** 133 mapeos; turnos y token, origen Maps, 9 zonas habilitadas solo si validas, 5 repartidores, estado Whapi, outbox sin pedidos duplicados.

**R1 — testPhone sin Toteat POST.** Conversación completa, pickup y domicilio; carrito, precios, dirección, pago, confirmación y auditoría. Sin órdenes físicas.

**R2 — Toteat pedido controlado.** Con permiso explícito del dueño y validación de OpenAPI, activar envío para UN pedido/prueba autorizada. Verificar `accepted`, identificador único, Print Server y ticket de cocina.

**R3 — webhooks y cocina.** Habilitar webhook autenticado/worker, comprobar preparar/listo, duplicados, cancelaciones, caída y reconciliación.

**R4 — entrega/caja.** Domicilio dentro de zona con courier, entrega evidenciada y pago conciliado, WhatsApp recibido. Si no hay Maps, habilitar sólo retiro mientras se termina zona.

**R5 — piloto supervisado.** 3 pedidos reales de canales permitidos, operator takeover listo, sin doble POS, sin saldos ambiguos, con alarmas.

**R6 — producción controlada.** Dueño firma aceptación; habilitar flags por tenant y modo. Registrar ventana, rollback, personas de guardia y monitoreo de 48–72 h. No activar indiscriminadamente sin supervisión.

## Observabilidad mínima

- `order_id`, `order_reference`, `company_id`, `provider`, `status`, `attempts`, `latency_ms`, `event_id` y error **sin token**, no dirección completa.
- Indicadores: tasa de órdenes confirmadas/exportadas/aceptadas, `unknown` no reconciliados, tiempo de cocina, retrasos, tiempo de entrega, WhatsApp failed, pendientes de cobro, discrepancias de caja.
- Alertas: Toteat `unknown`, rechazo consecutivo, webhook sin eventos, impresora desconectada, pedidos `ready` sin courier, Whapi inactivo, cola crece, pago pendiente más allá del umbral.

## Rollback operativo

- Deshabilitar primero exports y Whapi público; no borrar filas `unknown` / `accepted`.
- Regresar a versión anterior de API y dashboard; la base de datos mantiene migraciones forward-only (no `drop table`).
- Conservar order_reference, outbox, eventos y pagos; reconciliar con Toteat antes de cualquier reintento tras rollback.
- Revisión manual de pedidos en vuelo y aviso al restaurante (no prometer rollback automático de comandas ya impresas).

## Acta de entrega — marcar con evidencias

- [ ] Código mergeado, CI verde y backup restaurable.
- [ ] Integración API y credenciales propiedad del restaurante, posibilidad de revocar.
- [ ] Catálogo 133/133, cambios de precio auditados.
- [ ] Test pickup completo y ticket observado en cocina.
- [ ] Test delivery completo, courier y prueba de entrega.
- [ ] Transferencia y efectivo conciliados; split probado.
- [ ] Notificaciones reales sin duplicar.
- [ ] Panel de cocina, pagos, repartidores, incidencias accesible con roles.
- [ ] Manual de operación, credenciales de usuarios separadas, política de privacidad.
- [ ] Registro de incidentes, procedimientos de reintento manual, soporte y SLA definidos.
- [ ] Propietario confirma presupuesto de Google Maps, Toteat, Whapi y mantenimiento.
- [ ] Monitoreo del piloto y acta de aprobación firmada.

**Proyecto entregado** sólo al completar aceptación técnica + validación del restaurante. Nunca llamar «completo» a código que todavía no envía/recibe órdenes del POS.
