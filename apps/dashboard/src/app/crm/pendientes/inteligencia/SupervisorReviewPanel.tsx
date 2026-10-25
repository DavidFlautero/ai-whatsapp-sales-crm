"use client";

import {
  useEffect,
  useState,
} from "react";

type Task = {
  task_id: string;
  task_type: string;
  priority: string;
  evidence_message_ids: string[];
};

type PilotResponse = {
  ok: boolean;
  cases: Array<{
    contact_fingerprint: string;
    tasks: Task[];
  }>;
};

type Decision = {
  proposal_id: string;
  decision: string;
  decided_at: string;
};

type DecisionsResponse = {
  ok: boolean;
  reviewWritesEnabled: boolean;
  decisions: Decision[];
};

function toUuid(id: string) {
  return [
    id.slice(0, 8),
    id.slice(8, 12),
    id.slice(12, 16),
    id.slice(16, 20),
    id.slice(20),
  ].join("-");
}

export default function SupervisorReviewPanel() {
  const [pilot, setPilot] =
    useState<PilotResponse | null>(null);

  const [reviews, setReviews] =
    useState<DecisionsResponse | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function reload(signal?: AbortSignal) {
    const base =
      "/api/crm/commercial-memory/offline-review/supervisor-pilot";

    const pilotResponse = await fetch(base, {
      credentials: "include",
      cache: "no-store",
      signal,
    });

    if (!pilotResponse.ok) {
      throw new Error("PILOT_UNAVAILABLE");
    }

    const pilotData =
      (await pilotResponse.json()) as PilotResponse;

    if (!pilotData.ok || !Array.isArray(pilotData.cases)) {
      throw new Error("INVALID_PILOT_RESPONSE");
    }

    setPilot(pilotData);

    const reviewResponse = await fetch(
      `${base}/decisions`,
      {
        credentials: "include",
        cache: "no-store",
        signal,
      },
    );

    if (!reviewResponse.ok) {
      setReviews(null);
      return;
    }

    const reviewData =
      (await reviewResponse.json()) as DecisionsResponse;

    if (
      !reviewData.ok ||
      !Array.isArray(reviewData.decisions)
    ) {
      setReviews(null);
      return;
    }

    setReviews(reviewData);
  }

  useEffect(() => {
    const controller = new AbortController();

    void reload(controller.signal)
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("No se pudo cargar el supervisor.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  async function decide(
    taskId: string,
    decision: "reviewed" | "dismissed",
  ) {
    if (
      !confirmed ||
      !reviews?.reviewWritesEnabled ||
      busy
    ) {
      return;
    }

    setBusy(taskId);
    setError("");

    try {
      const response = await fetch(
        `/api/crm/commercial-memory/offline-review/supervisor-pilot/decisions/${taskId}`,
        {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "x-cm-review-intent": "human-confirmed",
          },
          body: JSON.stringify({ decision }),
        },
      );

      if (!response.ok) {
        throw new Error(
          response.status === 409
            ? "Esta propuesta ya fue revisada."
            : "No se pudo registrar la decisión.",
        );
      }

      await reload();
      setConfirmed(false);

    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Error al registrar la decisión.",
      );

    } finally {
      setBusy(null);
    }
  }

  const decisions = new Map(
    reviews?.decisions.map(item => [
      item.proposal_id.toLowerCase(),
      item,
    ]) ?? [],
  );

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-slate-900">
      <h3 className="text-lg font-semibold">
        Decisiones del supervisor comercial
      </h3>

      <p className="mt-2 text-sm text-slate-600">
        Estas decisiones documentan revisiones administrativas.
        No confirman hechos, modifican el CRM ni envían mensajes.
      </p>

      {loading && (
        <p className="mt-4 text-sm">
          Cargando revisiones…
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {pilot && !reviews && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          La bandeja de decisiones todavía no está disponible.
          Las propuestas permanecen en modo consulta.
        </p>
      )}

      {reviews && !reviews.reviewWritesEnabled && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Las aprobaciones están deshabilitadas por seguridad.
        </p>
      )}

      {pilot && reviews && (
        <>
          <label className="mt-5 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={event =>
                setConfirmed(event.target.checked)
              }
            />

            <span>
              Confirmo que revisé las evidencias disponibles.
              Comprendo que esta decisión no verifica
              automáticamente ningún hecho comercial.
            </span>
          </label>

          <div className="mt-5 space-y-3">
            {pilot.cases.flatMap(item =>
              item.tasks.map(task => {
                const uuid = toUuid(task.task_id);
                const existing = decisions.get(uuid);

                return (
                  <div
                    key={task.task_id}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <p className="font-medium">
                      {task.task_type.replaceAll("_", " ")}
                    </p>

                    <p className="mt-1 text-xs text-slate-600">
                      Expediente:{" "}
                      {item.contact_fingerprint.slice(0, 12)}
                    </p>

                    <p className="text-xs text-slate-600">
                      Referencias disponibles:{" "}
                      {task.evidence_message_ids.length}
                    </p>

                    {existing ? (
                      <p className="mt-2 text-sm font-medium text-green-700">
                        Decisión registrada: {existing.decision}
                      </p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={
                            !confirmed ||
                            !reviews.reviewWritesEnabled ||
                            busy !== null
                          }
                          onClick={() =>
                            void decide(
                              task.task_id,
                              "reviewed",
                            )
                          }
                          className="rounded-lg bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-40"
                        >
                          Marcar revisada
                        </button>

                        <button
                          type="button"
                          disabled={
                            !confirmed ||
                            !reviews.reviewWritesEnabled ||
                            busy !== null
                          }
                          onClick={() =>
                            void decide(
                              task.task_id,
                              "dismissed",
                            )
                          }
                          className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
                        >
                          Descartar
                        </button>
                      </div>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </>
      )}
    </section>
  );
}
