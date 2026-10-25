"use client";

import { useMemo } from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventDependencyGraph() {
  const { data } =
    useEventOperations();

  const graph =
    useMemo(() => {
      const services =
        (
          data?.requirements
          ?? []
        ).filter(
          item =>
            item.service_status
            !== "cancelled",
        );

      return services.map(
        (item) => {
          const dependencies:
            string[] = [];

          if (
            !item.assigned_provider_id
          ) {
            dependencies.push(
              "Proveedor",
            );
          }

          if (
            !item.responsible_team_member_id
          ) {
            dependencies.push(
              "Responsable",
            );
          }

          if (
            item.contract_status
            === "pending"
          ) {
            dependencies.push(
              "Contrato",
            );
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
            dependencies.push(
              "Pago",
            );
          }

          return {
            id:
              item.id
              ?? item.service_name
              ?? "service",
            name:
              item.service_name
              ?? "Servicio",
            dependencies,
          };
        },
      );
    }, [data]);

  return (
    <section>
      <strong>
        Dependency Graph
      </strong>

      {graph.map((node) => (
        <div key={node.id}>
          <strong>
            {node.name}
          </strong>
          {" → "}
          {node.dependencies.length
            ? node.dependencies.join(
                " → ",
              )
            : "READY"}
        </div>
      ))}
    </section>
  );
}
