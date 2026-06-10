import { getAdminOverview } from "../../lib/api";
import { AppShell } from "../../components/app-shell/AppShell";
import { Header } from "../../components/ui/Header";

export default async function CampaignsPage() {
  const data = await getAdminOverview();
  const campaigns = data.campaigns ?? [];

  return (
    <AppShell>
      <Header kicker="CAMPAIGN ENGINE" title="Campañas IA" description="Campañas por segmento: VIP, mayoristas, clientes fríos, recovery y novedades." action={<button className="btn">Nueva campaña</button>} />
      <section className="grid-main section">
        <div className="card panel">
          <div className="panel-title">Campañas activas</div>
          <div className="chat-list" style={{ marginTop: 18 }}>
            {campaigns.length === 0 ? <div className="muted">Sin campañas.</div> :
              campaigns.map((c: any, i: number) => (
                <div className="chat-item" key={i}>
                  <div className="avatar">C</div>
                  <div>
                    <strong>{c.name}</strong>
                    <div className="muted small">{c.audience}</div>
                    <div style={{ marginTop: 6 }}>Enviados {c.total_sent} · respuestas {c.total_replied}</div>
                  </div>
                  <span className="temperature warm">{c.status}</span>
                </div>
              ))
            }
          </div>
        </div>

        <div className="card panel">
          <div className="panel-title">Plantillas recomendadas</div>
          <div className="thought-grid" style={{ marginTop: 18 }}>
            <div className="thought-card"><div className="thought-label">VIP</div><div className="thought-value">Novedades anticipadas</div></div>
            <div className="thought-card"><div className="thought-label">Fríos</div><div className="thought-value">Reactivación suave</div></div>
            <div className="thought-card"><div className="thought-label">Mayoristas</div><div className="thought-value">Catálogo actualizado + stock</div></div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
