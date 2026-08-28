"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL ||
  "https://panel.fulanitasfabrica.site/api"
).replace(/\/+$/, "");

type UserRole =
  | "superadmin"
  | "owner"
  | "admin"
  | "supervisor"
  | "vendedor";

type NavItem = {
  label: string;
  href: string;
  roles?: readonly UserRole[];
};

type NavSection = {
  label: string;
  items: readonly NavItem[];
};

const administrativeRoles =
  ["superadmin", "owner", "admin"] as const;

const navSections: readonly NavSection[] = [
  {
    label: "Principal",
    items: [
      { label: "Dashboard", href: "/" },
    ],
  },
  {
    label: "Atención y clientes",
    items: [
      { label: "Conversaciones", href: "/conversations" },
      { label: "CRM y clientes", href: "/crm" },
      { label: "Clientes perdidos", href: "/recovery" },
    ],
  },
  {
    label: "Ventas",
    items: [
      { label: "Pedidos", href: "/orders" },
      { label: "Nueva venta", href: "/orders/new" },
      { label: "Comprobantes", href: "/comprobantes" },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { label: "Productos", href: "/catalog" },
      { label: "Stock", href: "/catalog/stock" },
      { label: "Precios", href: "/catalog/pricing" },
      { label: "Curvas", href: "/catalog/curves" },
      { label: "Ingreso de mercadería", href: "/catalog/intake" },
      { label: "Nuevo producto", href: "/catalog/new" },
      {
        label: "Fotos pendientes",
        href: "/catalog/media-missing",
        roles: administrativeRoles,
      },
    ],
  },
  {
    label: "Crecimiento",
    items: [
      { label: "Campañas", href: "/campaigns" },
      { label: "Analytics", href: "/analytics" },
    ],
  },
  {
    label: "Automatización",
    items: [
      { label: "Prompts", href: "/prompts" },
      { label: "Robot e integraciones", href: "/integrations" },
      { label: "WhatsApp Business", href: "/whatsapp-business" },
      { label: "AI Core", href: "/ai-core" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { label: "Configuración", href: "/settings" },
    ],
  },
];

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

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          !item.roles
          || (
            Boolean(user)
            && item.roles.includes(
              user?.role as UserRole,
            )
          ),
      ),
    }))
    .filter((section) => section.items.length > 0);

  const visibleItems =
    visibleSections.flatMap(
      (section) => section.items,
    );

  const activeItem =
    visibleItems
      .filter((item) =>
        item.href === "/"
          ? pathname === "/"
          : (
              pathname === item.href
              || pathname.startsWith(
                `${item.href}/`,
              )
            ),
      )
      .sort(
        (left, right) =>
          right.href.length - left.href.length,
      )[0];

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

        <nav
          className="nav company-nav"
          aria-label="Navegación principal"
        >
          {visibleSections.map((section) => {
            const sectionActive =
              section.items.some(
                (item) =>
                  activeItem?.href === item.href,
              );

            return (
              <details
                className="company-nav-section"
                key={section.label}
                open={
                  section.label === "Principal"
                  || sectionActive
                }
              >
                <summary>
                  <span className="company-nav-section-title">
                    {section.label}
                  </span>
                  <span
                    className="company-nav-section-arrow"
                    aria-hidden="true"
                  />
                </summary>

                <div className="company-nav-items">
                  {section.items.map((item) => {
                    const active =
                      activeItem?.href === item.href;

                    return (
                      <Link
                        href={item.href}
                        key={item.href}
                        className={
                          active
                            ? "is-active"
                            : ""
                        }
                      >
                        <span className="nav-icon" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </details>
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
