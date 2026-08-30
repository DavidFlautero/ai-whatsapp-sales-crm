# Controles técnicos de privacidad

## Identificación de evidencia

- Commit base: `f7ba30eb3117b6b53ceb7df79e836a9a833a9a7a`
- Evidencia generada: `2026-08-28T14:32:26Z`
- Selftest: `scripts/privacy-compliance-selftest.mjs`
- Migración: `20260828090000_privacy_compliance_core.sql`
- Controles estáticos aprobados: **17 de 17**
- Migración aplicada a producción: **No**
- Servicios reiniciados durante esta etapa: **No**

## Alcance

Este documento registra los controles técnicos implementados
en el módulo multiempresa de privacidad del sistema.

No constituye por sí solo una certificación jurídica,
certificación ISO, declaración de cumplimiento RGPD/LOPDGDD
ni evaluación de conformidad con el EU AI Act.

La conformidad formal requiere además políticas operativas,
registros de tratamiento, contratos, análisis jurídico,
evidencias continuas, gestión de incidentes y, cuando
corresponda, auditoría independiente.

## Controles técnicos implementados

### Autorización y separación de funciones

- Once permisos RBAC específicos de privacidad.
- Separación entre lectura, verificación, aprobación y ejecución.
- Administradores ordinarios no pueden aprobar solicitudes.
- Administradores ordinarios no pueden ejecutar supresiones.
- Aprobación y ejecución reservadas a roles autorizados.
- Contexto de empresa obligatorio en las rutas administrativas.

### Aislamiento multiempresa

- Todas las operaciones de repositorio incluyen `company_id`.
- El tenant se obtiene mediante contexto autenticado.
- El encabezado `X-Company-Id` está admitido por la API.
- Las nueve tablas de privacidad tienen RLS habilitado.
- Las nueve tablas tienen RLS forzado.
- Los roles `anon` y `authenticated` no poseen acceso directo.
- El acceso de infraestructura queda limitado a `service_role`.

### Derechos de las personas

- Solicitudes ARCO/DSAR modeladas.
- Acceso y exportación modelados.
- Rectificación y restricción modeladas.
- Oposición y supresión modeladas.
- Verificación de identidad registrada.
- Fechas de recepción y vencimiento registradas.
- Estados y transiciones controlados.
- Solicitudes protegidas mediante idempotencia.

### Consentimiento y base jurídica

- Consentimientos vinculados a una finalidad.
- Estado, fuente y versión del aviso registrados.
- Evidencia pseudonimizada mediante digest.
- Base jurídica modelada de forma independiente.
- Retirada y sustitución de consentimiento modeladas.
- Políticas de privacidad versionadas por empresa.

### Supresión y conservación

- No existe una operación genérica de borrado directo.
- La ejecución destructiva requiere workflow autorizado.
- Los legal holds pueden impedir una supresión.
- La lista de supresión puede impedir una reimportación.
- Las políticas incluyen períodos de retención por categoría.
- Exportaciones modeladas con cifrado y expiración.
- El ejecutor real idempotente por almacén sigue pendiente.

### Integridad y auditoría

- Eventos de solicitud append-only.
- Secuencia monotónica por solicitud.
- Cadena de evidencia con SHA-256.
- Actor, correlación y momento del evento registrados.
- Transición y evento se realizan en un RPC atómico.
- La activación de políticas se realiza en un RPC atómico.
- Se utiliza control optimista mediante versión esperada.
- La doble intervención se valida también en base de datos.

### Minimización de logs

- Los errores Supabase no imprimen el payload completo.
- Las transcripciones de audio no se escriben en logs.
- Los identificadores se diseñaron para almacenamiento
  pseudonimizado.
- El selftest comprueba que no reaparezcan esos logs inseguros.

## Controles técnicos todavía pendientes

