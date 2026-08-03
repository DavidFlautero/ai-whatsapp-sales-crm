# Etapa 0 — Auditoría arquitectónica completada

## Identidad

- Proyecto: `/opt/ventas-ia-mayorista`
- Respaldo seguro: `/root/backups/architecture-freeze-20260731-163322`
- Archivos analizados: 206
- Rutas detectadas: 76
- Señales de persistencia: 108
- Señales de riesgo: 97
- Variables registradas por nombre: 12

## Contrato HTTP

- API local: `200`
- Dashboard local: `200`
- Login público: `200`
- Integraciones sin sesión: `307`
- API de Integraciones sin sesión: `401`

## Validaciones

- API TypeScript: aprobado
- Dashboard TypeScript: aprobado
- ventas-api: online
- ventas-dashboard: online
- Supabase: no modificado
- PM2: no reiniciado

## Próxima arquitectura

La siguiente etapa instalará un kernel aislado para:

1. contexto multiempresa;
2. permisos específicos;
3. matriz RBAC;
4. selección explícita de empresa para superadmin;
5. bloqueo de acceso cruzado;
6. requestId y contexto de auditoría.

El kernel se instalará inicialmente sin reemplazar el login ni las rutas actuales.
