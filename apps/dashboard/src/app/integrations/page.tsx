import { AppShell } from "../../components/app-shell/AppShell";
import { Header } from "../../components/ui/Header";

export default function IntegrationsPage() {
  return (
    <AppShell>
      <Header kicker="SYSTEM INTEGRATIONS" title="Integraciones" description="Estado y configuración de WhatsApp, Claude, Supabase y transcripción de audio." />
      <section className="grid-main section">
        <div className="card panel">
          <div className="panel-title">Conexiones</div>
          <div className="form-grid" style={{ marginTop: 18 }}>
            <input className="input" defaultValue="WhatsApp Cloud API: conectado" />
            <input className="input" defaultValue="Claude: configurado" />
            <input className="input" defaultValue="Supabase: pendiente de credenciales" />
            <input className="input" defaultValue="Audio transcription: configurado" />
            <button className="btn">Probar conexiones</button>
          </div>
        </div>

        <div className="card panel">
          <div className="panel-title">Seguridad</div>
          <div className="muted" style={{ marginTop: 18, lineHeight: 1.7 }}>
            Las keys completas no se exponen en frontend. El backend usa variables seguras y service role solo del lado servidor.
          </div>
        </div>
      </section>
    </AppShell>
  );
}
