import {
  ButtonLink,
  Metric,
  PageHeader,
  SectionHeading,
  StatusBadge,
} from "./_components/PagePrimitives";

const modules = [
  ["Empresas", "Operativo", "Administración de clientes, robots, usuarios y configuración individual.", "/platform/companies"],
  ["Robots", "1 conectado", "Supervisión de números, webhooks, proveedor e inteligencia comercial.", "/platform/robots"],
  ["Suscripciones", "Vista comercial", "Seguimiento de planes, renovaciones, pagos y estado del servicio.", "/platform/subscriptions"],
  ["Usuarios", "4 configurados", "Control de superadministradores y equipos asociados a cada empresa.", "/platform/users"],
  ["Facturación", "USD 50 MRR", "Resumen de ingresos registrados y próximos vencimientos.", "/platform/billing"],
  ["Estado del sistema", "Operativo", "Salud de API, dashboard, almacenamiento, WhatsApp e IA.", "/platform/system"],
] as const;

export default function PlatformPage() {
  return (
    <>
      <PageHeader
        kicker="CENTRO DE ADMINISTRACIÓN SAAS"
        title="Control global de la plataforma"
        description="Empresas, robots, usuarios, conexiones y crecimiento comercial desde una única operación."
        actions={
          <>
            <ButtonLink href="/platform/companies" kind="ghost">Ver empresas</ButtonLink>
            <ButtonLink href="/platform/companies/new" kind="primary">+ Agregar empresa</ButtonLink>
          </>
        }
      />

      <section className="saas-metrics">
        <Metric label="Empresas activas" value="1" detail="Fulanitas Fábrica" />
        <Metric label="Robots conectados" value="1" detail="WhatsApp operativo" />
        <Metric label="Usuarios registrados" value="4" detail="Plataforma y empresa" />
        <Metric label="Ingreso mensual" value="USD 50" detail="Cliente inicial" />
        <Metric label="Estado del sistema" value="Operativo" detail="API y panel en línea" tone="success" />
      </section>

      <section className="saas-section">
        <SectionHeading
          title="Operaciones comerciales"
          description="Empresas asociadas y estado actual de cada operación."
          aside={<StatusBadge>1 empresa activa</StatusBadge>}
        />

        <div className="saas-grid two">
          <article className="saas-card saas-company-card">
            <div className="saas-company-head">
              <span className="saas-company-logo">F</span>
              <div>
                <StatusBadge>Activa</StatusBadge>
                <h3>Fulanitas Fábrica</h3>
                <p>Cliente inicial · Comercio mayorista</p>
              </div>
            </div>

            <div className="saas-company-stats">
              <div className="saas-stat-box"><span>Robot WhatsApp</span><strong>Conectado</strong></div>
              <div className="saas-stat-box"><span>Número</span><strong>+54 9 11 6266-7360</strong></div>
              <div className="saas-stat-box"><span>Usuarios</span><strong>3</strong></div>
              <div className="saas-stat-box"><span>Plan</span><strong>Cliente inicial</strong></div>
              <div className="saas-stat-box"><span>Pago mensual</span><strong>USD 50</strong></div>
              <div className="saas-stat-box"><span>IA comercial</span><strong>Operativa</strong></div>
            </div>

            <div className="saas-card-actions">
              <ButtonLink href="/platform/companies/fulanitas" kind="primary">Administrar empresa</ButtonLink>
              <ButtonLink href="/platform/companies/fulanitas/robot">Ver robot</ButtonLink>
            </div>
          </article>

          <article className="saas-empty">
            <div>
              <span className="saas-company-logo" style={{ margin: "0 auto 18px" }}>+</span>
              <strong>Agregar nueva empresa</strong>
              <p>Prepará un nuevo espacio independiente con WhatsApp, CRM, usuarios, robot, métricas y configuración propia.</p>
              <div className="saas-card-actions" style={{ justifyContent: "center" }}>
                <ButtonLink href="/platform/companies/new">Ver flujo de alta</ButtonLink>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="saas-section">
        <SectionHeading title="Infraestructura SaaS" description="Todas las áreas del producto presentadas como módulos navegables." />
        <div className="saas-grid">
          {modules.map(([title, status, description, href]) => (
            <article className="saas-card" key={title}>
              <div className="saas-card-top">
                <span className="saas-company-logo" style={{ width: 38, height: 38, borderRadius: 11, fontSize: ".85rem" }}>{title.charAt(0)}</span>
                <StatusBadge tone={status === "Operativo" ? "success" : "neutral"}>{status}</StatusBadge>
              </div>
              <h3 style={{ marginTop: 18 }}>{title}</h3>
              <p>{description}</p>
              <div className="saas-card-actions"><ButtonLink href={href}>Abrir módulo</ButtonLink></div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
