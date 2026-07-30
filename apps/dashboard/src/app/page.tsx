import Link from "next/link";
import { getAdminOverview } from "../lib/api";
import { AppShell } from "../components/app-shell/AppShell";

const catalogHighlights = [
  {
    name: "Pantalón ecocuero wide leg",
    image: "https://fulanitasmayorista.com/wp-content/uploads/2025/06/camel-300x400.png",
  },
  {
    name: "Buzo frisa metalizado",
    image: "https://fulanitasmayorista.com/wp-content/uploads/2025/06/metalizado-plateado-300x400.png",
  },
  {
    name: "Campera gamulán Alaska",
    image: "https://fulanitasmayorista.com/wp-content/uploads/2025/05/GAMULAN-CON-CINTO-MARRON--300x400.jpg",
  },
];

export default async function Page() {
  const data = await getAdminOverview();
  const analytics = data.analytics ?? {};
  const leadScores = data.leadScores ?? [];
  const recoveryCandidates = data.recoveryCandidates ?? [];
  const conversations = data.conversations ?? [];

  const contacts = Number(analytics.contacts ?? 0);
  const conversationCount = Number(analytics.conversations ?? conversations.length ?? 0);
  const messages = Number(analytics.messages ?? 0);
  const pipeline = Number(analytics.estimatedPipelineUsd ?? 0);

  return (
    <AppShell>
      <section className="company-hero">
        <div className="company-hero-copy">
          <span className="company-eyebrow">CENTRO COMERCIAL INTELIGENTE</span>
          <h1>La operación real de Fulanitas, en un solo lugar.</h1>
          <p>
            Clientes, conversaciones, oportunidades, catálogo y recuperación conectados
            al robot comercial de WhatsApp.
          </p>
          <div className="company-hero-actions">
            <Link className="company-primary-action" href="/conversations">Ver conversaciones</Link>
            <Link className="company-secondary-action" href="/crm">Abrir CRM</Link>
          </div>
        </div>

        <div className="company-hero-visual" aria-label="Catálogo Fulanitas">
          {catalogHighlights.map((product, index) => (
            <article className={`company-product-shot shot-${index + 1}`} key={product.name}>
              <img src={product.image} alt={product.name} />
              <span>{product.name}</span>
            </article>
          ))}
          <div className="company-live-badge">
            <span className="status-dot" />
            Datos operativos en vivo
          </div>
        </div>
      </section>

      <section className="company-live-metrics">
        <article>
          <span>Clientes en CRM</span>
          <strong>{contacts.toLocaleString("es-AR")}</strong>
          <small>Dato leído desde la operación conectada</small>
        </article>
        <article>
          <span>Conversaciones</span>
          <strong>{conversationCount.toLocaleString("es-AR")}</strong>
          <small>Registros disponibles en WhatsApp</small>
        </article>
        <article>
          <span>Mensajes procesados</span>
          <strong>{messages.toLocaleString("es-AR")}</strong>
          <small>Entrantes y salientes registrados</small>
        </article>
        <article>
          <span>Pipeline estimado</span>
          <strong>USD {pipeline.toLocaleString("es-AR")}</strong>
          <small>Estimación calculada por la inteligencia comercial</small>
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
                <strong>Sin leads puntuados todavía</strong>
                <span>Cuando el motor de scoring detecte intención, aparecerán acá.</span>
              </div>
            ) : (
              leadScores.slice(0, 6).map((lead: any) => (
                <div className="company-lead-row" key={lead.contact_phone}>
                  <span className="company-score">{lead.score}</span>
                  <div>
                    <strong>{lead.contact_phone}</strong>
                    <small>{lead.buying_intent || "Intención sin clasificar"} · {lead.urgency || "sin urgencia"}</small>
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
              <span className="company-eyebrow">OPERACIÓN HOY</span>
              <h2>Estado del embudo</h2>
            </div>
          </header>

          <div className="company-operation-list">
            <div>
              <span>Conversaciones disponibles</span>
              <strong>{conversations.length}</strong>
            </div>
            <div>
              <span>Clientes para recontactar</span>
              <strong>{recoveryCandidates.length}</strong>
            </div>
            <div>
              <span>Robot de WhatsApp</span>
              <strong className="company-positive">Operativo</strong>
            </div>
            <div>
              <span>Acción recomendada</span>
              <strong>Responder intención alta y activar recovery</strong>
            </div>
          </div>

          <div className="company-operation-actions">
            <Link href="/recovery">Abrir recuperación</Link>
            <Link href="/ai-core">Ver decisiones de IA</Link>
          </div>
        </article>
      </section>

      <section className="company-quick-section">
        <header>
          <div>
            <span className="company-eyebrow">ACCESOS RÁPIDOS</span>
            <h2>Herramientas de Fulanitas</h2>
          </div>
        </header>

        <div className="company-quick-grid">
          {[
            ["Conversaciones", "Atendé chats y revisá el contexto guardado por el robot.", "/conversations"],
            ["CRM y clientes", "Consultá clientes reales, memoria comercial y oportunidades.", "/crm"],
            ["Clientes perdidos", "Reactivá conversaciones que quedaron sin cierre.", "/recovery"],
            ["Catálogo", "Revisá productos, stock y contenido comercial.", "/catalog"],
            ["Analytics", "Medí actividad, intención y rendimiento comercial.", "/analytics"],
            ["Robot e integraciones", "Comprobá WhatsApp, IA, CRM y servicios conectados.", "/integrations"],
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
