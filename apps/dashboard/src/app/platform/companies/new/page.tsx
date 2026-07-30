import { ButtonLink, PageHeader, SectionHeading, StatusBadge } from "../../_components/PagePrimitives";

export default function NewCompanyPage() {
  return (
    <>
      <PageHeader
        kicker="ONBOARDING MULTIEMPRESA"
        title="Agregar una nueva empresa"
        description="Vista completa del flujo comercial que permitirá activar un nuevo cliente con identidad, usuarios, WhatsApp, robot y suscripción independientes."
        actions={<ButtonLink href="/platform/companies">Volver a empresas</ButtonLink>}
      />

      <div className="saas-callout">Esta pantalla presenta el alcance completo del módulo. El aprovisionamiento automático se activará en la versión multiempresa final.</div>

      <section className="saas-section">
        <SectionHeading title="Proceso de activación" description="Seis pasos claros para incorporar un cliente sin mezclar sus datos con otras empresas." />
        <div className="saas-grid">
          {[
            ["01", "Información comercial", "Nombre, razón social, país, zona horaria y datos del responsable."],
            ["02", "Identidad visual", "Logo, colores, mensajes del login y nombre del asistente comercial."],
            ["03", "Plan y límites", "Suscripción, precio mensual, usuarios, mensajes y módulos incluidos."],
            ["04", "Equipo inicial", "Owner, administradores, supervisores y vendedores de la empresa."],
            ["05", "WhatsApp y robot", "Número, Meta Cloud API, webhook, proveedor de IA y reglas operativas."],
            ["06", "Validación y lanzamiento", "Pruebas, revisión de seguridad y activación definitiva del entorno."],
          ].map(([step, title, description]) => (
            <article className="saas-card" key={step}>
              <div className="saas-card-top"><span className="saas-company-logo" style={{ width: 40, height: 40, borderRadius: 12, fontSize: ".75rem" }}>{step}</span><StatusBadge tone="pending">Preparado</StatusBadge></div>
              <h3 style={{ marginTop: 18 }}>{title}</h3><p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="saas-section">
        <SectionHeading title="Vista previa del alta" description="Formulario visual preparado para conectar al backend de aprovisionamiento." />
        <div className="saas-grid two">
          <article className="saas-card">
            <form className="saas-form">
              <div className="saas-form-grid">
                <div className="saas-field"><label>Nombre comercial</label><input placeholder="Nueva empresa" disabled /></div>
                <div className="saas-field"><label>Identificador</label><input placeholder="nueva-empresa" disabled /></div>
                <div className="saas-field"><label>Correo del propietario</label><input placeholder="owner@empresa.com" disabled /></div>
                <div className="saas-field"><label>Plan inicial</label><select disabled><option>Professional</option></select></div>
                <div className="saas-field full"><label>Descripción de la operación</label><textarea placeholder="Actividad, mercado y objetivos..." disabled /></div>
              </div>
              <button className="saas-button primary" type="button" disabled>Crear empresa y continuar</button>
            </form>
          </article>
          <article className="saas-card">
            <h3>Se creará automáticamente</h3>
            <div className="saas-list">
              <div className="saas-list-row"><span>Espacio independiente</span><strong>Tenant aislado</strong></div>
              <div className="saas-list-row"><span>Acceso principal</span><strong>Owner de empresa</strong></div>
              <div className="saas-list-row"><span>CRM</span><strong>Sin datos iniciales</strong></div>
              <div className="saas-list-row"><span>Robot</span><strong>Pendiente de conexión</strong></div>
              <div className="saas-list-row"><span>Suscripción</span><strong>Según plan elegido</strong></div>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
