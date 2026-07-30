import { ButtonLink, PageHeader, SectionHeading, StatusBadge } from "../_components/PagePrimitives";

export default function CompaniesPage() {
  return (
    <>
      <PageHeader
        kicker="EMPRESAS ASOCIADAS"
        title="Clientes y operaciones"
        description="Administrá cada empresa como un entorno independiente con usuarios, robot, plan, branding y actividad propia."
        actions={<ButtonLink href="/platform/companies/new" kind="primary">+ Agregar empresa</ButtonLink>}
      />

      <section className="saas-section" style={{ marginTop: 0 }}>
        <SectionHeading title="Empresas registradas" description="Una operación activa y el flujo de alta preparado para escalar." aside={<StatusBadge>1 activa</StatusBadge>} />
        <div className="saas-grid two">
          <article className="saas-card saas-company-card">
            <div className="saas-company-head">
              <span className="saas-company-logo">F</span>
              <div><StatusBadge>Activa</StatusBadge><h3>Fulanitas Fábrica</h3><p>fulanitas · Cliente inicial</p></div>
            </div>
            <div className="saas-list">
              <div className="saas-list-row"><span>Robot</span><strong className="saas-success">Conectado</strong></div>
              <div className="saas-list-row"><span>Usuarios</span><strong>3 miembros</strong></div>
              <div className="saas-list-row"><span>Suscripción</span><strong>USD 50 / mes</strong></div>
              <div className="saas-list-row"><span>Última actividad</span><strong>Operación reciente</strong></div>
            </div>
            <div className="saas-card-actions">
              <ButtonLink href="/platform/companies/fulanitas" kind="primary">Abrir empresa</ButtonLink>
              <ButtonLink href="/platform/companies/fulanitas/branding">Editar branding</ButtonLink>
            </div>
          </article>

          <article className="saas-empty">
            <div><span className="saas-company-logo" style={{ margin: "0 auto 18px" }}>+</span><strong>Nueva empresa</strong><p>Vista profesional del proceso de onboarding, conexión de WhatsApp, creación de usuarios y selección de plan.</p><div className="saas-card-actions" style={{ justifyContent: "center" }}><ButtonLink href="/platform/companies/new">Abrir alta guiada</ButtonLink></div></div>
          </article>
        </div>
      </section>
    </>
  );
}
