"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventAutoChecklist() {
  const {
    data,
  } =
    useEventOperations();

  const checklist =
    useMemo(
      () => {
        const requirements =
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

        const required =
          [
            {
              id:
                "date",
              label:
                "Fecha confirmada",
              done:
                Boolean(
                  data?.event
                    ?.event_date,
                ),
            },
            {
              id:
                "guests",
              label:
                "Número de invitados",
              done:
                Number(
                  data?.event
                    ?.guest_count
                  ?? 0,
                ) > 0,
            },
            {
              id:
                "providers",
              label:
                "Todos los servicios con proveedor",
              done:
                requirements.every(
                  item =>
                    Boolean(
                      item
                        .assigned_provider_id,
                    ),
                ),
            },
            {
              id:
                "owners",
              label:
                "Todos los servicios con responsable",
              done:
                requirements.every(
                  item =>
                    Boolean(
                      item
                        .responsible_team_member_id,
                    ),
                ),
            },
            {
              id:
                "critical",
              label:
                "Servicios críticos cerrados",
              done:
                requirements
                  .filter(
                    item =>
                      item.is_critical,
                  )
                  .every(
                    item =>
                      [
                        "confirmed",
                        "completed",
                      ].includes(
                        item
                          .service_status
                        ?? "",
                      ),
                  ),
            },
            {
              id:
                "contracts",
              label:
                "Contratos resueltos",
              done:
                requirements.every(
                  item =>
                    ![
                      "pending",
                      "",
                    ].includes(
                      item
                        .contract_status
                      ?? "",
                    ),
                ),
            },
            {
              id:
                "payments",
              label:
                "Anticipos al día",
              done:
                requirements.every(
                  item =>
                    Number(
                      item
                        .deposit_paid
                      ?? 0,
                    )
                    >= Number(
                      item
                        .deposit_required
                      ?? 0,
                    ),
                ),
            },
          ];

        const completed =
          required.filter(
            item =>
              item.done,
          ).length;

        return {
          items:
            required,
          completed,
          total:
            required.length,
          percent:
            required.length
              ? Math.round(
                  (
                    completed
                    / required.length
                  )
                  * 100,
                )
              : 100,
        };
      },
      [
        data,
      ],
    );

  return (
    <section>
      <strong>
        Checklist automático
      </strong>

      <div>
        {
          checklist.percent
        }
        % completado
      </div>

      <div
        style={{
          display:
            "grid",
          gap:
            6,
          marginTop:
            8,
        }}
      >
        {
          checklist.items.map(
            item => (
              <div
                key={
                  item.id
                }
              >
                {
                  item.done
                    ? "✓"
                    : "○"
                }
                {" "}
                {
                  item.label
                }
              </div>
            ),
          )
        }
      </div>
    </section>
  );
}