- Aplicar la migración contra una base PostgreSQL real.
- Validar rollback de la migración en un entorno aislado.
- Ejecutar pruebas tenant A contra tenant B.
- Implementar el ejecutor idempotente de supresión.
- Crear adaptadores por cada almacén de datos personales.
- Implementar el exportador cifrado completo.
- Implementar descarga temporal con autorización.
- Implementar jobs automáticos de retención.
- Implementar expiración y destrucción de exportaciones.
- Implementar el flujo de solicitud desde WhatsApp.
- Implementar el panel administrativo de privacidad.
- Implementar métricas, alertas y colas de vencimiento.
- Verificar cifrado de backups y restauración.
- Formalizar rotación de claves y secretos.
- Crear pruebas dinámicas de RLS en PostgreSQL.

## Trabajo organizativo y jurídico pendiente

- Inventario/RAT de actividades de tratamiento.
- Identificación documentada de responsables y encargados.
- Contratos DPA con proveedores y clientes.
- Evaluación de transferencias internacionales.
- Política publicada de privacidad y conservación.
- Procedimiento documentado para derechos de interesados.
- Procedimiento de incidentes y notificación de brechas.
- DPIA cuando el tratamiento lo requiera.
- Evaluación de transparencia para interacciones con IA.
- Revisión jurídica aplicable a cada país y cliente.
- Auditoría independiente si se busca certificación formal.

## Criterio de publicación

Este módulo no debe anunciarse como certificado hasta que:

1. La migración haya sido probada y aplicada.
2. Las pruebas dinámicas multiempresa hayan sido aprobadas.
3. Los ejecutores de exportación y supresión estén operativos.
4. Existan políticas y procedimientos organizativos reales.
5. Una revisión jurídica valide las afirmaciones comerciales.
6. Una entidad competente audite cualquier certificación
   que se pretenda publicar.

<!-- PRIVACY_LOCAL_VALIDATION_START -->

## Evidencia automatizada de validación local

La fase local de controles técnicos fue validada sobre una
base PostgreSQL aislada y transaccional:

- pruebas dinámicas: **12 de 12**;
- controles estáticos: **17 de 17**;
- fixtures persistidos después de las pruebas: **0**;
- rollback transaccional: **confirmado**;
- base remota modificada durante esta validación: **no**;
- commit fuente: `f7ba30eb3117b6b53ceb7df79e836a9a833a9a7a`;
- SHA-256 de la migración: `f241c4f2eddaae59bc9d9643c97310ef6dd06d0c8b2309235e3f502c16b9dde2`;
- SHA-256 del documento de evidencia: `7d63d471b6300b00771615c54cd644ca35faea3db25428fe0dba20c3699737b9`.

La evidencia detallada está disponible en
[`evidence/privacy-local-validation.md`](evidence/privacy-local-validation.md).

Esta evidencia acredita controles técnicos verificados, pero no
constituye por sí sola una certificación jurídica, ISO o regulatoria.

<!-- PRIVACY_LOCAL_VALIDATION_END -->

<!-- PRIVACY_LOG_MINIMIZATION:START -->
## Minimización y redacción de logs

El sistema incorpora controles estructurales para evitar
que datos personales o contenido de conversaciones sean
incluidos en logs operativos.

La validación actual confirma:

- 212 llamadas de logging inspeccionadas;
- 30 llamadas minimizadas;
- 24 teléfonos sin minimizar eliminados;
- 4 payloads completos eliminados;
- 2 cuerpos completos eliminados;
- mensajes, referencias y errores asociados minimizados;
- 3 de 3 controles de logs aprobados;
- 0 hallazgos de privacidad restantes;
- conservación de métricas derivadas no sensibles.

Evidencias reproducibles:

- `docs/compliance/evidence/privacy-log-redaction.md`;
- `docs/compliance/evidence/privacy-log-selftest.latest.log`;
- `scripts/privacy-log-selftest.mjs`.

Este control reduce exposición accidental de PII, pero no
sustituye políticas organizativas, revisión legal,
monitorización en producción ni auditoría independiente.
<!-- PRIVACY_LOG_MINIMIZATION:END -->
