import { getAdminOverview } from "../../lib/api";
import { AppShell } from "../../components/app-shell/AppShell";
import { Header } from "../../components/ui/Header";

function timeLabel(value?: string) {
  if (!value) return "--:--:--";
  try {
    return new Date(value).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "--:--:--";
  }
}

export default async function AICorePage() {
  const data = await getAdminOverview();

  const events = data.events ?? [];
  const memories = data.memories ?? [];
  const leadScores = data.leadScores ?? [];
  const recoveryCandidates = data.recoveryCandidates ?? [];
  const predictiveProfiles = data.predictiveProfiles ?? [];
  const governanceEvents = data.governanceEvents ?? [];
  const qualityScores = data.qualityScores ?? [];
  const catalogProducts = data.catalogProducts ?? [];

  const latestLead = leadScores[0];
  const latestPredictive = predictiveProfiles[0];
  const latestMemory = memories[0];
  const latestQuality = qualityScores[0];

  return (
    <AppShell>
      <Header
        kicker="INTERNAL AI OBSERVABILITY"
        title="AI Core Observatory"
        description="Vista interna del motor IA: memoria, señales, predicción, governance, QA, catálogo y eventos vivos."
      />

      <section className="ops-grid section">
        <div className="card panel brain-stage">
          <div className="panel-head">
            <div>
              <div className="panel-title">AI Swarm Visualization</div>
              <div className="muted small" style={{ marginTop: 6 }}>
                Flujo interno: mensaje → análisis → memoria → predicción → governance → respuesta.
              </div>
            </div>
            <span className="pill"><span className="status-dot" /> live</span>
          </div>

          <span className="signal-line line-1" />
          <span className="signal-line line-2" />
          <span className="signal-line line-3" />
          <span className="signal-line line-4" />
          <span className="signal-line line-5" />
          <span className="signal-line line-6" />

          <div className="brain-core">
            <div>
              <strong>NEUROMIND CORE</strong>
              <span>internal brain</span>
            </div>
          </div>

          <div className="agent-node node-semantic">
            <div className="agent-title">Semantic Agent</div>
            <div className="agent-meta">intent: {latestPredictive?.semantic_intent ?? "listening"}<br />confidence: {latestLead?.score ?? 72}%</div>
          </div>

          <div className="agent-node node-memory">
            <div className="agent-title">Memory Agent</div>
            <div className="agent-meta">memories: {memories.length}<br />latest: {latestMemory?.key ?? "none"}</div>
          </div>

          <div className="agent-node node-predictive">
            <div className="agent-title">Predictive Agent</div>
            <div className="agent-meta">purchase: {latestPredictive?.purchase_probability ?? 0}%<br />value: USD {latestPredictive?.estimated_value ?? 0}</div>
          </div>

          <div className="agent-node node-governance">
            <div className="agent-title">Governance Agent</div>
            <div className="agent-meta">checks: {governanceEvents.length}<br />status: approved</div>
          </div>

          <div className="agent-node node-catalog">
            <div className="agent-title">Catalog Agent</div>
            <div className="agent-meta">products: {catalogProducts.length}<br />mode: retrieval</div>
          </div>

          <div className="agent-node node-recovery">
            <div className="agent-title">Recovery Agent</div>
            <div className="agent-meta">candidates: {recoveryCandidates.length}<br />followup: smart</div>
          </div>
        </div>

        <div className="card panel">
          <div className="panel-title">AI Thought Pipeline</div>
          <div className="thought-grid" style={{ marginTop: 18 }}>
            <div className="thought-card"><div className="thought-label">Intent</div><div className="thought-value">{latestPredictive?.semantic_intent ?? "Exploring / Listening"}</div></div>
            <div className="thought-card"><div className="thought-label">Lead Temperature</div><div className="thought-value">{latestLead?.temperature ?? "warm"} · {latestLead?.score ?? 50}%</div></div>
            <div className="thought-card"><div className="thought-label">Memory Used</div><div className="thought-value">{latestMemory ? `${latestMemory.key}: ${latestMemory.value}` : "Sin memoria previa"}</div></div>
            <div className="thought-card"><div className="thought-label">Quality Score</div><div className="thought-value">{latestQuality?.score ?? "--"}/100</div></div>
          </div>
        </div>
      </section>

      <section className="grid-main section">
        <div className="card panel">
          <div className="panel-title">Live Event Stream</div>
          <div className="event-terminal" style={{ marginTop: 18 }}>
            {events.length === 0 ? <div className="muted">Sin eventos.</div> :
              events.slice(0, 20).map((event: any) => (
                <div className="event-line" key={event.id}>
                  <div className="event-time">{timeLabel(event.createdAt)}</div>
                  <div className="event-text"><strong>{event.type}</strong><br />{event.message}</div>
                </div>
              ))
            }
          </div>
        </div>

        <div className="card panel">
          <div className="panel-title">Governance</div>
          <div className="chat-list" style={{ marginTop: 18 }}>
            {governanceEvents.length === 0 ? <div className="muted">Sin governance.</div> :
              governanceEvents.slice(0, 10).map((g: any, i: number) => (
                <div className="chat-item" key={g.id ?? i}>
                  <div className="avatar">G</div>
                  <div>
                    <strong>{g.agent_name}</strong>
                    <div className="muted small">{g.action} · {g.risk_level}</div>
                    <div style={{ marginTop: 6 }}>{g.reason}</div>
                  </div>
                  <span className="temperature warm">{g.decision}</span>
                </div>
              ))
            }
          </div>
        </div>
      </section>
    </AppShell>
  );
}
