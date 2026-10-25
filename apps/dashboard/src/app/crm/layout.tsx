import {
  AppShell,
} from "../../components/app-shell/AppShell";

export default function CRMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      {children}
    </AppShell>
  );
}
