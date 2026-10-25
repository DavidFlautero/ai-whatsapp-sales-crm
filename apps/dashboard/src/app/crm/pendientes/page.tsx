"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  loadVenuePendingData,
  type VenueAudit,
} from "./venue-pending-data";

type Filter =
  | "all"
  | "pending"
  | "unknown"
  | "complete";

function Metric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="cm-metric">
      <div className="cm-metric-label">
        {label}
      </div>

      <div className="cm-metric-value">
        {value}
      </div>
    </div>
  );
}

function MediaStat({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="cm-media-stat">
      <strong>
        {value === null
          ? "—"
          : value}
      </strong>

      <span>
        {label}
      </span>
    </div>
  );
}

function VenueCard({
  item,
}: {
  item: VenueAudit;
}) {
  const hasPending =
    item.pending.length > 0;

  const hasUnknown =
    item.unknown.length > 0;

  const status = hasPending
    ? "Pendiente"
    : hasUnknown
      ? "Por verificar"
      : "Sin pendientes detectados";

  const statusClass = hasPending
    ? "cm-pill-amber"
    : hasUnknown
      ? "cm-pill-gray"
      : "cm-pill-green";

  return (
    <article className="cm-venue">
      <div className="cm-venue-head">
        <div>
          <h3 className="cm-venue-name">
            {item.venue.name}
          </h3>

          <p className="cm-venue-location">
            {[
              item.venue.city,
              item.venue.province,
            ].filter(Boolean).join(", ") ||
              "Ubicación por verificar"}
          </p>
        </div>

        <span
          className={`cm-pill ${statusClass}`}
        >
          {status}
        </span>
      </div>

      <div className="cm-media-stats">
        <MediaStat
          label="Fotografías"
          value={item.photos}
        />

        <MediaStat
          label="Vídeos"
          value={item.videos}
        />

        <MediaStat
          label="Documentos"
          value={item.docs}
        />
      </div>

      <div className="cm-issue-list">
        {item.pending.map(
          (pending, index) => (
            <span
              key={`${pending}-${index}`}
              className="cm-issue"
            >
              {pending}
            </span>
          ),
        )}

        {item.unknown.map(
          (unknown, index) => (
            <span
              key={`${unknown}-${index}`}
              className="cm-issue cm-issue-unknown"
            >
              {unknown}
            </span>
          ),
        )}

        {!hasPending && !hasUnknown && (
          <span className="cm-pill cm-pill-green">
            Sin faltantes detectados
          </span>
        )}
      </div>

      <div className="cm-venue-foot">
        <Link href="/crm/espacios">
          Abrir editor de espacios
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

export default function PendientesPage() {
  const [items, setItems] =
    useState<VenueAudit[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [progress, setProgress] =
    useState("");

  const [error, setError] =
    useState<string | null>(null);

  const [filter, setFilter] =
    useState<Filter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setProgress("");

    try {
      const result =
        await loadVenuePendingData(
          (completed, total) => {
            setProgress(
              `${completed} de ${total} espacios verificados`,
            );
          },
        );

      setItems(result);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudieron cargar los espacios",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const pending = items.filter(
      item => item.pending.length > 0,
    ).length;

    const unknown = items.filter(
      item =>
        item.pending.length === 0 &&
        item.unknown.length > 0,
    ).length;

    const complete = items.filter(
      item =>
        item.pending.length === 0 &&
        item.unknown.length === 0,
    ).length;

    return {
      total: items.length,
      pending,
      unknown,
      complete,
    };
  }, [items]);

  const visible = useMemo(() => {
    switch (filter) {
      case "pending":
        return items.filter(
          item => item.pending.length > 0,
        );

      case "unknown":
        return items.filter(
          item =>
            item.pending.length === 0 &&
            item.unknown.length > 0,
        );

      case "complete":
        return items.filter(
          item =>
            item.pending.length === 0 &&
            item.unknown.length === 0,
        );

      default:
        return items;
    }
  }, [items, filter]);

  return (
    <main className="cm-screen">
      <header className="cm-heading">
        <div>
          <span className="cm-eyebrow">
            CRM / Control operativo
          </span>

          <h1>
            Pendientes de espacios
          </h1>

          <p>
            Verificamos fotografías y vídeos
            utilizando las mismas rutas del
            editor de espacios.
            Los datos no disponibles
            aparecen como no verificados,
            nunca como cero.
          </p>
        </div>

        <div className="cm-topbar-links">
          <button
            type="button"
            className="cm-btn cm-btn-secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading
              ? "Verificando..."
              : "Actualizar datos"}
          </button>

          <Link
            href="/crm/pendientes/inteligencia"
            className="cm-btn cm-btn-primary"
          >
            Inteligencia comercial →
          </Link>
        </div>
      </header>

      {error && (
        <div className="cm-error">
          No se pudo completar la consulta:
          {" "}
          {error}
        </div>
      )}

      <section className="cm-metrics">
        <Metric
          label="Espacios registrados"
          value={stats.total}
        />

        <Metric
          label="Con pendientes confirmados"
          value={stats.pending}
        />

        <Metric
          label="Por verificar"
          value={stats.unknown}
        />

        <Metric
          label="Sin pendientes detectados"
          value={stats.complete}
        />
      </section>

      <div className="cm-note">
        <strong>
          Información sincronizada con CRM → Espacios.
        </strong>
        {" "}
        La galería y los vídeos se consultan
        individualmente para cada espacio.
        Si una consulta no responde, no
        afirmamos que falten archivos.
      </div>

      <section className="cm-panel">
        <header className="cm-panel-heading">
          <div>
            <h2>
              Estado de los espacios
            </h2>

            <p>
              {loading
                ? progress || "Consultando datos..."
                : `${visible.length} espacios en esta vista`}
            </p>
          </div>

          <div className="cm-topbar-links">
            {([
              ["all", "Todos"],
              ["pending", "Pendientes"],
              ["unknown", "Por verificar"],
              ["complete", "Sin pendientes"],
            ] as const).map(
              ([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={
                    filter === value
                      ? "cm-btn cm-btn-primary"
                      : "cm-btn cm-btn-secondary"
                  }
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </header>

        {loading && (
          <div className="cm-empty">
            Verificando fotografías, vídeos
            y documentación...
            <br />
            {progress}
          </div>
        )}

        {!loading && visible.length > 0 && (
          <div className="cm-venue-grid">
            {visible.map(item => (
              <VenueCard
                key={item.venue.id}
                item={item}
              />
            ))}
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="cm-empty">
            No hay espacios en esta categoría.
          </div>
        )}
      </section>
    </main>
  );
}
