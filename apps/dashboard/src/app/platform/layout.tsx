import "./platform.css";
import { PlatformShell } from "./_components/PlatformShell";

export default function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <PlatformShell>{children}</PlatformShell>;
}
