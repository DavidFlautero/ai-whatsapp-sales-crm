import RestaurantCustomersClient from "../../../components/restaurant-os/RestaurantCustomersClient";
import { requireModule } from "../../../components/restaurant-os/restaurant-server";

export default async function Page() {
  await requireModule("customers");
  return <RestaurantCustomersClient/>;
}
