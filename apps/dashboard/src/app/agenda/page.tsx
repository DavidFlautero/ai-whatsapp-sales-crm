import {
  AppShell,
} from "../../components/app-shell/AppShell";

import AgendaClient
  from "./AgendaClient";


export default function AgendaPage() {
  return (
    <AppShell>
      <AgendaClient />
    </AppShell>
  );
}
