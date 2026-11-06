import RestaurantOpsClient from "../../../components/restaurant-os/RestaurantOpsClient";
import { requireModule } from "../../../components/restaurant-os/restaurant-server";

export default async function Page() {
  await requireModule("orders");
  return <RestaurantOpsClient initialTab="reports"/>;
}
