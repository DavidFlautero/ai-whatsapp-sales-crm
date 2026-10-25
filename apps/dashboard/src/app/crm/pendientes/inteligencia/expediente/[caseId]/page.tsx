"use client";

import CommercialConversationTimeline from "../../CommercialConversationTimeline";


import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import Link from "next/link";

type CommercialCase = {
  id: string;
  state: string;
  event_date: string | null;
  venue_label: string | null;
};

type TimelineMessage = {
  id: string;
  direction: string | null;
  createdAt: string;
  type: string | null;
  text: string | null;
};

type DossierTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  task_type: string;
};

type DossierLink = {
  id: string;
  target_table: string;
  target_id: string;
  confidence: number;
  status: string;
};

type Dossier = {
  commercialCase: CommercialCase;
  customerName: string | null;
  messageCount: number;
  messages: TimelineMessage[];
  tasks: DossierTask[];
  links: DossierLink[];
};

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("es-ES");
}

export default function CommercialDossierPage() {
  const params = useParams();

  const rawId = params.caseId;

  const caseId =
    typeof rawId === "string"
      ? rawId
      : "";

  const [data, setData] =
    useState<Dossier | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/crm/commercial-memory/desk/cases/${caseId}`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(
            `EXPEDIENTE_HTTP_${response.status}`,
          );
        }

        const dossier =
          await response.json() as Dossier;

        if (!cancelled) {
          setData(dossier);
        }

      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudo cargar el expediente",
          );
        }

      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <Link
          href="/crm/pendientes/inteligencia"
          className="text-sm text-blue-700 underline"
        >
          Volver a inteligencia comercial
        </Link>

        <h1 className="mt-4 text-3xl font-semibold">
          Expediente comercial
        </h1>
      </header>

      {loading && (
        <div className="rounded-xl border bg-white p-5">
          Cargando expediente...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
          {error}
        </div>
      )}

      {data && (
        <>
          <section className="rounded-xl border bg-white p-6">
            <h2 className="text-xl font-semibold">
              {data.commercialCase.venue_label ||
                "Evento por identificar"}
            </h2>

            <div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
              <div>
                <span className="text-slate-500">
                  Cliente
                </span>
                <p className="font-medium">
                  {data.customerName ||
                    "Identidad sin nombre confirmado"}
                </p>
              </div>

              <div>
                <span className="text-slate-500">
                  Fecha del evento
                </span>
                <p className="font-medium">
                  {data.commercialCase.event_date ||
                    "Por confirmar"}
                </p>
              </div>

              <div>
                <span className="text-slate-500">
                  Estado
                </span>
                <p className="font-medium">
                  {data.commercialCase.state}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-amber-700">
              Expediente candidato. No representa
              necesariamente una reserva confirmada.
            </p>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border bg-white p-6">
              <h2 className="text-xl font-semibold">
                Seguimientos
              </h2>

              <div className="mt-4 space-y-3">
                {data.tasks.map(task => (
                  <article
                    key={task.id}
                    className="rounded-lg border p-4"
                  >
                    <p className="font-medium">
                      {task.title}
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      {task.priority} · {task.status}
                    </p>
                  </article>
                ))}

                {data.tasks.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No hay tareas vinculadas.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border bg-white p-6">
              <h2 className="text-xl font-semibold">
                Relaciones comerciales
              </h2>

              <div className="mt-4 space-y-3">
                {data.links.map(link => (
                  <article
                    key={link.id}
                    className="rounded-lg border p-4"
                  >
                    <p className="font-medium">
                      {link.target_table}
                    </p>

                    <p className="mt-2 break-all text-xs text-slate-500">
                      Registro: {link.target_id}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Estado: {link.status}
                    </p>
                  </article>
                ))}

                {data.links.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Todavía no hay relaciones
                    vinculadas directamente a esta operación.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  Historial relacionado
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {data.messageCount} mensajes asociados.
                  Se muestran hasta 100 por consulta.
                </p>
              </div>

              <Link
                href="/conversations"
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Abrir conversaciones
              </Link>
            </div>

            <CommercialConversationTimeline
              messages={data.messages}
            />
          </section>
        </>
      )}
    </main>
  );
}
