"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventOperationalGate() {
  const {
    data,
  } =
    useEventOperations();

  const gate =
    useMemo(
      () => {
        const blockers:
          string[] =
            [];

        if (
          !data?.event
            ?.event_date
        ) {
          blockers.push(
            "Fecha del evento",
          );
        }

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

        for (
          const item
          of services
        ) {
          const name =
            item.service_name
            ?? "Servicio";

          if (
            item.is_critical
            && !item
              .assigned_provider_id
          ) {
            blockers.push(
              `${name}: proveedor`,
            );
          }

          if (
            item.is_critical
            && !item
              .responsible_team_member_id
          ) {
            blockers.push(
              `${name}: responsable`,
            );
          }

          if (
            item.is_critical
            && item
              .contract_status
            === "pending"
          ) {
            blockers.push(
              `${name}: contrato`,
            );
          }
        }

        return {
          ready:
            blockers.length
            === 0,
          blockers,
        };
      },
      [
        data,
      ],
    );

  return (
    <section>
      <strong>
        Operational Gate
      </strong>

      <h3>
        {
          gate.ready
            ? "GO"
            : "NO-GO"
        }
      </h3>

      {
        gate.blockers.map(
          blocker => (
            <div
              key={
                blocker
              }
            >
              Bloqueo:{" "}
              {blocker}
            </div>
          ),
        )
      }
    </section>
  );
}
