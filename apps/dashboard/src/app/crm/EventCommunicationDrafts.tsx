"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventCommunicationDrafts() {
  const {
    data,
  } =
    useEventOperations();

  const [
    copied,
    setCopied,
  ] =
    useState<
      string
      | null
    >(null);

  const drafts =
    useMemo(
      () => {
        const title =
          data?.event
            ?.title
          ?? data?.event
            ?.event_type
          ?? "evento";

        const date =
          data?.event
            ?.event_date
            ?.slice(
              0,
              10,
            )
          ?? "fecha por confirmar";

        const services =
          (
            data
              ?.requirements
            ?? []
          )
            .filter(
              item =>
                item.service_status
                !== "cancelled",
            );

        const withoutProvider =
          services
            .filter(
              item =>
                !item
                  .assigned_provider_id,
            )
            .map(
              item =>
                item.service_name
                ?? "Servicio",
            );

        const pendingContracts =
          services
            .filter(
              item =>
                item.contract_status
                === "pending",
            )
            .map(
              item =>
                item.service_name
                ?? "Servicio",
            );

        return [
          {
            id:
              "internal",

            label:
              "Resumen interno",

            text:
              `Evento: ${title}\nFecha: ${date}\nServicios sin proveedor: ${withoutProvider.join(", ") || "ninguno"}\nContratos pendientes: ${pendingContracts.join(", ") || "ninguno"}.`,
          },

          {
            id:
              "client",

            label:
              "Seguimiento cliente",

            text:
              `Hola. Estamos revisando la planificación de ${title} para ${date}. La coordinación continúa activa y estamos cerrando los puntos operativos pendientes.`,
          },

          {
            id:
              "provider",

            label:
              "Seguimiento proveedor",

            text:
              `Hola. Estamos cerrando disponibilidad para ${title}, previsto para ${date}. Necesitamos confirmar disponibilidad y condiciones del servicio.`,
          },
        ];
      },
      [
        data,
      ],
    );

  async function copy(
    id: string,
    text: string,
  ) {
    await navigator
      .clipboard
      .writeText(
        text,
      );

    setCopied(
      id,
    );

    window.setTimeout(
      () =>
        setCopied(
          null,
        ),
      1500,
    );
  }

  return (
    <section>
      <strong>
        Communication Drafts
      </strong>

      <div
        style={{
          display:
            "grid",
          gap:
            10,
          marginTop:
            10,
        }}
      >
        {
          drafts.map(
            draft => (
              <article
                key={
                  draft.id
                }
              >
                <strong>
                  {
                    draft.label
                  }
                </strong>

                <pre
                  style={{
                    whiteSpace:
                      "pre-wrap",
                  }}
                >
                  {
                    draft.text
                  }
                </pre>

                <button
                  type="button"
                  onClick={() => {
                    void copy(
                      draft.id,
                      draft.text,
                    );
                  }}
                >
                  {
                    copied
                    === draft.id
                      ? "Copiado"
                      : "Copiar"
                  }
                </button>
              </article>
            ),
          )
        }
      </div>
    </section>
  );
}
