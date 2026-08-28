import {
  AppShell,
} from "../../components/app-shell/AppShell";

import {
  Header,
} from "../../components/ui/Header";

import {
  getSystemStatus,
} from "../../lib/api";

import {
  ConnectionsPanel,
} from "./ConnectionsPanel";

export const dynamic =
  "force-dynamic";

export default async function IntegrationsPage() {
  let initialStatus:
    Awaited<
      ReturnType<
        typeof getSystemStatus
      >
    > | null = null;

  try {
    initialStatus =
      await getSystemStatus();
  } catch {
    initialStatus =
      null;
  }

  return (
    <AppShell>
      <Header
        kicker="ROBOT E INTEGRACIONES"
        title="Conexiones del negocio"
        description="Configurá, probá y administrá las credenciales de WhatsApp, inteligencia artificial, base de datos y sistemas externos."
      />

      <ConnectionsPanel
        initialStatus={
          initialStatus
        }
      />
    </AppShell>
  );
}
