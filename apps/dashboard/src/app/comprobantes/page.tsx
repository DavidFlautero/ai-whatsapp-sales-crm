import {
  AppShell,
} from "../../components/app-shell/AppShell";

import {
  Header,
} from "../../components/ui/Header";

import PaymentSubmissionsClient
  from "./PaymentSubmissionsClient";


export default function PaymentSubmissionsPage() {
  return (
    <AppShell>
      <Header
        kicker="CONTROL DE COBROS"
        title="Comprobantes de pago"
        description="Revisá las transferencias recibidas por WhatsApp, aprobá pagos y consultá el historial de comprobantes confirmados o rechazados."
      />

      <PaymentSubmissionsClient />
    </AppShell>
  );
}
