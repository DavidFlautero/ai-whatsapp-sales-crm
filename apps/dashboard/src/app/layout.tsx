import "./globals.css";
import "./business.css";

export const metadata = {
  title: "Fulanitas AI Sales CRM",
  description: "AI Sales Operating System"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
