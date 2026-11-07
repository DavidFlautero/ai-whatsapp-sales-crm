import RestaurantAgentSettingsClient from "../../../components/restaurant-os/RestaurantAgentSettingsClient";
import { requireModule } from "../../../components/restaurant-os/restaurant-server";

export default async function Page(){
  await requireModule("ai");
  return <RestaurantAgentSettingsClient/>;
}
