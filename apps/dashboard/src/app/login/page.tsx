"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useState,
} from "react";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://panel.fulanitasfabrica.site/api";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        setError(
          body.message ||
          "Correo o contraseña incorrectos.",
        );

        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError(
        "No fue posible conectar con el servidor.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-presentation">
        <div className="login-logo">
          <span>F</span>

          <div>
            <strong>FULANITAS</strong>
            <small>Commerce Intelligence</small>
          </div>
        </div>

        <div className="login-copy">
          <span className="login-eyebrow">
            OPERACIÓN COMERCIAL
          </span>

          <h1>
            Ventas inteligentes.
            <br />
            Control humano.
          </h1>

          <p>
            Clientes, conversaciones, pedidos,
            automatización e inteligencia comercial
            desde un único centro operativo.
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
              Ingresá con tu cuenta asignada de
              Fulanitas.
            </p>
          </header>

          <label className="login-field">
            <span>Correo electrónico</span>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              placeholder="nombre@fulanitasfabrica.site"
              required
            />
          </label>

          <label className="login-field">
            <span>Contraseña</span>

            <div className="login-password">
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                autoComplete="current-password"
                placeholder="Ingresá tu contraseña"
                minLength={8}
                required
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword((value) => !value)
                }
              >
                {showPassword
                  ? "Ocultar"
                  : "Mostrar"}
              </button>
            </div>
          </label>

          {error ? (
            <div className="login-error">
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
              : "Ingresar al panel"}
          </button>

          <footer>
            Sesión cifrada · HTTPS · Acceso por roles
          </footer>
        </form>
      </section>
    </main>
  );
}
