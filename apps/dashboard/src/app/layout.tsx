import { Suspense } from "react";

import "./globals.css";
import "./business.css";

export const metadata = {
  title: "Eventos Mediterráneo | Control de Eventos",
  description:
    "Gestión comercial, proveedores y operación de eventos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <Suspense fallback={null}>
          {children}
        </Suspense>
      </body>
    </html>
  );
}
