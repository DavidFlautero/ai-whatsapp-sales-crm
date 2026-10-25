"use client";

import { useEffect, useState } from "react";
import styles from "./VenueCalendar.module.css";

type Block = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes?: string | null;
};

const madrid = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function localDay(value: string) {
  const parts = madrid.formatToParts(new Date(value));
  const part = (name: string) =>
    parts.find((p) => p.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function madridMidnight(day: string) {
  const utc = new Date(`${day}T00:00:00Z`);
  const zone = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    timeZoneName: "shortOffset",
  }).formatToParts(utc).find((p) => p.type === "timeZoneName")?.value;

  const match = zone?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) throw new Error("INVALID_MADRID_TIMEZONE");

  const sign = match[1] === "+" ? 1 : -1;
  const minutes = sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
  return new Date(utc.getTime() - minutes * 60000).toISOString();
}

async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
  });
  const result = await response.json();

  if (!response.ok || result.ok === false) {
    throw new Error(result.error ?? `HTTP_${response.status}`);
  }
  return result;
}

export default function VenueCalendar({
  venueId,
}: {
  venueId: string;
}) {
  const [month, setMonth] = useState(
    () => new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  const [day, setDay] = useState(1);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const year = month.getUTCFullYear();
  const number = month.getUTCMonth();
  const count = new Date(Date.UTC(year, number + 1, 0)).getUTCDate();
  const leading = (new Date(Date.UTC(year, number, 1)).getUTCDay() + 6) % 7;

  function dateKey(n: number) {
    return `${year}-${String(number + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
  }

  const url = `/api/crm/venues/${encodeURIComponent(venueId)}/calendar`;

  useEffect(() => {
    let active = true;
    const from = new Date(Date.UTC(year, number, 1) - 172800000).toISOString();
    const to = new Date(Date.UTC(year, number + 1, 1) + 172800000).toISOString();

    setLoading(true);
    setError("");

    void api(`${url}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((result) => {
        if (active) setBlocks(Array.isArray(result.blocks) ? result.blocks : []);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "ERROR_CALENDAR");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [url, year, number, revision]);

  function dayBlocks(n: number) {
    const key = dateKey(n);
    return blocks.filter((b) =>
      Date.parse(b.ends_at) > Date.parse(b.starts_at) &&
      localDay(b.starts_at) <= key &&
      localDay(new Date(Date.parse(b.ends_at) - 1).toISOString()) >= key &&
      !["cancelled", "expired"].includes(b.status)
    );
  }

  function move(n: number) {
    setMonth(new Date(Date.UTC(year, number + n, 1)));
    setDay(1);
  }

  async function blockDay() {
    if (!window.confirm(`¿Bloquear el ${dateKey(day)} completo?`)) return;
    setBusy(true);
    setError("");

    try {
      const start = dateKey(day);
      const next = new Date(Date.UTC(year, number, day + 1))
        .toISOString().slice(0, 10);

      await api(`${url}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: madridMidnight(start),
          endsAt: madridMidnight(next),
          status: "blocked",
        }),
      });
      setRevision((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ERROR_BLOCK");
    } finally {
      setBusy(false);
    }
  }

  async function cancelBlock(id: string) {
    if (!window.confirm("¿Liberar este bloqueo?")) return;
    setBusy(true);
    setError("");
    try {
      await api(`${url}/blocks/${encodeURIComponent(id)}/cancel`, {
        method: "PATCH",
      });
      setRevision((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ERROR_CANCEL");
    } finally {
      setBusy(false);
    }
  }

  const chosen = dayBlocks(day);

  return (
    <section className={styles.calendar}>
      <h2 className="mb-1 text-lg font-semibold">Calendario del chalet</h2>
      <p className="mb-4 text-sm opacity-70">
        Sin bloqueos no significa disponibilidad confirmada por el propietario.
      </p>

      <div className="mb-4 flex items-center justify-between gap-3">
        <button type="button" className="rounded border px-3 py-2"
          onClick={() => move(-1)}>Anterior</button>
        <strong className="capitalize">
          {month.toLocaleDateString("es-ES", {
            timeZone: "UTC", month: "long", year: "numeric"
          })}
        </strong>
        <button type="button" className="rounded border px-3 py-2"
          onClick={() => move(1)}>Siguiente</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
          <div key={i} className="py-2 font-semibold">{d}</div>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const n = i + 1;
          const entries = dayBlocks(n);
          const kind = entries.some(b => b.status === "reserved") ? "reserved"
            : entries.some(b => b.status === "blocked") ? "blocked"
            : entries.some(b => b.status === "held") ? "held" : "unknown";

          const tone = kind === "reserved" ? "bg-red-200 text-red-950"
            : kind === "blocked" ? "bg-slate-300 text-slate-950"
            : kind === "held" ? "bg-amber-200 text-amber-950"
            : "bg-slate-100 text-slate-900";

          return (
            <button type="button" key={n}
              onClick={() => setDay(n)}
              className={`min-h-10 rounded-md text-sm ${tone}
                ${day === n ? "ring-2 ring-blue-600" : ""}`}>
              {n}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs opacity-70">
        Rojo: reservado · Gris: bloqueado · Amarillo: retenido ·
        Claro: sin ocupación registrada
      </p>

      <div className="mt-4 border-t pt-4">
        <h3 className="font-semibold">
          {day} de {month.toLocaleDateString("es-ES", {
            timeZone: "UTC", month: "long"
          })}
        </h3>

        {loading ? <p>Cargando calendario...</p> : null}
        {error ? <p role="alert" className="my-2 text-red-600">{error}</p> : null}

        {!loading && !error && chosen.length === 0 ? (
          <p className="my-2 text-sm">No hay ocupación registrada para este día.</p>
        ) : null}

        {chosen.map((b) => (
          <div key={b.id} className="my-2 rounded border p-3 text-sm">
            <strong>{b.status === "reserved" ? "Reservado"
              : b.status === "held" ? "Retención"
              : b.status === "blocked" ? "Bloqueado" : b.status}</strong>
            <p>{new Date(b.starts_at).toLocaleString("es-ES", {
              timeZone: "Europe/Madrid"
            })} — {new Date(b.ends_at).toLocaleString("es-ES", {
              timeZone: "Europe/Madrid"
            })}</p>
            {b.notes ? <p>{b.notes}</p> : null}
            {["blocked", "held"].includes(b.status) ? (
              <button type="button" disabled={busy}
                className="mt-2 rounded border px-3 py-2"
                onClick={() => void cancelBlock(b.id)}>
                Liberar bloqueo
              </button>
            ) : null}
          </div>
        ))}

        <button type="button"
          disabled={busy || loading || Boolean(error) || chosen.length > 0}
          className="mt-3 rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
          onClick={() => void blockDay()}>
          {busy ? "Guardando..." : "Bloquear día completo"}
        </button>
      </div>
    </section>
  );
}
