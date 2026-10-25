"use client";

import { useEffect, useState, type FormEvent } from "react";
import styles from "./OwnerCredentials.module.css";

export default function PropietariosAccesoPage() {
  const [invite, setInvite] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.hash.slice(1)
    );
    const token = params.get("invite");

    if (token) {
      setInvite(token);
      setMode("register");
      window.history.replaceState(
        null, "", window.location.pathname
      );
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (password.length < 12) {
      setError("La contraseña debe tener al menos 12 caracteres.");
      return;
    }

    if (mode === "register" && password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        mode === "register"
          ? "/api/owner/auth/register"
          : "/api/owner/auth/login",
        {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            password,
            ...(mode === "register"
              ? { inviteToken: invite }
              : {}),
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        const messages: Record<string, string> = {
          INVALID_CREDENTIALS: "Usuario o contraseña incorrectos.",
          INVALID_INVITATION_OR_USERNAME:
            "La invitación no es válida, venció o el usuario ya está ocupado.",
          INVALID_ACTIVATION_DATA:
            "Revisá el usuario, la contraseña y la invitación.",
          TOO_MANY_ATTEMPTS:
            "Demasiados intentos. Probá nuevamente en 15 minutos.",
          REGISTRATION_UNAVAILABLE:
            "La activación no está disponible temporalmente.",
          LOGIN_UNAVAILABLE:
            "No se pudo iniciar sesión. Intentá nuevamente.",
        };

        throw new Error(
          messages[data.error] || "No se pudo completar el acceso."
        );
      }

      window.location.replace("/propietarios");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error de conexión."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.mark}>EM</span>
          <div>
            <strong>Eventos Mediterráneo</strong>
            <small>Portal privado de propietarios</small>
          </div>
        </div>

        <span className={styles.eyebrow}>
          GESTIÓN DE PROPIEDADES
        </span>

        <h1>
          {mode === "register"
            ? "Activá tu cuenta"
            : "Bienvenido de nuevo"}
        </h1>

        <p className={styles.subtitle}>
          {mode === "register"
            ? "Elegí tus credenciales personales para gestionar tus chalets y consultar su disponibilidad."
            : "Accedé a tus propiedades, calendario y gestión de reservas."}
        </p>

        <form onSubmit={submit} className={styles.form}>
          <label htmlFor="username">Usuario</label>
          <input
            id="username"
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase())}
            autoComplete="username"
            minLength={3}
            maxLength={32}
            pattern="[a-z0-9][a-z0-9._-]{2,31}"
            placeholder="nombre.propietario"
            required
          />

          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={
              mode === "register"
                ? "new-password"
                : "current-password"
            }
            minLength={12}
            maxLength={128}
            placeholder="Mínimo 12 caracteres"
            required
          />

          {mode === "register" && (
            <>
              <label htmlFor="confirm">Confirmar contraseña</label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="Repetí tu contraseña"
                required
              />
            </>
          )}

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading
              ? "Verificando..."
              : mode === "register"
                ? "Crear cuenta y acceder"
                : "Iniciar sesión"}
          </button>
        </form>

        {mode === "register" ? (
          <p className={styles.footer}>
            ¿Ya tenés una cuenta?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Iniciar sesión
            </button>
          </p>
        ) : (
          <p className={styles.footer}>
            ¿No tenés acceso? Solicitá una invitación a
            Eventos Mediterráneo.
          </p>
        )}

        <p className={styles.security}>
          Acceso privado · Sesión protegida
        </p>
      </div>
    </main>
  );
}
