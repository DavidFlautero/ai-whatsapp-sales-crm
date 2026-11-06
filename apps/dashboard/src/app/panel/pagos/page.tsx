import RestaurantPaymentsClient from "../../../components/restaurant-os/RestaurantPaymentsClient";
import { requireModule } from "../../../components/restaurant-os/restaurant-server";

export default async function Page() {
  await requireModule("orders");
  return <RestaurantPaymentsClient/>;
}
