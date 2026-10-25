"use client";

import { useMemo } from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventIncidentMatrix() {
  const { data } =
    useEventOperations();

  const incidents =
    useMemo(() => {
      return (
        data?.requirements
        ?? []
      )
        .filter(
          item =>
            item.service_status
            !== "cancelled",
        )
        .map((item) => {
          let probability =
            10;

          let impact =
            10;

          if (
            item.is_critical
          ) {
            impact += 50;
          }

          if (
            !item.assigned_provider_id
          ) {
            probability += 45;
          }

          if (
            !item.responsible_team_member_id
          ) {
            probability += 20;
          }

          if (
            item.contract_status
            === "pending"
          ) {
            probability += 15;
          }

          const exposure =
            Math.min(
              100,
              Math.round(
                probability
                * impact
                / 100,
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
            probability:
              Math.min(
                100,
                probability,
              ),
            impact:
              Math.min(
                100,
                impact,
              ),
            exposure,
          };
        })
        .sort(
          (a, b) =>
            b.exposure
            - a.exposure,
        );
    }, [data]);

  return (
    <section>
      <strong>
        Incident Matrix
      </strong>

      {incidents
        .slice(0, 10)
        .map((item) => (
          <div key={item.id}>
            <strong>
              {item.name}
            </strong>
            {" · P "}
            {item.probability}
            {" · I "}
            {item.impact}
            {" · exposición "}
            {item.exposure}
          </div>
        ))}
    </section>
  );
}
