import {
  AppShell,
} from "../components/app-shell/AppShell";

import {
  EventDashboardClient,
} from "./EventDashboardClient";


export default function Page() {
  return (
    <AppShell>
      <EventDashboardClient />
    </AppShell>
  );
}
