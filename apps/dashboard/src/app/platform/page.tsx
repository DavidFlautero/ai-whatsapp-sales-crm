"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

type SessionUser = {
  name: string;
  email: string;
  role: string;
  companyId: string | null;
};

const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL ||
  "https://panel.fulanitasfabrica.site/api"
).replace(/\/+$/, "");

const modules = [
  {
    title: "Empresas asociadas",
    description:
      "Espacios comerciales independientes con CRM, usuarios y robot propio.",
    status: "Operativo",
  },
  {
    title: "Robots conectados",
    description:
      "Control global de números, webhooks, estado e inteligencia comercial.",
    status: "1 conectado",
  },
  {
    title: "Planes y suscripciones",
    description:
      "Planes, límites, renovaciones y control por estado de pago.",
    status: "Disponible para desarrollo",
  },
  {
    title: "Facturación",
    description:
      "Ingresos mensuales, vencimientos, comprobantes y cobros.",
    status: "Disponible para desarrollo",
  },
  {
    title: "Usuarios globales",
    description:
      "Propietarios, administradores, supervisores y vendedores.",
    status: "4 usuarios",
  },
  {
    title: "Auditoría y seguridad",
    description:
      "Historial de accesos, eventos y cambios críticos.",
    status: "Pendiente de activación",
  },
];

