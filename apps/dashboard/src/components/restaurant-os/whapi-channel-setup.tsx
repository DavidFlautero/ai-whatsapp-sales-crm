"use client";

import { useEffect, useState, type FormEvent } from "react";

type ChannelStatus = {
  connected: boolean;
  phone: string | null;
  testPhone: string | null;
};

export default function WhapiChannelSetup() {
  const [status, setStatus] = useState<ChannelStatus | null>(null);
  const [phone, setPhone] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/dashboard-api/operator/channel", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "No se pudo consultar Whapi");
        }
        const channel: ChannelStatus = payload.data;
        setStatus(channel);
        setPhone(channel.phone ?? "");
        setTestPhone(channel.testPhone ?? "");
      })
      .catch(failure => {
        if (!controller.signal.aborted) {
          setError(failure instanceof Error ? failure.message : "Error de conexión");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/dashboard-api/operator/channel", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, phone, testPhone }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "No se pudo conectar Whapi");
      }
      setStatus(payload.data as ChannelStatus);
      setToken("");
      setNotice("Canal registrado y credencial cifrada. Probá ahora el envío manual desde Conversaciones. La IA sigue pausada hasta validar esa prueba.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    display: "block",
    boxSizing: "border-box" as const,
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    font: "inherit",
  };

  return (
    <section style={{ maxWidth: 780, margin: "30px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 26, margin: "0 0 10px" }}>Integraciones de Delibocados</h1>
      <p style={{ color: "#475569", lineHeight: 1.6 }}>
        El WhatsApp ya puede recibir mensajes por webhook. Esta configuración registra
        la credencial de envío del mismo canal de Whapi; no crea un canal nuevo ni
        desconecta el teléfono.
      </p>

      <div style={{
        background: "white", border: "1px solid #dbe3ec", borderRadius: 18,
        padding: 26, boxShadow: "0 12px 30px rgba(15,23,42,.05)",
      }}>
        <h2 style={{ marginTop: 0, fontSize: 20 }}>Canal Whapi</h2>
        {loading ? <p>Consultando conexión…</p> : null}
        {!loading && status ? (
          <p role="status" style={{ color: status.connected ? "#047857" : "#92400e" }}>
            {status.connected
              ? `Conexión saliente configurada · ${status.phone}`
              : "Recepción activa; credencial saliente pendiente de registrar."}
          </p>
        ) : null}

        <form onSubmit={submit} autoComplete="off">
          <label style={{ display: "block", marginTop: 18 }}>
            Número WhatsApp de Delibocados (con indicativo del país)
            <input style={inputStyle} required inputMode="tel"
              value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="57…" />
          </label>
          <label style={{ display: "block", marginTop: 18 }}>
            Tu número para probar la IA (con indicativo del país)
            <input style={inputStyle} required inputMode="tel"
              value={testPhone} onChange={e => setTestPhone(e.target.value)}
              placeholder="57… o 34…" />
          </label>
          <label style={{ display: "block", marginTop: 18 }}>
            Token de API del canal actual de Whapi
            <input style={inputStyle} required type="password"
              autoComplete="new-password" value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Pegá aquí el token, sin compartirlo por chat" />
          </label>

          {error ? <p role="alert" style={{ color: "#b91c1c" }}>{error}</p> : null}
          {notice ? <p role="status" style={{ color: "#047857" }}>{notice}</p> : null}

          <button type="submit" disabled={busy || loading}
            style={{
              border: 0, borderRadius: 10, background: "#0f4c6e",
              color: "white", padding: "13px 20px", marginTop: 22,
              cursor: busy || loading ? "wait" : "pointer", fontWeight: 700,
            }}>
            {busy ? "Validando y guardando…" : status?.connected
              ? "Actualizar credencial Whapi" : "Conectar canal existente"}
          </button>
        </form>

        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 0, marginTop: 22 }}>
          Primero verificamos el token ante Whapi. Después se guarda cifrado por
          empresa en PostgreSQL. La IA permanece detenida durante las pruebas.
        </p>
      </div>
    </section>
  );
}
