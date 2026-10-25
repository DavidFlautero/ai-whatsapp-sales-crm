"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventChangeImpactPanel() {
  const {
    data,
  } =
    useEventOperations();

  const impacts =
    useMemo(
      () => {
        return (
          data?.requirements
          ?? []
        )
          .filter(
            item =>
              item.service_status
              !== "cancelled",
          )
          .map(
            item => {
              let impact =
                10;

              if (
                item.is_critical
              ) {
                impact +=
                  45;
              }

              if (
                item
                  .assigned_provider_id
              ) {
                impact +=
                  15;
              }

              if (
                item
                  .contract_status
                === "signed"
              ) {
                impact +=
                  10;
              }

              return {
                id:
                  item.id
                  ?? item.service_name
                  ?? "service",

                name:
                  item.service_name
                  ?? "Servicio",

                impact:
                  Math.min(
                    100,
                    impact,
                  ),
              };
            },
          )
          .sort(
            (
              left,
              right,
            ) =>
              right.impact
              - left.impact,
          );
      },
      [
        data,
      ],
    );

  return (
    <section>
      <strong>
        Change Impact
      </strong>

      {
        impacts
          .slice(
            0,
            8,
          )
          .map(
            item => (
              <div
                key={
                  item.id
                }
              >
                {
                  item.name
                }
                {" · impacto "}
                {
                  item.impact
                }
                /100
              </div>
            ),
          )
      }
    </section>
  );
}
