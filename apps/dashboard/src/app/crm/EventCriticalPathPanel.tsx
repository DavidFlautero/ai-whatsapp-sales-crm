"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventCriticalPathPanel() {
  const {
    data,
  } =
    useEventOperations();

  const path =
    useMemo(
      () => {
        return (
          data
            ?.requirements
          ?? []
        )
          .filter(
            item =>
              item.service_status
              !== "cancelled",
          )
          .map(
            item => {
              let pressure =
                0;

              const blockers:
                string[] =
                  [];

              if (
                item.is_critical
              ) {
                pressure += 30;
              }

              if (
                !item
                  .assigned_provider_id
              ) {
                pressure += 30;

                blockers.push(
                  "Sin proveedor",
                );
              }

              if (
                !item
                  .responsible_team_member_id
              ) {
                pressure += 15;

                blockers.push(
                  "Sin responsable",
                );
              }

              if (
                item
                  .contract_status
                === "pending"
              ) {
                pressure += 15;

                blockers.push(
                  "Contrato",
                );
              }

              if (
                [
                  "pending",
                  "searching",
                ].includes(
                  item
                    .service_status
                  ?? "",
                )
              ) {
                pressure += 10;
              }

              return {
                id:
                  item.id
                  ?? item.service_name
                  ?? "service",

                name:
                  item.service_name
                  ?? "Servicio",

                pressure:
                  Math.min(
                    100,
                    pressure,
                  ),

                blockers,
              };
            },
          )
          .filter(
            item =>
              item.pressure
              > 0,
          )
          .sort(
            (
              left,
              right,
            ) =>
              right.pressure
              - left.pressure,
          );
      },
      [
        data,
      ],
    );

  return (
    <section>
      <strong>
        Ruta crítica operativa
      </strong>

      <div
        style={{
          display:
            "grid",
          gap:
            9,
          marginTop:
            10,
        }}
      >
        {
          path
            .slice(
              0,
              10,
            )
            .map(
              item => (
                <article
                  key={
                    item.id
                  }
                >
                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                    }}
                  >
                    <strong>
                      {
                        item.name
                      }
                    </strong>

                    <span>
                      {
                        item.pressure
                      }
                      %
                    </span>
                  </div>

                  <small>
                    {
                      item.blockers
                        .join(
                          " · ",
                        )
                      || "Seguimiento"
                    }
                  </small>
                </article>
              ),
            )
        }

        {
          !path.length
            ? (
              <span>
                Ruta crítica sin bloqueos detectados.
              </span>
            )
            : null
        }
      </div>
    </section>
  );
}
