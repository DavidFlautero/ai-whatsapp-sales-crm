import {
  AppShell,
} from "../../components/app-shell/AppShell";

import {
  Header,
} from "../../components/ui/Header";

import {
  getAdminOverview,
  getOrders,
} from "../../lib/api";

import {
  CRMClient,
  type CRMContact,
} from "./CRMClient";

export default async function CRMPage() {
  const [
    data,
    orders,
  ] =
    await Promise.all([
      getAdminOverview(),
      getOrders(),
    ]);

  const contacts =
    Array.isArray(
      data.contacts,
    )
      ? data.contacts as CRMContact[]
      : [];

  return (
    <AppShell>
      <Header
        kicker="CUSTOMER RELATIONSHIP MANAGEMENT"
        title="CRM Comercial"
        description="Contactos, clasificación, ubicación, notas, actividad y pedidos vinculados en una sola vista."
      />

      <CRMClient
        initialContacts={
          contacts
        }
        orders={
          orders
        }
      />
    </AppShell>
  );
}
