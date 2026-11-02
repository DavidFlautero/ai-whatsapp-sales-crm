# Dominios y propietarios por empresa (fase 1)

Rama: `feat/superadmin-dominios-propietarios-20261102`.

## Alcance
- Alta de empresas conserva la RPC transaccional existente.
- Alta permite pedir dominio propio o subdominio y su destino (menú o panel). El alta del dominio ocurre **después** de crear la empresa; si falla, se redirige a administración para completar el registro sin crear duplicados.
- Administración de empresa incluye editar correo y contraseña del usuario `owner` activo y registrar un dominio por destino.
- Los correos de usuarios existentes definidos por `AUTH_USERS_JSON` están reservados, para evitar colisiones con cuentas globales.
- Los registros se guardan en PostgreSQL en `platform_company_domains` y `crm_auth_users`, aislados por `company_id`.
- Un dominio registrado empieza en `pending_dns`. Verificar DNS lo deja como `dns_verified`. **No se marca activo sin configurar Nginx + TLS y comprobar que sirve la empresa correcta**.

## Despliegue seguro
1. Construir y probar la rama en un worktree independiente, SIN reemplazar los procesos actuales ni tocar Eventos Mediterráneo.
2. Backup de PostgreSQL, ejecutar `supabase/migrations/20261102080000_platform_company_domains.sql`.
3. Comprobar la ruta API activa. En producción Nginx actualmente dirige las rutas `/api/platform/companies` al puerto 3200; la implementación del endpoint debe estar disponible en ese mismo flujo hacia el backend de la plataforma antes de publicar el frontend.
4. Desplegar el frontend multiempresa aislado; comprobar creación/actualización en un tenant de prueba; no escribir en `/var/www/control`.
5. En `/platform/companies/manage/delibocados`: actualizar el usuario propietario con correo **distinto** del superadmin, registrar `delibocadosfunza.com` como dominio propio para el menú y comprobar DNS.
6. Configurar un bloque Nginx específico para el host, conservar las rutas existentes, emitir HTTPS con certbot y probar host/certificado/carta. Solo entonces cambiar estado a `active` en el registro. **La fase 1 no automatiza este último paso.**
7. Registrar el dominio de administración por separado (por ejemplo un subdominio) únicamente si el propietario lo necesita y está configurado DNS+TLS.
8. Pruebas obligatorias: login superadmin, login owner con `company_id=delibocados`, editor y QR protegidos, menú público, acceso a Eventos Mediterráneo, sin información cruzada.
9. Nunca almacenar credenciales o secretos de DNS en el frontend ni permitir que una petición pública ejecute comandos Nginx/Certbot como root.

## Deshacer
La rama nunca se incorpora directamente en el código histórico de eventos. Si el test falla, detener el despliegue aislado y volver a la revisión anterior. No revertir la tabla de dominios sin comprobar datos de clientes.
