"use client";
import SupervisorReviewPanel from "./SupervisorReviewPanel";
import OfflineSupervisorPilot from "./OfflineSupervisorPilot";

import OfflineHistoricalReview from "./OfflineHistoricalReview";

import CommercialQualityNotice from "./CommercialQualityNotice";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import CommercialOperationsDesk from "./CommercialOperationsDesk";

import CommercialCoveragePanel from "./CommercialCoveragePanel";


type Overview = {
  company: string;
  identities: number;
  cases: number;
  receipts: number;
  observations: number;
  links: number;
  tasks: number;
  partners: number;
};

type Case = {
  id: string;
  state?: string;
  event_date?: string | null;
  venue_label?: string | null;
};

type Task = {
  id: string;
  case_id?: string | null;
  title: string;
  priority: string;
  status: string;
  task_type: string;
};

type LinkRow = {
  id: string;
  identity_id: string;
  target_table: string;
  target_id: string;
  match_basis: string;
  confidence: number;
};

type Observation = {
  id: string;
  confidence: number;
  created_at: string;
  observation?: {
    commercial_move?: string;
    actor_role?: string;
    evidence_quote?: string;
    recommended_action?: string;
  };
};

type DashboardData = {
  overview: Overview;
  cases: Case[];
  tasks: Task[];
  links: LinkRow[];
  observations: Observation[];
};

async function read<T>(
  name: string,
): Promise<T> {
  const response = await fetch(
    `/api/crm/commercial-memory/${name}`,
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `CRM_MEMORY_HTTP_${response.status}:${name}`,
    );
  }

  return response.json() as Promise<T>;
}

function formatDate(
  value?: string | null,
) {
  if (!value) return "Sin fecha confirmada";

  return value.slice(0, 10);
}

function priorityRank(value: string): number {
  const priorities: Record<string, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
  };

  return priorities[value] ?? 4;
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-3xl font-semibold text-slate-900">
        {value}
      </div>
    </div>
  );
}

