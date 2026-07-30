"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL ||
  "https://panel.fulanitasfabrica.site/api"
).replace(/\/+$/, "");

type SessionUser = {
  name: string;
  email: string;
  role: string;
};

const navigation = [
  ["Resumen global", "/platform"],
  ["Empresas", "/platform/companies"],
  ["Robots", "/platform/robots"],
  ["Suscripciones", "/platform/subscriptions"],
  ["Planes", "/platform/plans"],
  ["Usuarios", "/platform/users"],
  ["Facturación", "/platform/billing"],
  ["Actividad", "/platform/activity"],
  ["Estado del sistema", "/platform/system"],
  ["Configuración", "/platform/settings"],
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/platform") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const response = await fetch(`${apiUrl}/auth/session`, {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        router.replace("/login");
        return;
      }

      const body = await response.json();

      if (body.user?.role !== "superadmin") {
        router.replace("/");
        return;
      }

      if (active) setUser(body.user);
    }

    void loadSession();
    return () => {
      active = false;
    };
  }, [router]);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch(`${apiUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <main className="saas-shell">
      <aside className="saas-sidebar">
        <Link href="/platform" className="saas-brand">
          <span className="saas-brand-mark">N</span>
          <span>
            <strong>NEUROMIND</strong>
            <small>Commerce OS</small>
          </span>
        </Link>

        <nav className="saas-navigation" aria-label="Administración SaaS">
          {navigation.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className={isActive(pathname, href) ? "is-active" : ""}
            >
              <span className="saas-nav-dot" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="saas-sidebar-health">
          <span className="saas-live-dot" />
          <div>
            <strong>Plataforma operativa</strong>
            <small>API, dashboard y robot en línea</small>
          </div>
        </div>

        <div className="saas-profile">
          <span className="saas-avatar">SA</span>
          <span className="saas-profile-copy">
            <strong>{user?.name || "Superadministrador"}</strong>
            <small>{user?.email || "Control global"}</small>
          </span>
          <button type="button" onClick={logout} disabled={loggingOut}>
            {loggingOut ? "…" : "Salir"}
          </button>
        </div>
      </aside>

      <section className="saas-main">{children}</section>
    </main>
  );
}
