# Evidencia de validación local de privacidad

## Identificación

- Fecha UTC: `2026-08-30T18:47:28Z`
- Commit fuente: `f7ba30eb3117b6b53ceb7df79e836a9a833a9a7a`
- Migración validada: `20260828090000_privacy_compliance_core.sql`
- SHA-256 de la migración: `f241c4f2eddaae59bc9d9643c97310ef6dd06d0c8b2309235e3f502c16b9dde2`
- Alcance: base PostgreSQL local y aislada
- Base remota de producción modificada: **No**
- Servicios reiniciados: **No**
- Certificación formal declarada: **No**

## Resultado ejecutivo

La implementación técnica de privacidad superó las dos
capas automatizadas disponibles en esta fase:

| Capa | Resultado | Persistencia de fixtures |
| --- | ---: | --- |
| Pruebas dinámicas PostgreSQL | 12 de 12 | Ninguna; transacción revertida |
| Controles estáticos de fuente | 17 de 17 | No aplica |

Este resultado demuestra el funcionamiento técnico de los
controles examinados sobre una base aislada. No reemplaza una
auditoría jurídica, organizativa o de certificación independiente.

## Controles dinámicos validados

1. Rechazo de acceso RPC entre empresas.
2. Control optimista de versión.
3. Separación entre aprobador y ejecutor de una supresión.
4. Transición válida usando el rol de servicio.
5. Rechazo de modificaciones de campos protegidos.
6. Bloqueo de supresión por retención legal activa.
7. Cadena de eventos enlazada mediante SHA-256.
8. Rechazo de activación de políticas entre empresas.
9. Activación atómica de políticas.
10. Denegación RLS cuando no existe política autorizante.
11. Bypass controlado para el rol de servicio.
12. Filtros explícitos de empresa en el repositorio.

## Controles estáticos validados

1. Existencia de nueve tablas de privacidad.
2. RLS habilitado en las nueve tablas.
3. RLS forzado en las nueve tablas.
4. RPC atómico de transición de solicitudes.
5. RPC atómico de activación de políticas.
6. Control dual dentro de la base.
7. Bloqueo mediante legal hold.
8. Control optimista de concurrencia.
9. Repositorio con operaciones atómicas.
10. Once permisos específicos de privacidad.
11. El rol administrador no puede aprobar supresiones.
12. El rol administrador no puede ejecutar supresiones.
13. Once rutas administrativas protegidas.
14. Contexto de empresa obligatorio.
15. Ausencia deliberada de borrado directo.
16. Payloads de Supabase excluidos de logs.
17. Transcripciones de audio excluidas de logs.

## Integridad de las evidencias

- Evidencia dinámica:
  `privacy-db-selftest.latest.log`
- SHA-256 de evidencia dinámica:
  `4f669c20c4ad7884b9f73733ca1f1b4181714b6231e1dc882c96540ed62a26e5`
- Evidencia estática:
  `privacy-static-selftest.latest.log`
- SHA-256 de evidencia estática:
  `ddbba8062471860788cae8a51692979833e027e3dbe38451766ffa2465b2a8a7`

## Límites de esta validación

Esta validación todavía no demuestra:

- aplicación de la migración en la base remota;
- comportamiento sobre datos reales de producción;
- ejecución completa de exportación o supresión por almacén;
- cumplimiento jurídico integral del RGPD o la LOPDGDD;
- conformidad certificada con ISO 27001, ISO 27701 o EU AI Act;
- eficacia de procesos humanos, contratos, respuesta a incidentes
  o políticas organizativas.

Esas comprobaciones pertenecen a las siguientes etapas del
programa de cumplimiento.
