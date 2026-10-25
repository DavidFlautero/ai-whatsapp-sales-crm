"use client";

import { useEffect, useState } from "react";

type Fact = {
  kind: string;
  certainty_class: string;
  status: string;
  possible_conflict: boolean;
  evidence_message_ids: string[];
  review_reasons: string[];
  human_review_required: boolean;
};

type Task = {
  task_id: string;
  task_type: string;
  priority: string;
  status: string;
  evidence_message_ids: string[];
  human_review_required: boolean;
};

type Case = {
  contact_fingerprint: string;
  source_message_count: number;
  role_status: string;
  fact_count: number;
  possible_conflicting_kinds: string[];
  facts: Fact[];
  tasks: Task[];
  automatically_applied: boolean;
};

type Response = {
  ok: boolean;
  summary: {
    case_count: number;
    message_count: number;
    fact_count: number;
    text_anchored_facts: number;
    facts_requiring_review: number;
    cases_with_possible_conflicts: number;
    task_count: number;
    status: string;
    automatically_applied: boolean;
  };
  cases: Case[];
};

const taskLabels: Record<string, string> = {
  verify_commercial_role: "Verificar rol comercial",
  review_fact_evidence: "Comprobar evidencia",
  review_possible_fact_conflicts: "Revisar datos contradictorios",
  verify_followup_requirement: "Verificar seguimiento pendiente",
  verify_possible_opt_out: "Revisar solicitud de no contacto",
  review_commercial_summary: "Revisar resumen comercial",
};

const kindLabels: Record<string, string> = {
  event_date: "Fecha del evento",
  event_type: "Tipo de evento",
  guest_count: "Asistentes",
  budget: "Presupuesto",
  requested_service: "Servicio solicitado",
};

export default function OfflineSupervisorPilot() {
  const [data, setData] = useState<Response | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(false);

      try {
        const response = await fetch(
          "/api/crm/commercial-memory/offline-review/supervisor-pilot",
          {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("SUPERVISOR_HTTP_ERROR");
        }

        const result = (await response.json()) as Response;

        if (
          !result.ok ||
          result.summary.status !== "human_review_only" ||
          result.summary.automatically_applied !== false ||
          !Array.isArray(result.cases)
        ) {
          throw new Error("INVALID_SUPERVISOR_RESPONSE");
        }

        if (!controller.signal.aborted) {
          setData(result);
          setSelected(result.cases[0]?.contact_fingerprint ?? null);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, []);

  const current = data?.cases.find(
    item => item.contact_fingerprint === selected,
  );

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-slate-900">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">
          Supervisor comercial — Piloto de revisión
        </h3>

        <p className="mt-1 text-sm text-slate-600">
          Propuestas generadas a partir del historial. Los datos no
          han sido aprobados ni incorporados a las tareas operativas.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-slate-600">
          Cargando propuestas del piloto…
        </p>
      )}

      {error && (
        <p className="text-sm text-amber-800">
          No fue posible verificar los resultados del piloto.
          No se muestran propuestas sin validar.
        </p>
      )}

      {data && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Conversaciones", data.summary.case_count],
              ["Mensajes", data.summary.message_count],
              ["Hechos por revisar", data.summary.fact_count],
              ["Tareas propuestas", data.summary.task_count],
            ].map(([label, count]) => (
              <div
                key={label}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <p className="text-xs text-slate-600">{label}</p>
                <p className="text-xl font-semibold">{count}</p>
              </div>
            ))}
          </div>

          <p className="mb-4 text-sm text-slate-600">
            {data.summary.text_anchored_facts} hechos con
            coincidencia textual; {data.summary.facts_requiring_review}
            pendientes de corroboración de evidencia.
            Ninguno está confirmado automáticamente.
          </p>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
            <div className="space-y-2">
              {data.cases.map((item, index) => (
                <button
                  key={item.contact_fingerprint}
                  type="button"
                  onClick={() => setSelected(item.contact_fingerprint)}
                  className={`w-full rounded-lg border p-3 text-left text-sm ${
                    selected === item.contact_fingerprint
                      ? "border-blue-400 bg-blue-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <span className="block font-medium">
                    Expediente {index + 1}
                  </span>
                  <span className="block text-slate-600">
                    {item.source_message_count} mensajes ·{" "}
                    {item.tasks.length} revisiones
                  </span>
                </button>
              ))}
            </div>

            {current && (
              <div className="rounded-lg border border-slate-200 p-4">
                <h4 className="font-semibold">
                  Revisión del expediente
                </h4>

                <p className="mt-1 text-xs text-slate-500">
                  Referencia: {current.contact_fingerprint.slice(0, 12)}
                </p>

                <p className="mt-3 text-sm text-slate-700">
                  Rol comercial: pendiente de verificación.
                  Las referencias de mensajes pueden consultarse
                  en el expediente histórico del panel.
                </p>

                {current.possible_conflicting_kinds.length > 0 && (
                  <p className="mt-2 text-sm text-amber-800">
                    Existen posibles contradicciones en{" "}
                    {current.possible_conflicting_kinds.length} categorías.
                  </p>
                )}

                <h5 className="mt-5 font-semibold">
                  Tareas propuestas
                </h5>

                <div className="mt-2 space-y-2">
                  {current.tasks.map(task => (
                    <div
                      key={task.task_id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <p className="text-sm font-medium">
                        {taskLabels[task.task_type] ?? task.task_type}
                      </p>
                      <p className="text-xs text-slate-600">
                        Prioridad: {task.priority} · Pendiente
                        de revisión humana
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Mensajes referenciados:{" "}
                        {task.evidence_message_ids.length}
                      </p>
                    </div>
                  ))}
                </div>

                <h5 className="mt-5 font-semibold">
                  Hechos preliminares
                </h5>

                <div className="mt-2 space-y-2">
                  {current.facts.map((fact, index) => (
                    <div
                      key={`${fact.kind}-${index}`}
                      className="rounded-lg border border-slate-200 p-3"
                    >
                      <p className="text-sm font-medium">
                        {kindLabels[fact.kind] ?? fact.kind}
                      </p>
                      <p className="text-xs text-slate-600">
                        {fact.status === "text_anchor_found"
                          ? "Coincidencia textual localizada"
                          : "Evidencia por verificar"}
                        {fact.possible_conflict
                          ? " · Posible contradicción"
                          : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Referencias: {fact.evidence_message_ids.length}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-xs text-slate-500">
                  Vista de consulta. No envía mensajes ni actualiza
                  fichas, reservas o tareas operativas.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
