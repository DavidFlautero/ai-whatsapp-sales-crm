import { requireModule } from "../../../components/restaurant-os/restaurant-server";
import NativeMenuEditor from "../../../components/restaurant-os/native-menu";
import MenuBannersEditor from "./MenuBannersEditor";
export default async function Page() {
  await requireModule("catalog");
  return <><MenuBannersEditor/><NativeMenuEditor/></>;
}
