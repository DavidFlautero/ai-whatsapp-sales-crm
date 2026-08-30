# Evidencia de minimización de datos en logs

## Identificación

- Fecha UTC: `2026-08-30T19:43:39Z`
- Commit fuente: `f7ba30eb3117b6b53ceb7df79e836a9a833a9a7a`
- SHA-256 de migración: `f241c4f2eddaae59bc9d9643c97310ef6dd06d0c8b2309235e3f502c16b9dde2`
- SHA-256 de evidencia automatizada: `d0049238f46cd51b6dd934e0118d1d94dd84f3fb80e4338357258bc5500448de`
- Alcance: logs de aplicación con riesgo de exponer PII.
- Base remota modificada: no.
- Servicios reiniciados: no.

## Resultado técnico

La revisión estructural analizó 212 llamadas de logging.

El resultado validado fue:

- 3 de 3 controles automatizados aprobados;
- 0 propiedades sensibles prohibidas;
- 0 inicializadores sensibles;
- 0 argumentos directos sensibles;
- 0 hallazgos de privacidad restantes;
- 2 métricas derivadas seguras conservadas.

La reparación minimizó 30 llamadas de logging en ocho
archivos. Se eliminaron de los metadatos de logs:

- 24 usos de teléfonos sin minimizar;
- 4 payloads completos;
- 2 cuerpos completos;
- 7 errores potencialmente asociados a contenido sensible;
- 1 mensaje completo;
- 1 mensaje original;
- 1 mensaje normalizado;
- 1 referencia resuelta.

Los eventos operativos y métricas no sensibles se
conservaron cuando eran necesarios para diagnóstico.

## Fuentes verificadas

| Fuente | SHA-256 |
| --- | --- |
| `apps/api/src/services/agent/sales-agent.service.ts` | `5ecf730dc518a70cea1ab4deb2370085dff48a7c8c17e8e4c73fa2a469bcc33c` |
| `apps/api/src/services/catalog/catalog-image.service.ts` | `da57490045390b24c3e33ef5bb923a17613f8127395edc3be20df4f7d5783fda` |
| `apps/api/src/services/orders/order-command-interpreter.service.ts` | `e1fe2d0f0d3256003a9d2a889ac8cf3d91b16abc84ac9d928446b3b8a698c6ca` |
| `apps/api/src/services/orders/whatsapp-order-mutation.service.ts` | `0c6cd77aae1df64ace6253ab154975af88b30cc6b40cfdec549b2bca1fd48766` |
| `apps/api/src/services/orders/whatsapp-order.service.ts` | `2ff964c0108111a1b9faa3c117b9ab3f4e9984362248f74051c798e589ec00c4` |
| `apps/api/src/services/whatsapp/whatsapp-business-profile.service.ts` | `97dcdd73ad74e594966e9cbd1a54c52437ab5329361145f6fdfd4be5af641269` |
| `apps/api/src/services/whatsapp/whatsapp-media.service.ts` | `2fe2b79c9305547267031ef7c8bddd5a489f3ee013693af1d20b710e48b3ad32` |
| `apps/api/src/webhooks/whatsapp.webhook.ts` | `9e69ea3f6b70e69193f0a3218d3f330f7a1bd65dbd28b29f76b6a608b25b5a55` |

## Controles aplicados

1. No registrar números telefónicos completos.
2. No registrar payloads ni cuerpos completos.
3. No registrar mensajes de clientes ni transcripciones.
4. No registrar referencias comerciales resueltas.
5. Mantener únicamente códigos, estados, contadores,
   duraciones y métricas derivadas necesarias.
6. Validar los logs mediante análisis AST reproducible.
7. Impedir la publicación si reaparece un hallazgo.

## Limitaciones

Esta evidencia demuestra controles técnicos locales sobre
el código y los logs examinados. No constituye por sí sola
una certificación RGPD, LOPDGDD, ISO 27001, ISO 27701 ni
una auditoría legal u organizativa independiente.
