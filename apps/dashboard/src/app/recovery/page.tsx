import { getAdminOverview } from "../../lib/api";
import { AppShell } from "../../components/app-shell/AppShell";
import { Header } from "../../components/ui/Header";

export default async function RecoveryPage() {
  const data = await getAdminOverview();
  const recoveryCandidates = data.recoveryCandidates ?? [];
  const recoveryEvents = data.recoveryEvents ?? [];

  return (
    <AppShell>
      <Header kicker="RECOVERY ENGINE" title="Recontactación" description="Clientes antiguos, leads fríos y mensajes IA para recuperar ventas." action={<button className="btn">Generar recontactación</button>} />

      <section className="section card panel">
        <table className="table">
          <thead>
            <tr><th>Cliente</th><th>Días inactivo</th><th>Motivo</th><th>Último mensaje</th><th>Acción</th></tr>
          </thead>
          <tbody>
            {recoveryCandidates.length === 0 ? <tr><td colSpan={5}>Sin candidatos.</td></tr> :
              recoveryCandidates.map((c: any) => (
                <tr key={c.phone}>
                  <td><strong>{c.name ?? "Cliente WhatsApp"}</strong><br /><span className="muted small">{c.phone}</span></td>
                  <td>{c.daysInactive}</td>
                  <td>{c.recoveryReason}</td>
                  <td>{c.last_message ?? "-"}</td>
                  <td><button className="btn secondary">Recontactar</button></td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </section>

      <section className="section card panel">
        <div className="panel-title">Historial recovery</div>
        <div className="chat-list" style={{ marginTop: 18 }}>
          {recoveryEvents.length === 0 ? <div className="muted">Sin eventos.</div> :
            recoveryEvents.map((e: any, i: number) => (
              <div className="chat-item" key={i}>
                <div className="avatar">R</div>
                <div>
                  <strong>{e.contact_phone}</strong>
                  <div className="muted small">{e.status} · {e.result}</div>
                  <div style={{ marginTop: 6 }}>{e.message}</div>
                </div>
                <span className="temperature warm">recovery</span>
              </div>
            ))
          }
        </div>
      </section>
    </AppShell>
  );
}
