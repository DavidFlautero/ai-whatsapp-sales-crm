import { ButtonLink, CompanyTabs, Metric, PageHeader, SectionHeading, StatusBadge } from "../../../_components/PagePrimitives";

export default function RobotPage() {
  return (
    <>
      <PageHeader kicker="FULANITAS / ROBOT" title="Robot de WhatsApp" description="Estado técnico y comercial del asistente conectado a Fulanitas Fábrica." actions={<><ButtonLink href="/platform/robots">Ver todos los robots</ButtonLink><button type="button" className="saas-button primary">Probar conexión</button></>} />
      <CompanyTabs active="Robot" />
      <section className="saas-metrics">
        <Metric label="Estado" value="Conectado" detail="Servicio disponible" tone="success" />
        <Metric label="Webhook" value="Operativo" detail="Eventos recibidos" tone="success" />
        <Metric label="IA comercial" value="Activa" detail="Procesamiento habilitado" tone="success" />
        <Metric label="Proveedor" value="Meta" detail="Cloud API" />
        <Metric label="Incidencias" value="0" detail="Sin alertas activas" tone="success" />
      </section>
      <section className="saas-section">
        <SectionHeading title="Configuración de conexión" description="Datos principales del canal y del agente comercial." aside={<StatusBadge>Conectado</StatusBadge>} />
        <div className="saas-grid two">
          <article className="saas-card"><h3>Canal WhatsApp</h3><div className="saas-list"><div className="saas-list-row"><span>Número</span><strong>+54 9 11 6266-7360</strong></div><div className="saas-list-row"><span>Proveedor</span><strong>Meta Cloud API</strong></div><div className="saas-list-row"><span>Webhook</span><strong className="saas-success">Operativo</strong></div><div className="saas-list-row"><span>Recepción multimedia</span><strong>Habilitada</strong></div><div className="saas-list-row"><span>Última verificación</span><strong>Conexión estable</strong></div></div></article>
          <article className="saas-card"><h3>Agente inteligente</h3><div className="saas-list"><div className="saas-list-row"><span>Nombre</span><strong>Asistente Comercial Fulanitas</strong></div><div className="saas-list-row"><span>Motor</span><strong>Claude</strong></div><div className="saas-list-row"><span>Transcripción</span><strong>Groq</strong></div><div className="saas-list-row"><span>Memoria de cliente</span><strong>Activa</strong></div><div className="saas-list-row"><span>Recuperación comercial</span><strong>Disponible</strong></div></div></article>
        </div>
      </section>
      <section className="saas-section"><SectionHeading title="Controles operativos" description="Acciones previstas para mantenimiento, soporte y diagnóstico." /><div className="saas-grid"><article className="saas-card"><h3>Prueba de conexión</h3><p>Valida credenciales, API, número y disponibilidad del webhook.</p><div className="saas-card-actions"><button type="button" className="saas-button">Ejecutar prueba</button></div></article><article className="saas-card"><h3>Actividad del robot</h3><p>Consulta eventos recientes, mensajes procesados y respuestas de la IA.</p><div className="saas-card-actions"><ButtonLink href="/platform/companies/fulanitas/activity">Ver actividad</ButtonLink></div></article><article className="saas-card"><h3>Configuración avanzada</h3><p>Proveedor, prompts, memoria, reglas, horarios y comportamiento comercial.</p><div className="saas-card-actions"><button type="button" className="saas-button">Abrir configuración</button></div></article></div></section>
    </>
  );
}
