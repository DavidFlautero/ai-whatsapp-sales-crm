import { PageHeader, SectionHeading, StatusBadge } from "../_components/PagePrimitives";

const events=[
["Inicio de sesión superadmin","Administrador de Plataforma accedió al centro SaaS.","Hace instantes"],
["Robot verificado","La conexión de WhatsApp de Fulanitas respondió correctamente.","Hoy"],
["Branding cargado","El login leyó la configuración persistente de la plataforma.","Hoy"],
["Suscripción validada","Fulanitas permanece activa en el plan Cliente inicial.","Este mes"],
["Usuario autenticado","Admin Fulanitas dispone de acceso empresarial.","Este mes"],
];
export default function ActivityPage(){return <><PageHeader kicker="ACTIVIDAD" title="Auditoría y eventos" description="Historial visual de accesos, cambios, pruebas técnicas y acciones relevantes de la plataforma."/><section className="saas-section" style={{marginTop:0}}><SectionHeading title="Actividad reciente" description="La versión final registrará actor, empresa, IP, acción, resultado y fecha sin almacenar secretos." aside={<StatusBadge>Monitoreo activo</StatusBadge>}/><article className="saas-card"><div className="saas-timeline">{events.map(([title,description,time])=><div className="saas-event" key={title}><span className="saas-event-dot"/><div><strong>{title}</strong><p>{description}</p></div><time>{time}</time></div>)}</div></article></section><section className="saas-section"><SectionHeading title="Filtros de auditoría" description="Vista preparada para búsquedas por empresa, usuario, módulo, severidad y rango de fechas."/><div className="saas-grid"><article className="saas-card"><h3>Seguridad</h3><p>Inicios de sesión, cierres, intentos fallidos y cambios de permisos.</p></article><article className="saas-card"><h3>Configuración</h3><p>Branding, robot, plan, empresa y parámetros operativos modificados.</p></article><article className="saas-card"><h3>Operación</h3><p>Pruebas de conexión, webhooks, integraciones y eventos del sistema.</p></article></div></section></>}
