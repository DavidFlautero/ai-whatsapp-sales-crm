"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type CSSProperties,
  useEffect,
  useState,
} from "react";

type LoginUser = {
  role:
    | "superadmin"
    | "owner"
    | "admin"
    | "supervisor"
    | "vendedor";
};

type PublicBranding = {
  platform: {
    name: string;
    shortName: string;
    loginEyebrow: string;
    loginTitle: string;
    loginMessage: string;
    loginButtonLabel: string;
    supportEmail: string;
    primaryColor: string;
    logoUrl: string | null;
  };

  defaultCompany: {
    id: string;
    name: string;

    branding: {
      shortName: string;
      loginEyebrow: string;
      loginTitle: string;
      loginMessage: string;
      loginButtonLabel: string;
      primaryColor: string;
      logoUrl: string | null;
      heroImageUrl?: string | null;
    };
  } | null;
};

const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL ||
  "https://control.xn--eventosmediterrneo-dsb.es/api"
).replace(/\/+$/, "");

const fallbackBranding: PublicBranding = {
  platform: {
    name: "Neuromind Business OS",
    shortName: "NEUROMIND",
    loginEyebrow: "GESTIÓN EMPRESARIAL",
    loginTitle: "Centro de Control",
    loginMessage:
      "Gestión empresarial inteligente.",
    loginButtonLabel: "Acceder al panel",
    supportEmail: "",
    primaryColor: "#d6a348",
    logoUrl: null,
  },

  defaultCompany: {
    id: "eventos-mediterraneo",
    name: "Eventos Mediterráneo",

    branding: {
      shortName: "EVENTOS MEDITERRÁNEO",
      loginEyebrow:
        "GESTIÓN INTEGRAL DE EVENTOS",
      loginTitle:
        "Hacemos que cada evento sea inolvidable.",
      loginMessage:
        "Clientes, eventos, presupuestos, agenda, equipo, documentación y automatización desde un único centro operativo.",
      loginButtonLabel:
        "Acceder al panel",
      primaryColor: "#d6a348",
      logoUrl:
        "/eventos/login-hero.jpeg",
      heroImageUrl: null,
    },
  },
};

