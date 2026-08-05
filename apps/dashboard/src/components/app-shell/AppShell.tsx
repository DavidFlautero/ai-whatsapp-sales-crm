"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL ||
  "https://panel.fulanitasfabrica.site/api"
).replace(/\/+$/, "");

const nav = [
  ["Dashboard", "/"],
  ["Conversaciones", "/conversations"],
  ["CRM y clientes", "/crm"],
  ["Clientes perdidos", "/recovery"],
  ["Pedidos y ventas", "/orders"],
  ["Nueva venta", "/orders/new"],
  ["Catálogo", "/catalog"],
  ["Prompts", "/prompts"],
  ["Robot e integraciones", "/integrations"],
  ["AI Core", "/ai-core"],
  ["Configuración", "/settings"],
] as const;

type SessionUser = {
  name: string;
  email: string;
  role: string;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let active = true;

    fetch(`${apiUrl}/auth/session`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((response) => response.ok ? response.json() : null)
      .then((body) => {
        if (active && body?.user) setUser(body.user);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const isSuperadmin = user?.role === "superadmin";

  return (
    <main className="shell company-shell">
      <aside className="sidebar company-sidebar">
        <div className="company-brand-lockup">
          <div className="company-brand-mark">F</div>
          <div>
            <div className="brand-kicker">FULANITAS</div>
            <div className="brand-title">Commerce Intelligence</div>
          </div>
        </div>

        <div className="company-context-card">
          <span className="status-dot" />
          <div>
            <strong>Fulanitas Fábrica</strong>
            <small>Operación comercial conectada</small>
          </div>
        </div>

        <nav className="nav company-nav">
          {nav.map(([label, href]) => {
            const active = href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link href={href} key={href} className={active ? "is-active" : ""}>
                <span className="nav-icon" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-card company-service-card">
          <div className="muted small">Robot comercial</div>
          <div className="company-service-row">
            <span className="status-dot" />
            <strong>WhatsApp conectado</strong>
          </div>
          <div className="muted small company-service-copy">
            Número operativo, memoria comercial, scoring, catálogo y recuperación.
          </div>
        </div>
      </aside>

      <section className="content company-content">
        {isSuperadmin ? (
          <div className="company-admin-mode">
            <div>
              <span className="company-admin-label">MODO SUPERADMIN</span>
              <strong>Estás inspeccionando el panel real de Fulanitas Fábrica</strong>
            </div>
            <div className="company-admin-actions">
              <Link href="/platform/companies/fulanitas/subscription">Suscripción y bloqueo</Link>
              <Link href="/platform/companies/fulanitas">Volver a la empresa</Link>
              <Link href="/platform">Volver a plataforma</Link>
            </div>
          </div>
        ) : null}

        <div className="company-workspace-topbar">
          <div>
            <span>EMPRESA ACTUAL</span>
            <strong>Fulanitas Fábrica</strong>
          </div>
          <div className="company-workspace-status">
            <span className="status-dot" />
            Robot operativo
          </div>
          <div className="company-user-chip">
            <span>{user?.name?.slice(0, 1).toUpperCase() || "U"}</span>
            <div>
              <strong>{user?.name || "Usuario"}</strong>
              <small>{user?.role || "sesión activa"}</small>
            </div>
          </div>
        </div>

        {children}
      </section>
    </main>
  );
}
