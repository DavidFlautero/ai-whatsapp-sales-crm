import { requireModule } from "../../../components/restaurant-os/restaurant-server";
import WhapiChannelSetup from "../../../components/restaurant-os/whapi-channel-setup";

export default async function Page() {
  await requireModule("integrations");
  return <WhapiChannelSetup />;
}