function routeForRole(
  role: LoginUser["role"],
) {
  if (role === "superadmin") {
    return "/platform";
  }

  if (role === "vendedor") {
    return "/conversations";
  }

  return "/";
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M6 2v4M18 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M4 20V10M10 20V4M16 20v-7M22 20V7" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <rect
        x="4"
        y="10"
        width="16"
        height="11"
        rx="2"
      />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [branding, setBranding] =
    useState<PublicBranding>(
      fallbackBranding,
    );

  const [brandingReady, setBrandingReady] =
    useState(false);

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    async function loadBranding() {
      try {
        const response =
          await fetch(
            `${apiUrl}/platform/public-branding`,
            {
              credentials: "include",
              cache: "no-store",
            },
          );

        if (!response.ok) {
          return;
        }

        const body =
          await response.json();

        if (
          active &&
          body?.ok &&
          body?.data?.platform
        ) {
          setBranding(body.data);
        }
      } catch {
        // fallback local
      } finally {
        if (active) {
          setBrandingReady(true);
        }
      }
    }

    void loadBranding();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response =
        await fetch(
          `${apiUrl}/auth/login`,
          {
            method: "POST",
            credentials: "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              email,
              password,
            }),
          },
        );

      const body =
        await response.json();

      if (!response.ok) {
        setError(
          body.message ||
            "Correo o contraseña incorrectos.",
        );

        return;
      }

      const user =
        body.user as
          | LoginUser
          | undefined;

      if (!user?.role) {
        setError(
          "La sesión fue creada, pero no se pudo determinar el acceso.",
        );

        return;
      }

      router.replace(
        routeForRole(user.role),
      );

      router.refresh();
    } catch {
      setError(
        "No fue posible conectar con el servidor.",
      );
    } finally {
      setLoading(false);
    }
  }

  const company =
    branding.defaultCompany;

  const visualBranding =
    company?.branding ||
    branding.platform;

  const brandName =
    company?.branding.shortName ||
    branding.platform.shortName;

  const heroImage =
    company?.branding
      .heroImageUrl || null;

  const presentationStyle = {
    "--login-accent":
      visualBranding.primaryColor,

    ...(heroImage
      ? {
          "--login-hero-image":
            `url("${heroImage}")`,
        }
      : {}),
  } as CSSProperties;

  return (
    <main
      className="login-v3"
      style={presentationStyle}
      data-branding-ready={
        brandingReady
      }
    >
      <section className="login-v3-hero">
        <div className="login-v3-overlay" />

        <div className="login-v3-main-copy">
          <span className="login-v3-kicker">
            Gestión integral de eventos
          </span>

          <h1>
            Hacemos que cada evento sea{" "}
            <em>inolvidable.</em>
          </h1>

          <p>
            {
              visualBranding.loginMessage
            }
          </p>

          <div className="login-v3-features">
            <div>
              <CalendarIcon />
              <span>
                Planificación
                <br />
                inteligente
              </span>
            </div>

            <div>
              <UsersIcon />
              <span>
                Equipo
                <br />
                conectado
              </span>
            </div>

            <div>
              <ChartIcon />
              <span>
                Control
                <br />
                en tiempo real
              </span>
            </div>

            <div>
              <StarIcon />
              <span>
                Experiencias
                <br />
                inolvidables
              </span>
            </div>
          </div>
        </div>

        <div className="login-v3-tagline">
          <span />
          Más que eventos, grandes historias
        </div>
      </section>

      <section className="login-v3-access">
        <div className="login-v3-access-inner">
          <form
            className="login-v3-card"
            onSubmit={
              handleSubmit
            }
          >
            <div className="login-v3-card-brand">
              {visualBranding.logoUrl ? (
                <img
                  src={visualBranding.logoUrl}
                  alt={brandName}
                />
              ) : null}

              <strong>
                {brandName}
              </strong>

              <span>
                Centro de Control
              </span>
            </div>

            <header>
              <span className="login-v3-access-kicker">
                Acceso seguro
              </span>

              <h2>Bienvenido</h2>

              <p>
                Ingresá con tu cuenta
                asignada de{" "}
                {company?.name ||
                  "Eventos Mediterráneo"}
                .
              </p>
            </header>

            <label className="login-v3-field">
              <span>
                Correo electrónico
              </span>

              <div className="login-v3-input">
                <MailIcon />

                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value,
                    )
                  }
                  placeholder="nombre@empresa.com"
                  required
                  disabled={loading}
                />
              </div>
            </label>

            <label className="login-v3-field">
              <span>
                Contraseña
              </span>

              <div className="login-v3-input">
                <LockIcon />

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value,
                    )
                  }
                  placeholder="Tu contraseña"
                  minLength={8}
                  required
                  disabled={loading}
                />

                <button
                  className="login-v3-eye"
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (current) =>
                        !current,
                    )
                  }
                  disabled={loading}
                >
                  {showPassword
                    ? "Ocultar"
                    : "Mostrar"}
                </button>
              </div>
            </label>

            <div className="login-v3-options">
              <span />

              <a href="/forgot-password">
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            {error ? (
              <div
                className="login-error"
                role="alert"
              >
                {error}
              </div>
            ) : null}

            <button
              className="login-v3-submit"
              type="submit"
              disabled={loading}
            >
              <span>
                {loading
                  ? "Verificando acceso…"
                  : visualBranding
                      .loginButtonLabel}
              </span>

              {!loading ? (
                <strong>
                  →
                </strong>
              ) : null}
            </button>

            <footer className="login-v3-security">
              <ShieldIcon />

              <div>
                <strong>
                  Acceso protegido
                  mediante sesión segura.
                </strong>

                <span>
                  Tus datos están
                  siempre protegidos.
                </span>
              </div>
            </footer>
          </form>

          <div className="login-v3-powered">
            <span>
              Tecnología de
            </span>

            <strong>
              {
                branding.platform
                  .name
              }
            </strong>
          </div>
        </div>
      </section>
    </main>
  );
}
