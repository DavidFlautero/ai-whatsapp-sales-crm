import Link from "next/link";
import { getAdminOverview } from "../lib/api";
import { AppShell } from "../components/app-shell/AppShell";

const catalogImageBySku: Record<string, string> = {
  "PANT-BAGGY-NEGRO":
    "https://fulanitasmayorista.com/wp-content/uploads/2025/06/camel-300x400.png",
  "JEAN-OVERSIZE-AZUL":
    "https://fulanitasmayorista.com/wp-content/uploads/2025/05/GAMULAN-CON-CINTO-MARRON--300x400.jpg",
};

function serviceLabel(status?: string) {
  switch (status) {
    case "online":
      return "Conectado";
    case "invalid_credentials":
      return "Requiere reconexión";
    case "missing_config":
      return "Pendiente de configuración";
    case "degraded":
      return "Servicio degradado";
    case "unreachable":
      return "Sin respuesta";
    default:
      return "Estado pendiente";
  }
}

function serviceClass(status?: string) {
  return status === "online" ? "company-positive" : "company-warning";
}

export default async function Page() {
  const data = await getAdminOverview();
  const analytics = data.analytics ?? {};
  const leadScores = data.leadScores ?? [];
  const recoveryCandidates = data.recoveryCandidates ?? [];
  const conversations = data.conversations ?? [];
  const catalogProducts = data.catalogProducts ?? [];
  const prompts = data.prompts ?? [];
  const services = data.status?.services ?? {};

  const contacts = Number(analytics.contacts ?? 0);
  const conversationCount = Number(
    analytics.conversations ?? conversations.length ?? 0,
  );
  const messages = Number(analytics.messages ?? 0);
  const pipeline = Number(analytics.estimatedPipelineUsd ?? 0);
  const whatsappStatus = services.whatsapp?.status;
  const claudeStatus = services.claude?.status;
  const connected = whatsappStatus === "online";
  const catalogHighlights = catalogProducts.slice(0, 3);

  return (
    <AppShell>
      <section className="company-hero">
        <div className="company-hero-copy">
          <span className="company-eyebrow">FULANITAS · COMANDO COMERCIAL</span>
          <h1>Todo el negocio mayorista, ordenado para vender mejor.</h1>
          <p>
            Panel operativo de Fulanitas con clientes, conversaciones, catálogo,
            oportunidades, recuperación e inteligencia comercial en un único lugar.
          </p>
          <div className="company-hero-actions">
            <Link className="company-primary-action" href="/conversations">
              Abrir conversaciones
            </Link>
            <Link className="company-secondary-action" href="/catalog">
              Ver catálogo
            </Link>
          </div>
        </div>

        <div className="company-hero-visual" aria-label="Catálogo Fulanitas">
          {catalogHighlights.length > 0 ? (
            catalogHighlights.map((product: any, index: number) => (
              <article
                className={`company-product-shot shot-${index + 1}`}
                key={product.sku}
              >
                <img
                  src={
                    catalogImageBySku[product.sku] ||
                    "https://fulanitasmayorista.com/wp-content/uploads/2025/06/metalizado-plateado-300x400.png"
                  }
                  alt={product.name}
                />
                <span>
                  {product.name} · stock {product.stock ?? 0}
                </span>
              </article>
            ))
          ) : (
            <article className="company-product-shot shot-2">
              <img
                src="https://fulanitasmayorista.com/wp-content/uploads/2025/06/metalizado-plateado-300x400.png"
                alt="Colección Fulanitas"
              />
              <span>Catálogo mayorista Fulanitas</span>
            </article>
          )}

          <div className="company-live-badge">
            <span className={connected ? "status-dot" : "status-dot is-warning"} />
            {connected ? "WhatsApp conectado" : "WhatsApp pendiente de reconexión"}
          </div>
        </div>
      </section>

      <section className="company-live-metrics">
        <article>
          <span>Clientes sincronizados</span>
          <strong>{contacts.toLocaleString("es-AR")}</strong>
          <small>
            {contacts > 0
              ? "Contactos disponibles en el CRM"
              : "Todavía no hay contactos sincronizados"}
          </small>
        </article>
        <article>
          <span>Conversaciones registradas</span>
          <strong>{conversationCount.toLocaleString("es-AR")}</strong>
          <small>
            {conversationCount > 0
              ? "Historial comercial disponible"
              : "Se completará cuando WhatsApp vuelva a conectarse"}
          </small>
        </article>
        <article>
          <span>Mensajes procesados</span>
          <strong>{messages.toLocaleString("es-AR")}</strong>
          <small>
            {messages > 0
              ? "Mensajes entrantes y salientes"
              : "Sin actividad registrada por ahora"}
          </small>
        </article>
        <article>
          <span>Pipeline estimado</span>
          <strong>USD {pipeline.toLocaleString("es-AR")}</strong>
          <small>
            {pipeline > 0
              ? "Estimación basada en oportunidades reales"
              : "Se calculará cuando existan oportunidades"}
          </small>
        </article>
      </section>

      <section className="company-dashboard-grid">
        <article className="company-dashboard-card company-leads-card">
          <header>
            <div>
              <span className="company-eyebrow">PRIORIDAD COMERCIAL</span>
              <h2>Leads que necesitan atención</h2>
            </div>
            <Link href="/crm">Ver CRM completo</Link>
          </header>

          <div className="company-lead-list">
            {leadScores.length === 0 ? (
              <div className="company-empty-state">
                <strong>No hay leads puntuados todavía</strong>
                <span>
                  Esta sección se completará automáticamente cuando entren
                  conversaciones reales y la IA detecte intención de compra.
                </span>
                <Link className="company-primary-action" href="/integrations">
                  Revisar conexiones
                </Link>
              </div>
            ) : (
              leadScores.slice(0, 6).map((lead: any) => (
                <div className="company-lead-row" key={lead.contact_phone}>
                  <span className="company-score">{lead.score}</span>
                  <div>
                    <strong>{lead.contact_phone}</strong>
                    <small>
                      {lead.buying_intent || "Intención sin clasificar"} ·{" "}
                      {lead.urgency || "sin urgencia"}
                    </small>
                    <p>{lead.reason || "Sin observación adicional"}</p>
                  </div>
                  <span className={`temperature ${lead.temperature || "cold"}`}>
                    {lead.temperature || "sin clasificar"}
                  </span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="company-dashboard-card company-operation-card">
          <header>
            <div>
              <span className="company-eyebrow">ESTADO OPERATIVO</span>
              <h2>Servicios y embudo</h2>
            </div>
          </header>

          <div className="company-operation-list">
            <div>
              <span>WhatsApp Business</span>
              <strong className={serviceClass(whatsappStatus)}>
                {serviceLabel(whatsappStatus)}
              </strong>
            </div>
            <div>
              <span>Inteligencia comercial</span>
              <strong className={serviceClass(claudeStatus)}>
                {serviceLabel(claudeStatus)}
              </strong>
            </div>
            <div>
              <span>Productos disponibles</span>
              <strong>{catalogProducts.length}</strong>
            </div>
            <div>
              <span>Prompts activos</span>
              <strong>{prompts.filter((prompt: any) => prompt.active).length}</strong>
            </div>
            <div>
              <span>Clientes para recontactar</span>
              <strong>{recoveryCandidates.length}</strong>
            </div>
          </div>

          <div className="company-operation-actions">
            <Link href="/integrations">Ver integraciones</Link>
            <Link href="/ai-core">Ver AI Core</Link>
          </div>
        </article>
      </section>

      <section className="company-quick-section">
        <header>
          <div>
            <span className="company-eyebrow">ACCESOS RÁPIDOS</span>
            <h2>Operación completa de Fulanitas</h2>
          </div>
        </header>

        <div className="company-quick-grid">
          {[
            [
              "Conversaciones",
              "Atendé chats y revisá el contexto comercial guardado por el robot.",
              "/conversations",
            ],
            [
              "CRM y clientes",
              "Consultá clientes sincronizados, memoria y oportunidades reales.",
              "/crm",
            ],
            [
              "Recovery",
              "Prepará recontactos con las plantillas comerciales ya configuradas.",
              "/recovery",
            ],
            [
              "Catálogo",
              `${catalogProducts.length} productos configurados con stock disponible.`,
              "/catalog",
            ],
            [
              "Analytics",
              "Medí actividad, intención y rendimiento cuando exista tráfico real.",
              "/analytics",
            ],
            [
              "Robot e integraciones",
              "Revisá WhatsApp, IA, CRM externo, audio y servicios conectados.",
              "/integrations",
            ],
          ].map(([title, description, href]) => (
            <Link className="company-quick-card" href={href} key={title}>
              <span className="company-quick-icon" />
              <strong>{title}</strong>
              <p>{description}</p>
              <span className="company-quick-open">Abrir módulo →</span>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
