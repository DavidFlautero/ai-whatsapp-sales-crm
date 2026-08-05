import {
  getAdminOverview,
} from "../../lib/api";

import {
  AppShell,
} from "../../components/app-shell/AppShell";

import {
  Header,
} from "../../components/ui/Header";

import {
  ConversationsCenter,
} from "../../components/conversations/conversations-center";

export default async function ConversationsPage() {
  const data =
    await getAdminOverview();

  return (
    <AppShell>
      <Header
        kicker="WHATSAPP LIVE CENTER"
        title="Conversaciones"
        description="Tomá conversaciones, pausá la IA y respondé directamente por WhatsApp."
      />

      <ConversationsCenter
        conversations={
          data.conversations
          ?? []
        }
        messages={
          data.messages
          ?? []
        }
        assignments={
          data.operatorAssignments
          ?? data.operator_assignments
          ?? []
        }
        contacts={
          data.contacts
          ?? []
        }
      />
    </AppShell>
  );
}
