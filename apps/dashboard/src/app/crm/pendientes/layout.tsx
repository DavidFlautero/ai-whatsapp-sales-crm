import Link from "next/link";
import "./commercial-ui.css";

export default function CommercialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="cm-root">
      <div className="cm-topbar">
        <div className="cm-topbar-brand">
          <span className="cm-topbar-kicker">
            EVENTOS MEDITERRÁNEO
          </span>

          <strong>
            Centro de gestión comercial
          </strong>
        </div>

        <nav
          className="cm-topbar-links"
          aria-label="Navegación comercial"
        >
          <Link href="/crm/pendientes">
            Pendientes de espacios
          </Link>

          <Link href="/crm/pendientes/inteligencia">
            Inteligencia comercial
          </Link>

          <Link href="/crm/espacios">
            Administrar espacios
          </Link>
        </nav>
      </div>

      <div className="cm-content">
        {children}
      </div>
    </div>
  );
}
