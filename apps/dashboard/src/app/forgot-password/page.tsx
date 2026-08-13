"use client";

import {
  FormEvent,
  useState,
} from "react";

import Link from "next/link";


const ADMIN_EMAIL =
  "admin@fulanitasfabrica.site";


export default function ForgotPasswordPage() {
  const [
    step,
    setStep,
  ] =
    useState<
      "request"
      | "confirm"
      | "done"
    >(
      "request",
    );

  const [
    otp,
    setOtp,
  ] =
    useState(
      "",
    );

  const [
    password,
    setPassword,
  ] =
    useState(
      "",
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      false,
    );

  const [
    message,
    setMessage,
  ] =
    useState<
      string | null
    >(
      null,
    );


  async function requestCode(
    event:
      FormEvent,
  ) {
    event.preventDefault();

    setLoading(
      true,
    );

    setMessage(
      null,
    );

    try {
      const response =
        await fetch(
          "/api/auth/password-reset/request",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                email:
                  ADMIN_EMAIL,
              }),
          },
        );

      const body =
        await response.json();


      if (
        !response.ok
      ) {
        throw new Error(
          body?.message
          || "No se pudo solicitar el código.",
        );
      }


      setStep(
        "confirm",
      );

      setMessage(
        "Revisá el WhatsApp del administrador. El código vence en 10 minutos.",
      );

    } catch (
      error
    ) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Error inesperado.",
      );

    } finally {
      setLoading(
        false,
      );
    }
  }


  async function confirmReset(
    event:
      FormEvent,
  ) {
    event.preventDefault();

    setLoading(
      true,
    );

    setMessage(
      null,
    );

    try {
      const response =
        await fetch(
          "/api/auth/password-reset/confirm",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                email:
                  ADMIN_EMAIL,

                otp,

                newPassword:
                  password,
              }),
          },
        );

      const body =
        await response.json();


      if (
        !response.ok
      ) {
        throw new Error(
          body?.message
          || "No se pudo cambiar la contraseña.",
        );
      }


      setStep(
        "done",
      );

      setMessage(
        "Contraseña actualizada correctamente.",
      );

    } catch (
      error
    ) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Error inesperado.",
      );

    } finally {
      setLoading(
        false,
      );
    }
  }


  return (
    <main
      style={{
        minHeight:
          "100vh",

        display:
          "grid",

        placeItems:
          "center",

        padding:
          24,

        background:
          "#0d1117",

        color:
          "#f3f4f6",
      }}
    >
      <section
        style={{
          width:
            "min(100%, 460px)",

          padding:
            28,

          border:
            "1px solid rgba(148,163,184,.16)",

          borderRadius:
            16,

          background:
            "#141920",
        }}
      >
        <span
          style={{
            color:
              "#c9974d",

            fontSize:
              11,

            fontWeight:
              900,

            letterSpacing:
              ".13em",
          }}
        >
          ACCESO ADMINISTRATIVO
        </span>

        <h1>
          Recuperar contraseña
        </h1>

        {step === "request"
          ? (
            <form
              onSubmit={
                requestCode
              }
            >
              <p
                style={{
                  color:
                    "#9ca3af",

                  lineHeight:
                    1.6,
                }}
              >
                Enviaremos un código de seguridad al WhatsApp administrativo configurado.
              </p>

              <button
                type="submit"
                disabled={
                  loading
                }
                style={{
                  width:
                    "100%",

                  minHeight:
                    44,

                  borderRadius:
                    9,

                  border:
                    "1px solid rgba(190,143,68,.4)",

                  background:
                    "rgba(190,143,68,.16)",

                  color:
                    "#f3f4f6",

                  cursor:
                    "pointer",
                }}
              >
                {loading
                  ? "Enviando…"
                  : "Enviar código"}
              </button>
            </form>
          )
          : null}

        {step === "confirm"
          ? (
            <form
              onSubmit={
                confirmReset
              }
              style={{
                display:
                  "grid",

                gap:
                  14,
              }}
            >
              <label>
                Código de 6 dígitos

                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={
                    otp
                  }
                  onChange={(
                    event,
                  ) =>
                    setOtp(
                      event.target.value
                        .replace(
                          /\D/g,
                          "",
                        )
                        .slice(
                          0,
                          6,
                        ),
                    )
                  }
                  style={{
                    display:
                      "block",

                    width:
                      "100%",

                    minHeight:
                      44,

                    marginTop:
                      7,

                    padding:
                      "0 12px",

                    boxSizing:
                      "border-box",
                  }}
                />
              </label>

              <label>
                Nueva contraseña

                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  value={
                    password
                  }
                  onChange={(
                    event,
                  ) =>
                    setPassword(
                      event.target.value,
                    )
                  }
                  style={{
                    display:
                      "block",

                    width:
                      "100%",

                    minHeight:
                      44,

                    marginTop:
                      7,

                    padding:
                      "0 12px",

                    boxSizing:
                      "border-box",
                  }}
                />
              </label>

              <button
                type="submit"
                disabled={
                  loading
                  || otp.length !== 6
                  || password.length < 10
                }
              >
                {loading
                  ? "Actualizando…"
                  : "Cambiar contraseña"}
              </button>
            </form>
          )
          : null}

        {message
          ? (
            <p>
              {message}
            </p>
          )
          : null}

        {step === "done"
          ? (
            <Link
              href="/login"
            >
              Volver al login
            </Link>
          )
          : (
            <p
              style={{
                marginTop:
                  20,
              }}
            >
              <Link
                href="/login"
              >
                ← Volver
              </Link>
            </p>
          )}
      </section>
    </main>
  );
}
