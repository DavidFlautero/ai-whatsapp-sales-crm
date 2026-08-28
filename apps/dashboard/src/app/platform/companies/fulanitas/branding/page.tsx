import { ButtonLink, CompanyTabs, PageHeader, SectionHeading, StatusBadge } from "../../../_components/PagePrimitives";

export default function BrandingPage() {
  return (
    <>
      <PageHeader
        kicker="FULANITAS / BRANDING"
        title="Identidad visual y login"
        description="Vista completa del editor que permitirá cambiar el nombre, los mensajes, el color, el logo y la presentación del panel."
        actions={<><ButtonLink href="/platform/companies/fulanitas">Cancelar</ButtonLink><button type="button" className="saas-button primary">Guardar cambios</button></>}
      />
      <CompanyTabs active="Branding" />
      <div className="saas-callout">La configuración actual ya se lee desde el servidor. Esta pantalla presenta el editor final; el siguiente paso conecta el botón Guardar con la API persistente.</div>

      <section className="saas-section">
        <div className="saas-grid two">
          <article className="saas-card">
            <SectionHeading title="Configuración de marca" description="Textos y elementos que verá el equipo de Fulanitas." aside={<StatusBadge>Configuración actual</StatusBadge>} />
            <form className="saas-form">
              <div className="saas-form-grid">
                <div className="saas-field"><label>Nombre comercial</label><input defaultValue="Fulanitas Fábrica" /></div>
                <div className="saas-field"><label>Nombre corto</label><input defaultValue="FULANITAS" /></div>
                <div className="saas-field"><label>Título del panel</label><input defaultValue="Fulanitas Fábrica" /></div>
                <div className="saas-field"><label>Subtítulo del panel</label><input defaultValue="Centro comercial inteligente" /></div>
                <div className="saas-field full"><label>Título principal del login</label><input defaultValue="Ventas inteligentes. Control humano." /></div>
                <div className="saas-field full"><label>Mensaje del login</label><textarea defaultValue="Clientes, conversaciones, pedidos, automatización e inteligencia comercial desde un único centro operativo." /></div>
                <div className="saas-field"><label>Texto del botón</label><input defaultValue="Ingresar al panel" /></div>
                <div className="saas-field"><label>Nombre del robot</label><input defaultValue="Asistente Comercial Fulanitas" /></div>
                <div className="saas-field"><label>Color principal</label><input defaultValue="#d9a653" /></div>
                <div className="saas-field"><label>URL del logo</label><input placeholder="https://..." /></div>
              </div>
            </form>
          </article>

          <article className="saas-preview">
            <div className="saas-preview-hero">
              <div className="saas-preview-brand">FULANITAS · NEUROMIND COMMERCE OS</div>
              <div><span className="saas-kicker">OPERACIÓN COMERCIAL</span><h3>Ventas inteligentes. Control humano.</h3><p>Clientes, conversaciones, pedidos, automatización e inteligencia comercial desde un único centro operativo.</p><button type="button" className="saas-button primary">Ingresar al panel</button></div>
              <div className="saas-note">Vista previa del login empresarial</div>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
