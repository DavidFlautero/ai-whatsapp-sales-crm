import { requireModule } from "../../../components/restaurant-os/restaurant-server";
import MesasPedidosClient from "../../../components/restaurant-os/MesasPedidosClient";

export default async function Page() {
 await requireModule("orders");
 return <MesasPedidosClient />;
}
