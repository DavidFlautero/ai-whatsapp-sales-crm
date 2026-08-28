import {
  AppShell,
} from "../../components/app-shell/AppShell";

import {
  Header,
} from "../../components/ui/Header";

import {
  LiveRefresh,
} from "../../components/live-refresh/LiveRefresh";

import {
  getOrders,
} from "../../lib/api";

import {
  OrdersClient,
} from "./OrdersClient";

export default async function OrdersPage() {
  const orders =
    await getOrders();

  return (
    <AppShell>
      <Header
        kicker="OPERACIÓN COMERCIAL"
        title="Pedidos y ventas"
        description="Gestioná ventas, pagos, clientes, preparación y reservas de stock desde un solo lugar."
        action={
          <a
            className="btn"
            href="/orders/new"
          >
            + Nueva venta
          </a>
        }
      />

      <div
        style={{
          display:
            "flex",

          justifyContent:
            "flex-end",

          marginBottom:
            14,
        }}
      >
        <LiveRefresh
          intervalMs={2000}
          label="Pedidos en vivo"
        />
      </div>

      <OrdersClient
        orders={orders}
      />
    </AppShell>
  );
}
