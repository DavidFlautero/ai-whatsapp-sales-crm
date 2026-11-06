import type { ReactNode } from "react";

import { AppShell } from "../../components/app-shell/AppShell";
import { requireRestaurant } from "../../components/restaurant-os/restaurant-server";

/**
 * Delibocados uses the same white dashboard shell as the operator inbox.
 * Keep authentication at the server boundary; individual routes still
 * enforce their module permissions via requireModule().
 */
export default async function Layout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRestaurant();

  return <AppShell>{children}</AppShell>;
}
