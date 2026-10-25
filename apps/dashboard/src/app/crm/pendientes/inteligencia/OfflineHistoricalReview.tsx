"use client";

import LinkedContactIdentity from "./LinkedContactIdentity";


import { useCallback, useEffect, useMemo, useState } from "react";

type ContactSummary = {
  fingerprint: string;
  initial_role: string;
  second_pass_role: string;
  message_count: number;
  evidence_count: number;
  last_activity: string;
  last_direction: string;
  review_candidate: boolean;
  requires_human_review: boolean;
};

type Overview = {
  ok: true;
  status: string;
  totals: {
    contacts: number;
    messages: number;
    review_candidates: number;
    historical_unmatched: number;
  };
  contacts: ContactSummary[];
};

type Evidence = {
  kind: string;
  value: string;
  message_id: string;
  occurred_at: string;
  excerpt: string;
  status: string;
};

type ContextMessage = {
  message_id: string;
  direction: string;
  occurred_at: string;
  excerpt: string;
};

type Detail = ContactSummary & {
  evidence: Evidence[];
  recent_context: ContextMessage[];
  automatically_applied: boolean;
};

const endpoint =
  "/api/crm/commercial-memory/offline-review";

async function readJSON<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`REVISION_HTTP_${response.status}`);
  }

  return response.json() as Promise<T>;
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    owner: "Propietario",
    provider: "Proveedor",
    client: "Cliente",
    mixed: "Varios roles",
    review_conflict: "Rol por revisar",
    review: "Rol por revisar",
    unclassified: "Sin clasificar",
    unknown: "Sin clasificar",
  };

  return labels[role] ?? "Sin clasificar";
}

export default function OfflineHistoricalReview() {
  const [overview, setOverview] =
    useState<Overview | null>(null);

  const [selected, setSelected] =
    useState<Detail | null>(null);

  const [search, setSearch] = useState("");
  const [onlyReview, setOnlyReview] =
    useState(false);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await readJSON<Overview>(endpoint);
      setOverview(data);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo cargar la revisión histórica",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visible = useMemo(() => {
    if (!overview) return [];

    const query = search.trim().toLowerCase();

    return overview.contacts.filter(contact => {
      if (onlyReview && !contact.review_candidate) {
        return false;
      }

      if (!query) return true;

      return (
        contact.fingerprint.toLowerCase().includes(query) ||
        roleLabel(contact.second_pass_role)
          .toLowerCase()
          .includes(query)
      );
    });
  }, [overview, search, onlyReview]);

  async function openContact(fingerprint: string) {
    setDetailLoading(true);
    setSelected(null);
    setError(null);

    try {
      const result = await readJSON<{
        ok: true;
        contact: Detail;
      }>(
        `${endpoint}/contacts/${fingerprint}`,
      );

      setSelected(result.contact);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo cargar el expediente",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Revisión inteligente de contactos
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          Expedientes históricos de WhatsApp. Las propuestas son
          orientativas, requieren revisión humana y no modifican
          automáticamente el CRM.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">
          Cargando inteligencia histórica…
        </p>
      ) : !overview ? (
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Reintentar
        </button>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Contactos", overview.totals.contacts],
              ["Mensajes", overview.totals.messages],
              ["Para revisar", overview.totals.review_candidates],
              ["IDs por investigar", overview.totals.historical_unmatched],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="text-xs text-slate-500">
                  {label}
                </div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar identificador o rol"
              aria-label="Buscar contactos históricos"
              className="min-w-56 flex-1 rounded-lg border border-slate-300 p-3 text-sm text-slate-900"
            />

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={onlyReview}
                onChange={event => setOnlyReview(event.target.checked)}
              />
              Solo pendientes de revisión
            </label>

            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-700"
            >
              Actualizar
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.6fr)]">
            <div className="max-h-[650px] space-y-2 overflow-y-auto">
              {visible.map(contact => (
                <button
                  key={contact.fingerprint}
                  type="button"
                  onClick={() => void openContact(contact.fingerprint)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-slate-400"
                >
                  <div className="font-medium text-slate-900">
                    Contacto {contact.fingerprint.slice(0, 12)}
                  </div>

                  <div className="mt-1 text-xs text-slate-600">
                    {roleLabel(contact.second_pass_role)}
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    {contact.message_count} mensajes ·{" "}
                    {contact.evidence_count} evidencias
                  </div>

                  {contact.review_candidate && (
                    <div className="mt-2 text-xs font-medium text-amber-700">
                      Revisión recomendada
                    </div>
                  )}
                </button>
              ))}

              {visible.length === 0 && (
                <p className="p-4 text-sm text-slate-500">
                  No hay contactos que coincidan con el filtro.
                </p>
              )}
            </div>

            <div className="min-h-80 rounded-xl border border-slate-200 p-4">
              {detailLoading ? (
                <p className="text-sm text-slate-500">
                  Cargando expediente…
                </p>
              ) : !selected ? (
                <p className="text-sm text-slate-500">
                  Seleccioná un contacto para consultar sus evidencias
                  y el contexto de sus mensajes.
                </p>
              ) : (
                <div className="space-y-5">
                  <LinkedContactIdentity fingerprint={selected.fingerprint} />
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Expediente {selected.fingerprint.slice(0, 12)}
                    </h3>

                    <p className="mt-1 text-sm text-slate-600">
                      Rol propuesto:{" "}
                      {roleLabel(selected.second_pass_role)}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Sin actualización automática de contactos.
                    </p>
                  </div>

                  <div>
                    <h4 className="mb-2 font-semibold text-slate-900">
                      Evidencias detectadas ({selected.evidence.length})
                    </h4>

                    <div className="max-h-96 space-y-2 overflow-y-auto">
                      {selected.evidence.map((item, index) => (
                        <div
                          key={`${item.message_id}-${item.kind}-${index}`}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="text-xs font-semibold text-slate-700">
                            {item.kind}: {item.value}
                          </div>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-800">
                            {item.excerpt}
                          </p>
                          <p className="mt-2 break-all text-xs text-slate-500">
                            Mensaje: {item.message_id}
                          </p>
                        </div>
                      ))}

                      {selected.evidence.length === 0 && (
                        <p className="text-sm text-slate-500">
                          Todavía no hay evidencias estructuradas.
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 font-semibold text-slate-900">
                      Contexto reciente
                    </h4>

                    <div className="max-h-96 space-y-2 overflow-y-auto">
                      {selected.recent_context.map((item, index) => (
                        <div
                          key={`${item.message_id}-${index}`}
                          className="rounded-lg border border-slate-200 p-3"
                        >
                          <p className="text-xs text-slate-500">
                            {item.direction === "inbound"
                              ? "Contacto"
                              : "Empresa"}{" "}
                            · {item.occurred_at?.slice(0, 16)}
                          </p>

                          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-800">
                            {item.excerpt || "Mensaje sin texto"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
