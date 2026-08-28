import { CompanyTabs, PageHeader, SectionHeading, StatusBadge } from "../../../_components/PagePrimitives";

const events=[
["Robot conectado","La integración de WhatsApp está operativa.","Hoy"],
["Usuario administrador activo","La cuenta principal de Fulanitas está habilitada.","Hoy"],
["Branding disponible","El login recibe la identidad configurada desde el servidor.","Hoy"],
["Plan validado","La suscripción Cliente inicial permanece activa.","Este mes"],
["Empresa creada","Fulanitas fue registrada como primera operación del SaaS.","Inicial"],
];
export default function CompanyActivityPage(){return <><PageHeader kicker="FULANITAS / ACTIVIDAD" title="Historial de la empresa" description="Eventos relevantes de usuarios, robot, branding, suscripción y operación empresarial."/><CompanyTabs active="Actividad"/><section className="saas-section" style={{marginTop:0}}><SectionHeading title="Eventos recientes" description="Registro visual preparado para auditoría real por empresa." aside={<StatusBadge>Seguimiento activo</StatusBadge>}/><article className="saas-card"><div className="saas-timeline">{events.map(([title,description,time])=><div className="saas-event" key={title}><span className="saas-event-dot"/><div><strong>{title}</strong><p>{description}</p></div><time>{time}</time></div>)}</div></article></section><section className="saas-section"><SectionHeading title="Categorías de seguimiento" description="La versión final permitirá filtrar y exportar estos eventos."/><div className="saas-grid"><article className="saas-card"><h3>Accesos</h3><p>Inicio y cierre de sesión, invitaciones, bloqueos y cambios de rol.</p></article><article className="saas-card"><h3>Robot</h3><p>Conexiones, pruebas, fallos, webhooks y cambios del agente inteligente.</p></article><article className="saas-card"><h3>Administración</h3><p>Branding, empresa, plan, facturación y configuración operativa.</p></article></div></section></>}
