"use client";

import { useState } from "react";
import { StatusPill } from "../../components/admin/status-pill";
import type { ConnectionCheck, SystemStatus } from "../../lib/api";

type ServiceKey = keyof SystemStatus["services"];

const services: Array<{ key: ServiceKey; label: string }> = [
  { key: "whatsapp", label: "WhatsApp Cloud API" },
  { key: "claude", label: "Claude" },
  { key: "supabase", label: "Supabase" },
  { key: "ninox", label: "Ninox" },
  { key: "audio", label: "Transcripción de audio" }
];

function formatCheckedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-ES");
}

function ServiceCard({ label, service }: { label: string; service: ConnectionCheck }) {
  const details = Object.entries(service.details ?? {}).filter(([, value]) => value !== null);

  return (
    <div className="thought-card" style={{ minHeight: 170 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div className="thought-label">{label}</div>
        <StatusPill status={service.status} />
      </div>

      <div style={{ marginTop: 16, lineHeight: 1.55 }}>{service.message}</div>

      <div className="muted small" style={{ marginTop: 14 }}>
        {service.latencyMs === null ? "Sin latencia medida" : `${service.latencyMs} ms`}
        {" · "}
        {formatCheckedAt(service.checkedAt)}
      </div>

      {details.length > 0 ? (
        <div className="muted small" style={{ marginTop: 10 }}>
          {details.map(([key, value]) => (
            <div key={key}>
              {key}: {String(value)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ConnectionsPanel({ initialStatus }: { initialStatus: SystemStatus | null }) {
  const [status, setStatus] = useState<SystemStatus | null>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function testConnections() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/integrations/status", {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`El backend respondió HTTP ${response.status}`);
      }

      const data = (await response.json()) as SystemStatus;
      setStatus(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo consultar el backend.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <div className="panel-title">Conexiones reales</div>
          <div className="muted" style={{ marginTop: 8 }}>
            Cada estado se valida contra la API del proveedor; ya no son textos escritos a mano.
          </div>
        </div>

        <button className="btn" type="button" onClick={testConnections} disabled={loading}>
          {loading ? "Probando..." : "Probar conexiones"}
        </button>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 12,
            border: "1px solid rgba(248,113,113,.3)",
            background: "rgba(127,29,29,.2)",
            color: "#fecaca"
          }}
        >
          {error}
        </div>
      ) : null}

      {status ? (
        <>
          <div className="thought-grid" style={{ marginTop: 18 }}>
            {services.map(({ key, label }) => (
              <ServiceCard key={key} label={label} service={status.services[key]} />
            ))}
          </div>

          <div className="muted small" style={{ marginTop: 16 }}>
            Última prueba general: {formatCheckedAt(status.timestamp)} ·{" "}
            {status.allOnline ? "todas las conexiones respondieron" : "hay conexiones pendientes o con error"}
          </div>
        </>
      ) : (
        <div className="muted" style={{ marginTop: 18 }}>
          No fue posible cargar el estado inicial. Pulsá “Probar conexiones” para intentarlo de nuevo.
        </div>
      )}
    </div>
  );
}
