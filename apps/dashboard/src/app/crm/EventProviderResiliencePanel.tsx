"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventProviderResiliencePanel() {
  const {
    data,
  } =
    useEventOperations();

  const result =
    useMemo(
      () => {
        const availability =
          data?.availability
          ?? [];

        const requirements =
          (
            data?.requirements
            ?? []
          )
            .filter(
              item =>
                item.service_status
                !== "cancelled",
            );

        const byRequirement =
          new Map<
            string,
            {
              available: number;
              tentative: number;
              requested: number;
              reserved: number;
              unavailable: number;
            }
          >();

        for (
          const item
          of availability
        ) {
          const requirementId =
            String(
              item.requirement_id
              ?? "",
            );

          if (
            !requirementId
          ) {
            continue;
          }

          const current =
            byRequirement.get(
              requirementId,
            )
            ?? {
              available:
                0,
              tentative:
                0,
              requested:
                0,
              reserved:
                0,
              unavailable:
                0,
            };

          switch (
            item.status
          ) {
            case "available":
              current.available +=
                1;
              break;

            case "tentative":
              current.tentative +=
                1;
              break;

            case "requested":
              current.requested +=
                1;
              break;

            case "reserved":
              current.reserved +=
                1;
              break;

            case "unavailable":
              current.unavailable +=
                1;
              break;
          }

          byRequirement.set(
            requirementId,
            current,
          );
        }

        return requirements
          .map(
            item => {
              const stats =
                byRequirement.get(
                  String(
                    item.id
                    ?? "",
                  ),
                )
                ?? {
                  available:
                    0,
                  tentative:
                    0,
                  requested:
                    0,
                  reserved:
                    0,
                  unavailable:
                    0,
                };

              let resilience =
                0;

              if (
                item.assigned_provider_id
              ) {
                resilience +=
                  45;
              }

              resilience +=
                Math.min(
                  30,
                  stats.available
                  * 15,
                );

              resilience +=
                Math.min(
                  10,
                  stats.tentative
                  * 5,
                );

              resilience +=
                Math.min(
                  8,
                  stats.requested
                  * 2,
                );

              resilience +=
                Math.min(
                  7,
                  stats.reserved
                  * 7,
                );

              resilience -=
                Math.min(
                  20,
                  stats.unavailable
                  * 5,
                );

              resilience =
                Math.max(
                  0,
                  Math.min(
                    100,
                    resilience,
                  ),
                );

              return {
                id:
                  item.id
                  ?? item.service_name
                  ?? "service",

                name:
                  item.service_name
                  ?? "Servicio",

                resilience,

                ...stats,
              };
            },
          )
          .sort(
            (
              left,
              right,
            ) =>
              left.resilience
              - right.resilience,
          );
      },
      [
        data,
      ],
    );

  return (
    <section>
      <strong>
        Resiliencia de proveedores
      </strong>

      <div
        style={{
          display:
            "grid",
          gap:
            8,
          marginTop:
            10,
        }}
      >
        {
          result
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
                      gap:
                        12,
                    }}
                  >
                    <strong>
                      {
                        item.name
                      }
                    </strong>

                    <span>
                      {
                        item.resilience
                      }
                      %
                    </span>
                  </div>

                  <small>
                    {
                      item.available
                    }
                    {" disponibles · "}
                    {
                      item.tentative
                    }
                    {" tentativos · "}
                    {
                      item.requested
                    }
                    {" esperando · "}
                    {
                      item.reserved
                    }
                    {" reservados"}
                  </small>
                </article>
              ),
            )
        }

        {
          !result.length
            ? (
              <span>
                Sin servicios para analizar.
              </span>
            )
            : null
        }
      </div>
    </section>
  );
}
