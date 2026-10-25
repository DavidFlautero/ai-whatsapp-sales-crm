"use client";

import { useMemo } from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventSLAHeatmap() {
  const { data } =
    useEventOperations();

  const cells =
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
          let score = 0;

          if (
            !item.assigned_provider_id
          ) {
            score += 35;
          }

          if (
            !item.responsible_team_member_id
          ) {
            score += 20;
          }

          if (
            item.contract_status
            === "pending"
          ) {
            score += 20;
          }

          if (
            Number(
              item.deposit_required
              ?? 0,
            )
            >
            Number(
              item.deposit_paid
              ?? 0,
            )
          ) {
            score += 25;
          }

          return {
            id:
              item.id
              ?? item.service_name
              ?? "service",
            name:
              item.service_name
              ?? "Servicio",
            score:
              Math.min(
                100,
                score,
              ),
          };
        })
        .sort(
          (a, b) =>
            b.score
            - a.score,
        );
    }, [data]);

  return (
    <section>
      <strong>
        SLA Heatmap
      </strong>

      {cells.map((cell) => (
        <div key={cell.id}>
          {cell.name}
          {" · "}
          {cell.score}
          /100
        </div>
      ))}
    </section>
  );
}
