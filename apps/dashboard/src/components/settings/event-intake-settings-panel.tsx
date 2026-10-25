"use client";

import { useEffect, useState } from "react";
import styles from "../../app/settings/Settings.module.css";

const API = "/api";

type IntakeSettings = {
  enabled: boolean;
  response_mode: "observe" | "assist" | "auto";
  automatic_replies: boolean;
  pause_on_human_operator: boolean;
  confidence_threshold: number;
  max_questions_per_reply: number;
  generate_form_link: boolean;
};

const defaults: IntakeSettings = {
  enabled: false,
  response_mode: "observe",
  automatic_replies: false,
  pause_on_human_operator: true,
  confidence_threshold: 0.9,
  max_questions_per_reply: 1,
  generate_form_link: true,
};

export function EventIntakeSettingsPanel() {
  const [settings, setSettings] = useState<IntakeSettings | null>(null);
  const [runtimeEnabled, setRuntimeEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch(`${API}/crm/intake-settings`, {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (!active) return;

        setSettings({ ...defaults, ...result.settings });
        setRuntimeEnabled(Boolean(result.runtimeCaptureEnabled));
      } catch (reason) {
        if (active) {
          setError(`No se pudo cargar la configuración: ${String(reason)}`);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  function update(patch: Partial<IntakeSettings>) {
    setSettings(current => current ? { ...current, ...patch } : current);
    setNotice("");
  }

  async function save() {
    if (!settings || saving) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API}/crm/intake-settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: settings.enabled,
          responseMode: settings.response_mode === "auto"
            ? "observe"
            : settings.response_mode,
          pauseOnHumanOperator: settings.pause_on_human_operator,
          confidenceThreshold: Number(settings.confidence_threshold),
          maxQuestionsPerReply: Number(settings.max_questions_per_reply),
          generateFormLink: settings.generate_form_link,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      setSettings({ ...defaults, ...result.settings });
      setRuntimeEnabled(Boolean(result.runtimeCaptureEnabled));

      setNotice(
        "Configuración guardada en Supabase. " +
        "Las respuestas automáticas permanecen desactivadas."
      );
    } catch (reason) {
      setError(`No se pudo guardar: ${String(reason)}`);
    } finally {
      setSaving(false);
    }
  }

  const toggleStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    padding: "12px 0",
  };

  return (
    <section className={styles.sectionCard} aria-label="Captación inteligente">
      <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7 }}>
        WHATSAPP · CRM · INTELIGENCIA ARTIFICIAL
      </div>

      <h2 className={styles.sectionTitle}>
        Captación comercial inteligente
      </h2>

      <p>
        Identifica solicitudes de eventos, conserva los datos de cada
        conversación y prepara la información comercial del cliente.
      </p>

      {error && <p role="alert" style={{ color: "#c0392b" }}>{error}</p>}
      {notice && <p role="status">{notice}</p>}

      {!settings ? (
        <p>Cargando configuración...</p>
      ) : (
        <div style={{ display: "grid", gap: 12, maxWidth: 680 }}>
          <div style={toggleStyle}>
            <div>
              <strong>Captación habilitada en Supabase</strong>
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                Guarda nuevas solicitudes en el CRM cuando el servidor
                tiene habilitada la captura.
              </div>
            </div>
            <input
              aria-label="Habilitar captación"
              type="checkbox"
              checked={settings.enabled}
              onChange={event => update({ enabled: event.target.checked })}
            />
          </div>

          <p style={{ fontSize: 13 }}>
            Estado del servidor:{" "}
            <strong>
              {runtimeEnabled ? "Captura habilitada" : "Captura desactivada"}
            </strong>
          </p>

          <label style={{ display: "grid", gap: 7 }}>
            <strong>Modo de funcionamiento</strong>
            <select
              value={settings.response_mode === "auto"
                ? "observe"
                : settings.response_mode}
              onChange={event =>
                update({
                  response_mode: event.target.value as "observe" | "assist",
                })
              }
              style={{ padding: 10, borderRadius: 8 }}
            >
              <option value="observe">Observación: sólo registrar</option>
              <option value="assist">Asistencia: preparar sugerencias</option>
              <option value="auto" disabled>
                Automático: pendiente de habilitación
              </option>
            </select>
          </label>

          <label style={toggleStyle}>
            <span>Pausar la IA cuando interviene un operador</span>
            <input
              type="checkbox"
              checked={settings.pause_on_human_operator}
              onChange={event =>
                update({ pause_on_human_operator: event.target.checked })
              }
            />
          </label>

          <label style={toggleStyle}>
            <span>Generar enlace al formulario del evento</span>
            <input
              type="checkbox"
              checked={settings.generate_form_link}
              onChange={event =>
                update({ generate_form_link: event.target.checked })
              }
            />
          </label>

          <label style={{ display: "grid", gap: 7 }}>
            <strong>
              Confianza mínima:{" "}
              {Math.round(settings.confidence_threshold * 100)} %
            </strong>
            <input
              type="range"
              min="50"
              max="100"
              step="5"
              value={Math.round(settings.confidence_threshold * 100)}
              onChange={event =>
                update({
                  confidence_threshold: Number(event.target.value) / 100,
                })
              }
            />
          </label>

          <label style={{ display: "grid", gap: 7 }}>
            <strong>Máximo de preguntas por respuesta</strong>
            <select
              value={settings.max_questions_per_reply}
              onChange={event =>
                update({
                  max_questions_per_reply: Number(event.target.value),
                })
              }
              style={{ padding: 10, borderRadius: 8 }}
            >
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>

          <p style={{ fontSize: 13, opacity: 0.75 }}>
            Respuestas automáticas de esta captación: desactivadas.
            Estos parámetros no autorizan el envío de mensajes.
          </p>

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            style={{
              padding: "12px 18px",
              borderRadius: 8,
              cursor: saving ? "wait" : "pointer",
              fontWeight: 700,
              maxWidth: 260,
            }}
          >
            {saving ? "Guardando..." : "Guardar configuración"}
          </button>
        </div>
      )}
    </section>
  );
}
