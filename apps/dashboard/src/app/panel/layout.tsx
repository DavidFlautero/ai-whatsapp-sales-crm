import type { ReactNode } from "react";
import RestaurantShell from "../../components/restaurant-os/restaurant-shell";
import { requireRestaurant } from "../../components/restaurant-os/restaurant-server";
export default async function Layout({children}:{children:ReactNode}) {
  const ctx = await requireRestaurant();
  return <RestaurantShell modules={ctx.modules}>{children}</RestaurantShell>;
}
