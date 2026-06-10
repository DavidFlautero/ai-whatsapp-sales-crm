import { getAdminOverview } from "../lib/api";
import { AppShell } from "../components/app-shell/AppShell";
import { Header } from "../components/ui/Header";
import { MetricGrid } from "../components/ui/MetricGrid";
import Link from "next/link";

export default async function Page() {
  const data = await getAdminOverview();
  const analytics = data.analytics ?? {};
  const leadScores = data.leadScores ?? [];
  const recoveryCandidates = data.recoveryCandidates ?? [];
  const conversations = data.conversations ?? [];

  return (
    <AppShell>
      <Header
        kicker="COMMERCIAL COMMAND CENTER"
        title="Neuromind Commerce OS"
        description="Panel principal de operación comercial: ventas, leads, conversaciones, recuperación y acciones recomendadas."
        action={<Link className="btn" href="/ai-core">Ver AI Core</Link>}
      />

      <MetricGrid
        items={[
          ["Contactos", analytics.contacts ?? 0, "CRM real"],
          ["Conversaciones", analytics.conversations ?? 0, "WhatsApp live"],
          ["Mensajes", analytics.messages ?? 0, "inbound/outbound"],
          ["Pipeline", `USD ${analytics.estimatedPipelineUsd ?? 0}`, "estimado IA"]
        ]}
      />

      <section className="grid-main section">
        <div className="card panel">
          <div className="panel-title">Leads prioritarios</div>
          <div className="chat-list" style={{ marginTop: 18 }}>
            {leadScores.length === 0 ? <div className="muted">Sin leads puntuados.</div> :
              leadScores.slice(0, 8).map((lead: any) => (
                <div className="chat-item" key={lead.contact_phone}>
                  <div className="avatar">{lead.score}</div>
                  <div>
                    <strong>{lead.contact_phone}</strong>
                    <div className="muted small">{lead.buying_intent} · {lead.urgency}</div>
                    <div style={{ marginTop: 6 }}>{lead.reason}</div>
                  </div>
                  <span className={`temperature ${lead.temperature}`}>{lead.temperature}</span>
                </div>
              ))
            }
          </div>
        </div>

        <div className="card panel">
          <div className="panel-title">Resumen operativo</div>
          <div className="thought-grid" style={{ marginTop: 18 }}>
            <div className="thought-card">
              <div className="thought-label">Conversaciones activas</div>
              <div className="thought-value">{conversations.length}</div>
            </div>
            <div className="thought-card">
              <div className="thought-label">Clientes para recontactar</div>
              <div className="thought-value">{recoveryCandidates.length}</div>
            </div>
            <div className="thought-card">
              <div className="thought-label">Acción sugerida</div>
              <div className="thought-value">Responder leads calientes y activar recovery</div>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
