"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
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
    };
  } | null;
};

const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL ||
  "https://panel.fulanitasfabrica.site/api"
).replace(/\/+$/, "");

const fallbackBranding: PublicBranding = {
  platform: {
    name: "Neuromind Commerce OS",
    shortName: "NEUROMIND",
    loginEyebrow: "OPERACIÓN COMERCIAL",
    loginTitle: "Ventas inteligentes. Control humano.",
    loginMessage:
      "Clientes, conversaciones, pedidos, automatización e inteligencia comercial desde un único centro operativo.",
    loginButtonLabel: "Ingresar al panel",
    supportEmail: "admin@neuromind33.online",
    primaryColor: "#d9a653",
    logoUrl: null,
  },
  defaultCompany: {
    id: "fulanitas",
    name: "Fulanitas Fábrica",
    branding: {
      shortName: "FULANITAS",
      loginEyebrow: "OPERACIÓN COMERCIAL",
      loginTitle: "Ventas inteligentes. Control humano.",
      loginMessage:
        "Clientes, conversaciones, pedidos, automatización e inteligencia comercial desde un único centro operativo.",
      loginButtonLabel: "Ingresar al panel",
      primaryColor: "#d9a653",
      logoUrl: null,
    },
  },
};

function routeForRole(role: LoginUser["role"]) {
  if (role === "superadmin") {
    return "/platform";
  }

  if (role === "vendedor") {
    return "/conversations";
  }

  return "/";
}

export default function LoginPage() {
  const router = useRouter();

  const [branding, setBranding] =
    useState<PublicBranding>(fallbackBranding);

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
        const response = await fetch(
          `${apiUrl}/platform/public-branding`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          return;
        }

        const body = await response.json();

        if (
          active &&
          body?.ok &&
          body?.data?.platform
        ) {
          setBranding(body.data);
        }
      } catch {
        // El fallback mantiene disponible el login.
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
      const response = await fetch(
        `${apiUrl}/auth/login`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        },
      );

      const body = await response.json();

      if (!response.ok) {
        setError(
          body.message ||
            "Correo o contraseña incorrectos.",
        );

        return;
      }

      const user =
        body.user as LoginUser | undefined;

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

  const logoLetter =
    brandName.trim().charAt(0).toUpperCase() ||
    "N";

  return (
    <main
      className="login-page"
      style={{
        "--login-accent":
          visualBranding.primaryColor,
      } as React.CSSProperties}
      data-branding-ready={brandingReady}
    >
      <section className="login-presentation">
        <div className="login-logo">
          {visualBranding.logoUrl ? (
            <img
              src={visualBranding.logoUrl}
              alt={brandName}
              className="login-logo-image"
            />
          ) : (
            <span>{logoLetter}</span>
          )}

          <div>
            <strong>{brandName}</strong>

            <small>
              {company
                ? branding.platform.name
                : "Commerce Intelligence"}
            </small>
          </div>
        </div>

        <div className="login-copy">
          <span className="login-eyebrow">
            {visualBranding.loginEyebrow}
          </span>

          <h1>
            {visualBranding.loginTitle}
          </h1>

          <p>
            {visualBranding.loginMessage}
          </p>
        </div>

        <div className="login-platform-status">
          <span />
          Plataforma operativa
        </div>
      </section>

      <section className="login-access">
        <form
          className="login-card"
          onSubmit={handleSubmit}
        >
          <header>
            <span className="login-eyebrow">
              ACCESO SEGURO
            </span>

            <h2>Bienvenido</h2>

            <p>
              Ingresá con tu cuenta asignada
              {company
                ? ` de ${company.name}.`
                : "."}
            </p>
          </header>

          <label className="login-field">
            <span>Correo electrónico</span>

            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="nombre@empresa.com"
              required
              disabled={loading}
            />
          </label>

          <label className="login-field">
            <span>Contraseña</span>

            <div className="login-password-control">
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
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) => !current,
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

          {error ? (
            <div
              className="login-error"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <button
            className="login-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Verificando acceso…"
              : visualBranding.loginButtonLabel}
          </button>

          <footer className="login-card-footer">
            <span>
              Acceso protegido mediante sesión segura.
            </span>

            <span>
              Soporte: {branding.platform.supportEmail}
            </span>
          </footer>
        </form>
      </section>
    </main>
  );
}