export default function PlatformPage() {
  const router = useRouter();

  const [user, setUser] =
    useState<SessionUser | null>(
      null,
    );

  const [
    showPending,
    setShowPending,
  ] = useState(false);

  const [
    loggingOut,
    setLoggingOut,
  ] = useState(false);

  useEffect(() => {
    async function loadSession() {
      const response =
        await fetch(
          `${apiUrl}/auth/session`,
          {
            credentials:
              "include",
            cache: "no-store",
          },
        );

      if (!response.ok) {
        router.replace("/login");
        return;
      }

      const body =
        await response.json();

      if (
        body.user?.role !==
        "superadmin"
      ) {
        router.replace("/");
        return;
      }

      setUser(body.user);
    }

    void loadSession();
  }, [router]);

  async function logout() {
    setLoggingOut(true);

    try {
      await fetch(
        `${apiUrl}/auth/logout`,
        {
          method: "POST",
          credentials:
            "include",
        },
      );
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <main className="platform-page">
      <aside className="platform-sidebar">
        <div className="platform-brand">
          <div className="platform-brand-mark">
            N
          </div>

          <div>
            <strong>
              NEUROMIND
            </strong>

            <span>
              Commerce OS
            </span>
          </div>
        </div>

        <nav className="platform-nav">
          <a className="platform-nav-active">
            Resumen global
          </a>

          <a>Empresas</a>
          <a>Robots</a>
          <a>Suscripciones</a>
          <a>Planes</a>
          <a>Usuarios</a>
          <a>Facturación</a>
          <a>Actividad</a>
          <a>
            Estado del sistema
          </a>
          <a>Configuración</a>
        </nav>

        <div className="platform-user">
          <div className="platform-avatar">
            SA
          </div>

          <div>
            <strong>
              {user?.name ||
                "Superadministrador"}
            </strong>

            <span>
              Control global
            </span>
          </div>

          <button
            onClick={logout}
            disabled={loggingOut}
          >
            {loggingOut
              ? "…"
              : "Salir"}
          </button>
        </div>
      </aside>

      <section className="platform-content">
        <header className="platform-header">
          <div>
            <span className="platform-kicker">
              CENTRO DE ADMINISTRACIÓN SAAS
            </span>

            <h1>
              Control global de la plataforma
            </h1>

            <p>
              Empresas, robots, usuarios,
              conexiones y crecimiento
              comercial desde una única
              operación.
            </p>
          </div>

          <button
            className="platform-primary-button"
            onClick={() =>
              setShowPending(true)
            }
          >
            + Agregar empresa
          </button>
        </header>

        <section className="platform-metrics">
          <article>
            <span>
              Empresas activas
            </span>
            <strong>1</strong>
            <small>
              Fulanitas Fábrica
            </small>
          </article>

          <article>
            <span>
              Robots conectados
            </span>
            <strong>1</strong>
            <small>
              WhatsApp operativo
            </small>
          </article>

          <article>
            <span>
              Usuarios registrados
            </span>
            <strong>4</strong>
            <small>
              Plataforma y empresa
            </small>
          </article>

          <article>
            <span>
              Ingreso mensual
            </span>
            <strong>
              USD 50
            </strong>
            <small>
              Cliente inicial
            </small>
          </article>

          <article>
            <span>
              Estado del sistema
            </span>
            <strong className="platform-success">
              Operativo
            </strong>
            <small>
              API y panel en línea
            </small>
          </article>
        </section>

        <section className="platform-section">
          <div className="platform-section-heading">
            <div>
              <span className="platform-kicker">
                EMPRESAS ASOCIADAS
              </span>

              <h2>
                Operaciones comerciales
              </h2>
            </div>

            <span className="platform-count">
              1 empresa
            </span>
          </div>

          <div className="company-grid">
            <article className="company-card company-card-active">
              <div className="company-card-top">
                <div className="company-logo">
                  F
                </div>

                <div>
                  <span className="company-state">
                    <i />
                    Activa
                  </span>

                  <h3>
                    Fulanitas Fábrica
                  </h3>

                  <p>
                    Cliente inicial · Comercio mayorista
                  </p>
                </div>
              </div>

              <div className="company-stats">
                <div>
                  <span>
                    Robot WhatsApp
                  </span>
                  <strong>
                    Conectado
                  </strong>
                </div>

                <div>
                  <span>Número</span>
                  <strong>
                    +54 9 11 6266-7360
                  </strong>
                </div>

                <div>
                  <span>
                    Usuarios
                  </span>
                  <strong>3</strong>
                </div>

                <div>
                  <span>Plan</span>
                  <strong>
                    Cliente inicial
                  </strong>
                </div>

                <div>
                  <span>
                    Pago mensual
                  </span>
                  <strong>
                    USD 50
                  </strong>
                </div>

                <div>
                  <span>
                    IA comercial
                  </span>
                  <strong>
                    Operativa
                  </strong>
                </div>
              </div>

              <div className="company-actions">
                <button
                  onClick={() =>
                    setShowPending(true)
                  }
                >
                  Entrar al panel
                </button>

                <button
                  className="company-secondary"
                  onClick={() =>
                    setShowPending(true)
                  }
                >
                  Ver robot
                </button>
              </div>
            </article>

            <article
              className="company-card company-card-new"
              onClick={() =>
                setShowPending(true)
              }
            >
              <div className="company-add-icon">
                +
              </div>

              <h3>
                Agregar nueva empresa
              </h3>

              <p>
                Creá un espacio independiente
                con WhatsApp, CRM, usuarios,
                robot y métricas propias.
              </p>

              <span>
                Disponible en versión multiempresa
              </span>
            </article>
          </div>
        </section>

        <section className="platform-section">
          <div className="platform-section-heading">
            <div>
              <span className="platform-kicker">
                CAPACIDADES DEL PRODUCTO
              </span>

              <h2>
                Infraestructura SaaS
              </h2>
            </div>
          </div>

          <div className="platform-modules">
            {modules.map(
              (module) => (
                <article
                  key={module.title}
                >
                  <div className="platform-module-icon" />

                  <h3>
                    {module.title}
                  </h3>

                  <p>
                    {module.description}
                  </p>

                  <span>
                    {module.status}
                  </span>
                </article>
              ),
            )}
          </div>
        </section>
      </section>

      {showPending ? (
        <div
          className="platform-modal-backdrop"
          onClick={() =>
            setShowPending(false)
          }
        >
          <section
            className="platform-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <span className="platform-kicker">
              VERSIÓN MULTIEMPRESA
            </span>

            <h2>
              Módulo listo para desarrollar
            </h2>

            <p>
              Permitirá crear nuevos clientes,
              conectar un WhatsApp independiente,
              separar CRM, usuarios,
              conversaciones, catálogos,
              métricas, planes y pagos.
            </p>

            <div className="platform-modal-list">
              <span>
                ✓ Empresa independiente
              </span>
              <span>
                ✓ Robot y número propios
              </span>
              <span>
                ✓ Usuarios y permisos
              </span>
              <span>
                ✓ Planes y suscripciones
              </span>
              <span>
                ✓ Facturación y pagos
              </span>
            </div>

            <button
              onClick={() =>
                setShowPending(false)
              }
            >
              Entendido
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
