"use client";

import { useEffect, useState } from "react";

type OfficialIdentity = {
  status: string;
  automatically_applied: boolean;
  contact: {
    id: string;
    name: string;
    business_name: string;
    phone_last_four: string | null;
    status: string;
    archived: boolean;
  } | null;
  memory_identity: {
    id: string;
    display_name: string;
    phone_last_four: string | null;
    identity_status: string;
  } | null;
  evidence?: {
    exact_internal_id: boolean;
    source_phone_matches_both: boolean;
    current_records_checked: boolean;
  };
};

export default function LinkedContactIdentity({
  fingerprint,
}: {
  fingerprint: string;
}) {
  const [data, setData] =
    useState<OfficialIdentity | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        const response = await fetch(
          `/api/crm/commercial-memory/offline-review/contacts/${fingerprint}/identity`,
          {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(
            `IDENTITY_HTTP_${response.status}`,
          );
        }

        const result = await response.json() as {
          ok: boolean;
          identity: OfficialIdentity;
        };

        if (!result.ok || !result.identity) {
          throw new Error("INVALID_IDENTITY_RESPONSE");
        }

        if (!controller.signal.aborted) {
          setData(result.identity);
        }

      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "IDENTITY_READ_UNAVAILABLE",
          );
        }

      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [fingerprint]);

  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <h4 className="font-semibold text-slate-900">
        Identidad oficial del CRM
      </h4>

      {loading && (
        <p className="mt-2 text-sm text-slate-600">
          Consultando ficha oficial…
        </p>
      )}

      {error && (
        <p className="mt-2 text-sm text-amber-800">
          No se pudo verificar la identidad actual.
          El expediente histórico sigue disponible.
        </p>
      )}

      {data?.status === "requires_review" && (
        <p className="mt-2 text-sm text-amber-800">
          La identidad requiere revisión adicional.
          No se mostrará como una vinculación confirmada.
        </p>
      )}

      {data?.status === "candidate_not_approved" &&
        data.contact &&
        data.memory_identity && (
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-xs text-slate-500">
                Nombre en el CRM
              </p>

              <p className="font-medium text-slate-900">
                {data.contact.name || "Sin nombre"}
              </p>

              {data.contact.business_name && (
                <p className="text-sm text-slate-700">
                  {data.contact.business_name}
                </p>
              )}
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Identidad histórica
              </p>

              <p className="text-sm text-slate-800">
                {data.memory_identity.display_name ||
                  "Sin nombre histórico"}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-slate-600">
              <span>
                Teléfono CRM: ***{data.contact.phone_last_four ?? "----"}
              </span>

              <span>
                Teléfono histórico: ***
                {data.memory_identity.phone_last_four ?? "----"}
              </span>
            </div>

            {data.contact.archived && (
              <p className="text-sm font-medium text-amber-800">
                Atención: contacto archivado.
              </p>
            )}

            <p className="text-xs text-slate-600">
              Identificador y teléfonos corroborados.
              Vinculación propuesta, todavía no aprobada.
              No se modificó ninguna ficha.
            </p>
          </div>
        )}
    </section>
  );
}
