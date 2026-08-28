# Decisiones arquitectónicas base

## ADR-001 — Empresa explícita

Toda operación empresarial tendrá un `companyId` resuelto desde un contexto autenticado.

## ADR-002 — Sin empresa silenciosa

Ninguna ruta crítica utilizará `fulanitas` o `DEFAULT_COMPANY_ID` como fallback silencioso.

## ADR-003 — Supabase como fuente transaccional

Catálogo, clientes, inventario, conversaciones, pedidos y pagos utilizarán una fuente transaccional compartida.

## ADR-004 — Navegador no autoritativo

`localStorage` podrá usarse para preferencias visuales o borradores, pero no como fuente oficial de ventas, stock o clientes.

## ADR-005 — Autorización por permisos

Los roles se transformarán en permisos explícitos evaluados en el servidor.

## ADR-006 — Auditoría

Toda mutación crítica registrará empresa, actor, acción, entidad, requestId y resultado.

## ADR-007 — Secretos del lado servidor

Las credenciales privilegiadas nunca serán enviadas al navegador ni incluidas en logs.

## ADR-008 — Idempotencia

Webhooks, movimientos de inventario, pagos y creación de pedidos deberán aceptar reintentos sin duplicar operaciones.