export default function InteligenciaComercialPage() {

  const [activeTab, setActiveTab] = useState<
    "resumen" |
    "oportunidades" |
    "contactos" |
    "supervisor" |
    "auditoria"
  >("resumen");

  const [showTechnical, setShowTechnical] = useState(false);

  const [data, setData] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        overview,
        cases,
        tasks,
        links,
        observations,
      ] = await Promise.all([
        read<Overview>("overview"),
        read<Case[]>("cases"),
        read<Task[]>("tasks"),
        read<LinkRow[]>("links"),
        read<Observation[]>("observations"),
      ]);

      setData({
        overview,
        cases,
        tasks,
        links,
        observations,
      });

    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo consultar el CRM",
      );

    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 text-sm text-slate-500">
            <Link href="/crm/pendientes">
              CRM / Pendientes
            </Link>
          </div>

          <h1 className="text-3xl font-semibold text-slate-900">
            Inteligencia comercial
          </h1>

          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Expedientes, seguimientos, relaciones
            propuestas y evidencias recuperadas
            de las conversaciones de WhatsApp.
          </p>
        </div>

        <button
          onClick={() => void refresh()}
          disabled={loading}
          className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          Actualizar
        </button>
      </header>


      {/* INTELIGENCIA_TABS_V2 */}

      <nav
        aria-label="Navegación comercial"
        className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
      >
        <div
          role="tablist"
          aria-label="Secciones comerciales"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {([
            ["resumen", "Resumen"],
            ["oportunidades", "Clientes y eventos"],
            ["contactos", "Contactos"],
            ["supervisor", "Supervisor IA"],
            ["auditoria", "Auditoría"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={
                "shrink-0 rounded-xl px-5 py-3 text-sm font-semibold transition-colors " +
                (
                  activeTab === id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                )
              }
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {activeTab === "resumen" && data && (
        <section className="space-y-6">

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Oportunidades detectadas"
              value={data.overview.cases}
            />
            <Stat
              label="Tareas registradas"
              value={data.overview.tasks}
            />
            <Stat
              label="Contactos históricos"
              value={data.overview.identities}
            />
            <Stat
              label="Vínculos por verificar"
              value={data.overview.links}
            />
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <h2 className="font-semibold text-blue-950">
              Estado de la inteligencia comercial
            </h2>

            <p className="mt-2 text-sm leading-6 text-blue-900">
              Los expedientes y relaciones detectados son propuestas.
              Todavía requieren verificación humana.
              No equivalen a reservas confirmadas.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  Seguimientos prioritarios
                </h2>

                <button
                  type="button"
                  onClick={() => setActiveTab("oportunidades")}
                  className="text-sm font-medium text-blue-700 hover:underline"
                >
                  Ver todos
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {[...data.tasks]
                  .sort(
                    (a, b) =>
                      priorityRank(a.priority) -
                      priorityRank(b.priority)
                  )
                  .slice(0, 5)
                  .map(task => (
                    <article
                      key={task.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="font-medium text-slate-900">
                        {task.title}
                      </div>

                      <div className="mt-2 text-xs text-slate-500">
                        Prioridad: {task.priority}
                      </div>

                      {task.case_id && (
                        <Link
                          href={
                            "/crm/pendientes/inteligencia/expediente/" +
                            encodeURIComponent(task.case_id)
                          }
                          className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline"
                        >
                          Abrir expediente
                        </Link>
                      )}
                    </article>
                  ))}

                {data.tasks.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No hay tareas registradas.
                  </p>
                )}
              </div>

            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  Expedientes recientes
                </h2>

                <button
                  type="button"
                  onClick={() => setActiveTab("oportunidades")}
                  className="text-sm font-medium text-blue-700 hover:underline"
                >
                  Ver todos
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {data.cases.slice(0, 5).map(item => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="font-medium text-slate-900">
                      Solicitud comercial por verificar
                    </div>

                    <div className="mt-2 text-sm text-slate-600">
                      Fecha: {formatDate(item.event_date)}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      Estado: {item.state || "Sin clasificar"}
                    </div>

                    <Link
                      href={
                        "/crm/pendientes/inteligencia/expediente/" +
                        encodeURIComponent(item.id)
                      }
                      className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline"
                    >
                      Ver expediente e historial
                    </Link>
                  </article>
                ))}

                {data.cases.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No hay expedientes candidatos.
                  </p>
                )}
              </div>

            </section>

          </div>
        </section>
      )}

      {activeTab === "oportunidades" && (
        <CommercialOperationsDesk />
      )}

      {activeTab === "contactos" && (
        <section className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Identidades y contactos comerciales
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              Consultá las conversaciones y las coincidencias
              propuestas. Ninguna asociación se aprueba
              automáticamente.
            </p>
          </div>

          <OfflineHistoricalReview />
        </section>
      )}

      {activeTab === "supervisor" && (
        <section className="space-y-6">

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-semibold text-slate-900">
              Supervisor de inteligencia artificial
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              Revisiones comerciales basadas en conversaciones.
              Las decisiones permanecen deshabilitadas por seguridad.
            </p>
          </div>

          <SupervisorReviewPanel />

          <details className="rounded-xl border border-slate-200 bg-white p-5">
            <summary className="cursor-pointer font-semibold text-slate-900">
              Consultar análisis detallado del piloto
            </summary>

            <div className="mt-5">
              <OfflineSupervisorPilot />
            </div>
          </details>

        </section>
      )}

      {activeTab === "auditoria" && (
        <section className="space-y-6">

          <CommercialQualityNotice />

          <CommercialCoveragePanel />

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Registros y diagnóstico técnico
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              Los identificadores, asociaciones, observaciones
              y registros completos siguen disponibles.
            </p>

            <button
              type="button"
              onClick={() => setShowTechnical(value => !value)}
              className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              {showTechnical
                ? "Ocultar detalle técnico"
                : "Mostrar detalle técnico completo"}
            </button>
          </div>

        </section>
      )}


      {loading && (
        <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">
          Consultando memoria comercial...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}

          <p className="mt-2">
            No se muestran datos sin autorización
            y contexto empresarial válido.
          </p>
        </div>
      )}

      {activeTab === "auditoria" && showTechnical && data && (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Identidades reconocidas"
              value={data.overview.identities}
            />

            <Stat
              label="Expedientes candidatos"
              value={data.overview.cases}
            />

            <Stat
              label="Observaciones de IA"
              value={data.overview.observations}
            />

            <Stat
              label="Relaciones propuestas"
              value={data.overview.links}
            />

            <Stat
              label="Tareas registradas"
              value={data.overview.tasks}
            />

            <Stat
              label="Mensajes procesados por reglas"
              value={data.overview.receipts}
            />

            <Stat
              label="Relaciones entre operaciones y colaboradores"
              value={data.overview.partners}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-xl border bg-white p-6">
              <h2 className="text-xl font-semibold">
                Tareas comerciales pendientes
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Propuestas que requieren revisión.
                No se envían mensajes automáticamente.
              </p>

              <div className="mt-5 space-y-3">
                {data.tasks.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No hay tareas propuestas registradas.
                  </p>
                )}

                {data.tasks.map(task => (
                  <article
                    key={task.id}
                    className="rounded-lg border p-4"
                  >
                    <div className="font-medium text-slate-900">
                      {task.title}
                    </div>

                    <div className="mt-2 text-xs text-slate-500">
                      Prioridad: {task.priority}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      Estado: {task.status}
                    </div>

                    {task.case_id && (
                      <div className="mt-2 break-all text-xs text-slate-500">
                        Expediente: {task.case_id}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-xl border bg-white p-6">
              <h2 className="text-xl font-semibold">
                Expedientes detectados
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Candidatos comerciales; no equivalen
                a reservas confirmadas.
              </p>

              <div className="mt-5 space-y-3">
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
                      Fecha: {formatDate(item.event_date)}
                    </div>

                    <div className="mt-1 text-sm text-slate-600">
                      Estado: {item.state || "Sin clasificar"}
                    </div>

                    <div className="mt-2 break-all text-xs text-slate-400">
                      {item.id}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-xl border bg-white p-6">
              <h2 className="text-xl font-semibold">
                Asociaciones con el CRM
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Coincidencias detectadas que todavía
                no han sido aprobadas.
              </p>

              <div className="mt-5 max-h-[600px] space-y-3 overflow-y-auto">
                {data.links.map(link => (
                  <div
                    key={link.id}
                    className="rounded-lg border p-4"
                  >
                    <div className="font-medium">
                      {link.target_table}
                    </div>

                    <div className="mt-1 break-all text-xs text-slate-500">
                      Registro: {link.target_id}
                    </div>

                    <div className="mt-2 text-sm text-slate-600">
                      Coincidencia: {link.match_basis}
                    </div>

                    <div className="mt-1 text-sm text-slate-600">
                      Confianza:{" "}
                      {Math.round(link.confidence * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border bg-white p-6">
              <h2 className="text-xl font-semibold">
                Interpretaciones recientes
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Observaciones propuestas con referencia
                a los mensajes originales.
              </p>

              <div className="mt-5 max-h-[600px] space-y-3 overflow-y-auto">
                {data.observations.map(item => (
                  <article
                    key={item.id}
                    className="rounded-lg border p-4"
                  >
                    <div className="text-sm font-medium">
                      {item.observation?.commercial_move ||
                        "Información comercial"}
                    </div>

                    <div className="mt-2 text-xs text-slate-500">
                      Rol:{" "}
                      {item.observation?.actor_role ||
                        "No determinado"}
                    </div>

                    {item.observation?.evidence_quote && (
                      <p className="mt-3 border-l-2 border-slate-300 pl-3 text-sm text-slate-600">
                        {item.observation.evidence_quote}
                      </p>
                    )}

                    {item.observation?.recommended_action && (
                      <p className="mt-3 text-sm text-slate-700">
                        Acción sugerida:{" "}
                        {item.observation.recommended_action}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
