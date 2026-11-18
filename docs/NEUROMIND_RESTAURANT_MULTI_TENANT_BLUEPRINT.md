# Neuromind — Restaurante reutilizable desde Super Admin

## Objetivo

Alta desde Super Admin sin copiar código, credenciales, órdenes, tablas ni
archivos de Delibocados. El sistema se prepara desactivado. Un HTTP 200 o una
escritura SQL no demuestran por sí mismos que el POS o la DIAN aceptó un documento.

**Esta rama implementa el aprovisionamiento seguro y la visibilidad de
preparación. NO es un puente SmartPOS multiempresa certificado, ni un emisor
DIAN habilitado.**

## Componentes implementados

- Migración 20261118180000_platform_restaurant_blueprints.sql.
- RPC idempotente platform_prepare_restaurant_blueprint(company_id).
- Trigger de plantilla al crear empresas del sector restaurant.
- Nueve etapas de preparación por empresa, sin aprobación automática.
- Integraciones native, whapi, toteat, pos360 y dian pendientes/desactivadas.
- Módulos comerciales kitchen y fiscal inicialmente apagados.
- API Super Admin para consultar el estado y preparar registros.
- Vista /platform/companies/{companyId}/restaurant-setup.
- Bootstrap Windows sin red, sin secretos y sin escritura al POS.
- Smoke transaccional que termina con ROLLBACK.

## Nueva empresa

1. Super Admin: Empresas > Agregar empresa > Sector Restaurante.
2. Indicar identificador, propietario, plan y moneda.
3. La RPC actual crea empresa y CRM con estado pendiente.
4. Los triggers provisionan agentes IA e integraciones sin habilitar servicios.
5. Super Admin muestra preparación, avances y bloqueos por compañía.
6. Configurar menú, mesas, zonas, WhatsApp y proveedores de cada cliente.
7. Probar el POS nativo, las dos pantallas KDS y conciliación de órdenes.
8. Activar únicamente mediante un futuro procedimiento separado, con evidencia.

Para una empresa existente, POST
/platform/companies/:companyId/restaurant-setup/prepare con body JSON vacío.
La preparación es idempotente y no reemplaza datos ni credenciales existentes.

Los endpoints requieren sesión superadmin:

- GET /platform/companies/:companyId/restaurant-setup
- POST /platform/companies/:companyId/restaurant-setup/prepare

La API devuelve productionReady=false intencionadamente. Los contadores de
configuración NO equivalen a certificación operativa ni aceptación fiscal.

## Migración y prueba

Aplicar tras respaldo y revisión técnica. Después, en entorno de pruebas:

    psql -X -v ON_ERROR_STOP=1 -f apps/api/src/scripts/platform-restaurant-blueprint-smoke.sql

El smoke crea un restaurante temporal en una transacción y termina con
ROLLBACK. Verifica que existen nueve etapas y cinco integraciones apagadas.

Además ejecutar typecheck de la API, build del dashboard, revisión de migración
y prueba de autorización de superadmin. No desplegar esta rama sin CI y backup.

## Bootstrap local Windows

Modo de simulación:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/windows/neuromind-restaurant-connector-setup.ps1 -CompanyId restaurante-demo -ApiBaseUrl https://panel.example.com/api -WhatIf

Sin WhatIf crea un manifiesto aislado por empresa en LOCALAPPDATA, con flags
apagados. No es un servicio, no usa secretos, no conecta ni escribe SmartPOS.

## Bloqueos que siguen pendientes para producción

1. restaurant-ops.routes.ts contiene restricciones fijas de Delibocados.
   Refactorizar a contexto tenant autenticado con pruebas RLS.
2. restaurant-pos360-bridge.routes.ts y las RPC claim/finish históricas usan
   el identificador del cliente como literal. Diseñar v2 independiente con
   credenciales y claves por empresa. No tocar el puente v1 de producción.
3. Validar adaptador nativo SmartPOS y comprobante durable del POS;
   escribir sharedtickets en laboratorio no confirma comanda impresa.
4. Aprobar SKUs por empresa, conciliar exportaciones pendientes e impedir
   importar pedidos históricos al activar un nuevo conector.
5. Probar pantallas KDS e impresoras con comprobantes reales, reintentos,
   recuperación de red, concurrencia e idempotencia.
6. DIAN: definir factura electrónica vs documento equivalente electrónico;
   proveedor autorizado o software propio habilitado; numeración, firma,
   validación, errores, contingencias y conciliación. Registrar el conector
   no implica estar habilitado ni enviar una factura.
7. Los módulos del Super Admin son switches comerciales: falta que todas las
   rutas operativas apliquen esas políticas antes de vender activaciones.
8. Implementar activación explícita auditada, supervisión, rotación de claves,
   reconciliación de estados unknown y plan de reversión.

## Invariantes

- Ningún cruce de datos o credenciales entre empresas.
- Ningún envío externo durante aprovisionamiento.
- Ninguna clave en GitHub ni en el manifiesto Windows.
- Ningún ACK accepted sin recibo duradero verificable.
- No reintentos automáticos de aceptación ambigua.
- Delibocados actual no debe alterarse por preparar otro restaurante.
