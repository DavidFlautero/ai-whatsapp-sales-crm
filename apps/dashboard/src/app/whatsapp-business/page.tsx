import {
  AppShell,
} from "../../components/app-shell/AppShell";

import {
  Header,
} from "../../components/ui/Header";

import WhatsappBusinessClient
  from "./WhatsappBusinessClient";

export default function WhatsappBusinessPage() {
  return (
    <AppShell>
      <Header
        kicker="CANAL COMERCIAL"
        title="WhatsApp Business"
        description="Administrá el perfil comercial y la sincronización del canal."
      />

      <WhatsappBusinessClient />
    </AppShell>
  );
}
