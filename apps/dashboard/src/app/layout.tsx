import "./globals.css";

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
