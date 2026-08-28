# Registro inicial de riesgos

Estas coincidencias son señales técnicas para revisión. No representan por sí mismas vulnerabilidades confirmadas.

## Conteos encontrados

- `DEFAULT_COMPANY_VARIABLE`: 2
- `DIRECT_PROCESS_ENV_ACCESS`: 19
- `FILESYSTEM_PERSISTENCE`: 4
- `HARDCODED_COMPANY_FULANITAS`: 24
- `LOCAL_STORAGE_DEPENDENCY`: 7
- `POSSIBLE_EMPTY_CUSTOMERS`: 1
- `POSSIBLE_EMPTY_ORDERS`: 1
- `POSSIBLE_EMPTY_STOCK`: 1
- `RAW_CONSOLE_ERROR`: 10
- `TECHNICAL_DEBT_MARKER`: 5
- `UNSAFE_ANY_TYPE`: 23

## Prioridades arquitectónicas

1. Centralizar la resolución de empresa.
2. Eliminar la persistencia empresarial basada en localStorage.
3. Reemplazar respuestas vacías y mocks por repositorios reales.
4. Centralizar el acceso a variables de entorno e integraciones.
5. Evitar persistencia en archivos JSON para operaciones transaccionales.
6. Aplicar autorización por permisos específicos.
7. Añadir requestId e identificación del actor a cada mutación.
8. Asegurar idempotencia en webhooks, pedidos, pagos y stock.
