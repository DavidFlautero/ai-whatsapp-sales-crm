import { requireModule } from "../../../components/restaurant-os/restaurant-server";
import NativeQrEditor from "../../../components/restaurant-os/native-qr";
export default async function Page() {
  await requireModule("qr");
  return <NativeQrEditor />;
}
