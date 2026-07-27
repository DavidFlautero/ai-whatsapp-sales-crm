import { AppShell } from "../../components/app-shell/AppShell";
import { Header } from "../../components/ui/Header";
import { getSystemStatus } from "../../lib/api";
import { ConnectionsPanel } from "./ConnectionsPanel";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  let initialStatus: Awaited<ReturnType<typeof getSystemStatus>> | null = null;

  try {
    initialStatus = await getSystemStatus();
  } catch {
    initialStatus = null;
  }

  return (
    <AppShell>
      <Header
        kicker="SYSTEM INTEGRATIONS"
        title="Integraciones"
        description="Estado real de WhatsApp, Claude, Supabase, Ninox y transcripción de audio."
      />

      <section className="grid-main section">
        <ConnectionsPanel initialStatus={initialStatus} />

        <div className="card panel">
          <div className="panel-title">Seguridad</div>
          <div className="muted" style={{ marginTop: 18, lineHeight: 1.7 }}>
            Las credenciales completas permanecen en el backend. El panel solo recibe estados,
            latencias y datos no sensibles de diagnóstico.
          </div>
        </div>
      </section>
    </AppShell>
  );
}
