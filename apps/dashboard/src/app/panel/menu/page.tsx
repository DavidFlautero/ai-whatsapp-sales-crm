import { requireModule } from "../../../components/restaurant-os/restaurant-server";
import NativeMenuEditor from "../../../components/restaurant-os/native-menu";
export default async function Page() {
  await requireModule("catalog");
  return <NativeMenuEditor />;
}
