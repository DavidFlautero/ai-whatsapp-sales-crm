"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import Link from "next/link";

type CaseRow = {
  id: string;
  state: string;
  event_date: string | null;
  venue_label: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  priority: string;
  task_type: string;
  case_id: string | null;
  created_at: string;
};

type LinkRow = {
  id: string;
  target_table: string;
  target_id: string;
  case_id: string | null;
  confidence: number;
  match_basis: string;
};

type TaskResponse = {
  tasks: TaskRow[];
  quarantined: number;
};

type StatusResponse = {
  operational: boolean;
  reviewWritesEnabled: boolean;
};

type DeskData = {
  cases: CaseRow[];
  tasks: TaskResponse;
  links: LinkRow[];
  status: StatusResponse;
};

async function get<T>(
  resource: string,
): Promise<T> {
  const response = await fetch(
    `/api/crm/commercial-memory/desk/${resource}`,
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `CRM_DESK_HTTP_${response.status}`,
    );
  }

  return response.json() as Promise<T>;
}

function Priority({
  value,
}: {
  value: string;
}) {
  const style =
    value === "critical"
      ? "bg-red-100 text-red-700"
      : value === "high"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-600";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${style}`}
    >
      {value}
    </span>
  );
}

export default function CommercialOperationsDesk() {
  const [data, setData] =
    useState<DeskData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [busyId, setBusyId] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        cases,
        tasks,
        links,
        status,
      ] = await Promise.all([
        get<CaseRow[]>("cases"),
        get<TaskResponse>("tasks"),
        get<LinkRow[]>("links"),
        get<StatusResponse>("status"),
      ]);

      setData({
        cases,
        tasks,
        links,
        status,
      });

    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "CRM no disponible",
      );

    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function review(
    link: LinkRow,
    decision: "accepted" | "rejected",
  ) {
    const action =
      decision === "accepted"
        ? "Aceptar"
        : "Rechazar";

    const confirmed = window.confirm(
      `${action} esta asociación con ${link.target_table}?\n\n` +
      "La decisión quedará auditada. " +
      "No modifica automáticamente la ficha original.",
    );

    if (!confirmed) return;

    setBusyId(link.id);
    setError(null);

    try {
      const response = await fetch(
        `/api/crm/commercial-memory/desk/links/${link.id}/review`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "x-cm-review-intent": "human-confirmed",
          },
          body: JSON.stringify({
            decision,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `REVIEW_HTTP_${response.status}`,
        );
      }

      await refresh();

    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo registrar la decisión",
      );

    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Centro operativo comercial
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Seguimientos, expedientes y asociaciones
            recuperadas de WhatsApp.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => void refresh()}
          className="rounded-lg border bg-white px-4 py-2 text-sm"
        >
          Actualizar
        </button>
      </header>

      {loading && (
        <div className="rounded-xl border bg-white p-5 text-sm">
          Consultando tareas comerciales...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border bg-white p-5">
              <p className="text-sm text-slate-500">
                Expedientes candidatos
              </p>
              <strong className="mt-2 block text-3xl">
                {data.cases.length}
              </strong>
            </div>

            <div className="rounded-xl border bg-white p-5">
              <p className="text-sm text-slate-500">
                Tareas para revisar
              </p>
              <strong className="mt-2 block text-3xl">
                {data.tasks.tasks.length}
              </strong>
            </div>

            <div className="rounded-xl border bg-white p-5">
              <p className="text-sm text-slate-500">
                Asociaciones propuestas
              </p>
              <strong className="mt-2 block text-3xl">
                {data.links.length}
              </strong>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-xl border bg-white p-5">
              <h3 className="text-xl font-semibold">
                Pendientes operativos
              </h3>

              {data.tasks.quarantined > 0 && (
                <p className="mt-2 text-sm text-amber-700">
                  {data.tasks.quarantined} tareas
                  requieren revisar su evidencia.
                </p>
              )}

              <div className="mt-4 max-h-[650px] space-y-3 overflow-y-auto">
                {data.tasks.tasks.map(task => (
                  <article
                    key={task.id}
                    className="rounded-lg border p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="font-medium">
                        {task.title}
                      </span>

                      <Priority value={task.priority} />
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      Tipo: {task.task_type}
                    </p>

                    {task.case_id && (
                      <Link
                        href={`/crm/pendientes/inteligencia/expediente/${task.case_id}`}
                        className="mt-3 inline-block text-sm font-medium text-blue-700 underline"
                      >
                        Abrir expediente
                      </Link>
                    )}
                  </article>
                ))}

                {data.tasks.tasks.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No hay tareas disponibles.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border bg-white p-5">
              <h3 className="text-xl font-semibold">
                Expedientes comerciales
              </h3>

              <div className="mt-4 max-h-[650px] space-y-3 overflow-y-auto">
                {data.cases.map(item => (
                  <article
                    key={item.id}
                    className="rounded-lg border p-4"
                  >
                    <div className="font-medium">
                      {item.venue_label ||
                        "Espacio por identificar"}
                    </div>

                    <div className="mt-2 text-sm text-slate-600">
                      Fecha:{" "}
                      {item.event_date ||
                        "Por confirmar"}
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      Estado: {item.state}
                    </p>

                    <Link
                      href={`/crm/pendientes/inteligencia/expediente/${item.id}`}
                      className="mt-3 inline-block text-sm font-medium text-blue-700 underline"
                    >
                      Ver expediente e historial
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <h3 className="text-xl font-semibold">
              Relaciones propuestas con el CRM
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              Confirmá únicamente asociaciones
              respaldadas por información suficiente.
              Las aprobaciones se registran en auditoría.
            </p>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {data.links.map(link => (
                <article
                  key={link.id}
                  className="rounded-lg border p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">
                      {link.target_table}
                    </span>

                    <span className="text-sm text-slate-500">
                      {Math.round(link.confidence * 100)}%
                    </span>
                  </div>

                  <p className="mt-2 break-all text-xs text-slate-500">
                    Registro: {link.target_id}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Método: {link.match_basis}
                  </p>

                  {data.status.reviewWritesEnabled && (
                    <div className="mt-4 flex gap-2">
                      <button
                        disabled={busyId !== null}
                        onClick={() =>
                          void review(link, "accepted")
                        }
                        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50"
                      >
                        Aceptar
                      </button>

                      <button
                        disabled={busyId !== null}
                        onClick={() =>
                          void review(link, "rejected")
                        }
                        className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
