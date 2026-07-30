import { ButtonLink, CompanyTabs, Metric, PageHeader, SectionHeading, StatusBadge } from "../../_components/PagePrimitives";

export default function FulanitasPage() {
  return (
    <>
      <PageHeader
        kicker="EMPRESA / FULANITAS"
        title="Fulanitas Fábrica"
        description="Centro de control del cliente: operación, robot, usuarios, suscripción, branding y acceso al panel comercial."
        actions={<><ButtonLink href="/platform/companies">Volver</ButtonLink><ButtonLink href="/" kind="primary">Entrar al panel empresarial</ButtonLink></>}
      />
      <CompanyTabs active="Resumen" />

      <section className="saas-metrics">
        <Metric label="Estado" value="Activa" detail="Servicio habilitado" tone="success" />
        <Metric label="Robot" value="Conectado" detail="Meta Cloud API" tone="success" />
        <Metric label="Usuarios" value="3" detail="Admin, supervisor y vendedor" />
        <Metric label="Plan" value="Inicial" detail="USD 50 mensuales" />
        <Metric label="Pago" value="Al día" detail="Estado comercial activo" tone="success" />
      </section>

      <section className="saas-section">
        <SectionHeading title="Resumen operativo" description="Información central de la empresa y sus servicios conectados." aside={<StatusBadge>Operativa</StatusBadge>} />
        <div className="saas-grid two">
          <article className="saas-card">
            <h3>Identidad y servicio</h3>
            <div className="saas-list">
              <div className="saas-list-row"><span>Nombre comercial</span><strong>Fulanitas Fábrica</strong></div>
              <div className="saas-list-row"><span>Identificador</span><strong>fulanitas</strong></div>
              <div className="saas-list-row"><span>Tipo de cliente</span><strong>Comercio mayorista</strong></div>
              <div className="saas-list-row"><span>Panel</span><strong>Centro comercial inteligente</strong></div>
              <div className="saas-list-row"><span>Asistente</span><strong>Asistente Comercial Fulanitas</strong></div>
            </div>
          </article>
          <article className="saas-card">
            <h3>Conectividad</h3>
            <div className="saas-list">
              <div className="saas-list-row"><span>WhatsApp</span><strong className="saas-success">Conectado</strong></div>
              <div className="saas-list-row"><span>Número</span><strong>+54 9 11 6266-7360</strong></div>
              <div className="saas-list-row"><span>Webhook</span><strong className="saas-success">Operativo</strong></div>
              <div className="saas-list-row"><span>IA comercial</span><strong className="saas-success">Operativa</strong></div>
              <div className="saas-list-row"><span>CRM externo</span><strong>Configuración disponible</strong></div>
            </div>
          </article>
        </div>
      </section>

      <section className="saas-section">
        <SectionHeading title="Accesos rápidos" description="Administrá cada área sin perder el contexto de la empresa." />
        <div className="saas-grid">
          {[
            ["Branding", "Nombre, login, color, textos y presentación de la empresa.", "/platform/companies/fulanitas/branding"],
            ["Robot", "Número conectado, proveedor, webhook e inteligencia comercial.", "/platform/companies/fulanitas/robot"],
            ["Usuarios", "Equipo, roles, estado y alcance dentro de Fulanitas.", "/platform/companies/fulanitas/users"],
            ["Suscripción", "Plan, precio mensual, estado de pago y servicios incluidos.", "/platform/companies/fulanitas/subscription"],
            ["Actividad", "Eventos recientes, accesos y cambios importantes.", "/platform/companies/fulanitas/activity"],
            ["Panel empresarial", "CRM, conversaciones, catálogo, campañas y operación diaria.", "/"],
          ].map(([title, description, href]) => (
            <article className="saas-card" key={title}><h3>{title}</h3><p>{description}</p><div className="saas-card-actions"><ButtonLink href={href}>Abrir</ButtonLink></div></article>
          ))}
        </div>
      </section>
    </>
  );
}
