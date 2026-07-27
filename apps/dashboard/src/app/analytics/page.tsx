import { getAdminOverview } from "../../lib/api";
import { AppShell } from "../../components/app-shell/AppShell";
import { Header } from "../../components/ui/Header";
import { MetricGrid } from "../../components/ui/MetricGrid";

export default async function AnalyticsPage() {
  const data = await getAdminOverview();
  const analytics = data.analytics ?? {};
  const qualityScores = data.qualityScores ?? [];
  const predictiveProfiles = data.predictiveProfiles ?? [];

  return (
    <AppShell>
      <Header kicker="COMMERCIAL INTELLIGENCE" title="Analytics" description="Calidad conversacional, predicción comercial, pipeline y rendimiento IA." />
      <MetricGrid items={[
        ["Conversión", `${analytics.conversion ?? 0}%`, "estimado IA"],
        ["Inbound", analytics.inbound ?? 0, "mensajes cliente"],
        ["Outbound", analytics.outbound ?? 0, "respuestas IA"],
        ["Pipeline", `USD ${analytics.estimatedPipelineUsd ?? 0}`, "estimado"]
      ]} />

      <section className="grid-main section">
        <div className="card panel">
          <div className="panel-title">Conversation QA</div>
          <div className="chat-list" style={{ marginTop: 18 }}>
            {qualityScores.length === 0 ? <div className="muted">Sin QA.</div> :
              qualityScores.slice(0, 10).map((q: any, i: number) => (
                <div className="chat-item" key={q.id ?? i}>
                  <div className="avatar">{q.score}</div>
                  <div>
                    <strong>{q.contact_phone}</strong>
                    <div className="muted small">claridad {q.clarity} · persuasión {q.persuasion} · empatía {q.empathy}</div>
                    <div style={{ marginTop: 6 }}>{q.recommendation}</div>
                  </div>
                  <span className="temperature warm">QA</span>
                </div>
              ))
            }
          </div>
        </div>

        <div className="card panel">
          <div className="panel-title">Predicción comercial</div>
          <div className="chat-list" style={{ marginTop: 18 }}>
            {predictiveProfiles.length === 0 ? <div className="muted">Sin predicción.</div> :
              predictiveProfiles.slice(0, 10).map((p: any) => (
                <div className="chat-item" key={p.contact_phone}>
                  <div className="avatar">{p.purchase_probability}</div>
                  <div>
                    <strong>{p.contact_phone}</strong>
                    <div className="muted small">{p.semantic_intent}</div>
                    <div style={{ marginTop: 6 }}>{p.semantic_summary}</div>
                  </div>
                  <span className="temperature hot">USD {p.estimated_value}</span>
                </div>
              ))
            }
          </div>
        </div>
      </section>
    </AppShell>
  );
}
