import Link from "next/link";

const nav = [
  ["Dashboard", "/"],
  ["Conversaciones", "/conversations"],
  ["CRM", "/crm"],
  ["Recovery", "/recovery"],
  ["Campañas", "/campaigns"],
  ["Analytics", "/analytics"],
  ["Catálogo", "/catalog"],
  ["Prompts", "/prompts"],
  ["Integraciones", "/integrations"],
  ["AI Core", "/ai-core"],
  ["Settings", "/settings"]
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand-kicker">NEUROMIND</div>
        <div className="brand-title">Commerce OS</div>

        <nav className="nav">
          {nav.map(([label, href]) => (
            <Link href={href} key={href}>
              <span className="nav-icon" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-card">
          <div className="muted small">Sistema comercial IA</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
            <span className="status-dot" />
            <strong>operational</strong>
          </div>
          <div className="muted small" style={{ marginTop: 14, lineHeight: 1.5 }}>
            CRM, WhatsApp, Claude, memoria, scoring, catálogo y recuperación.
          </div>
        </div>
      </aside>

      <section className="content">{children}</section>
    </main>
  );
}
