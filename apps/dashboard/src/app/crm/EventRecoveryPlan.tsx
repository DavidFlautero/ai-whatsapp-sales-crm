"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventRecoveryPlan() {
  const {
    data,
  } =
    useEventOperations();

  const plan =
    useMemo(
      () => {
        const steps:
          string[] =
            [];

        for (
          const item
          of data?.requirements
          ?? []
        ) {
          if (
            item.service_status
            === "cancelled"
          ) {
            continue;
          }

          const name =
            item.service_name
            ?? "Servicio";

          if (
            item.is_critical
            && !item
              .assigned_provider_id
          ) {
            steps.push(
              `Activar proveedor alternativo para ${name}.`,
            );
          }

          if (
            item.is_critical
            && !item
              .responsible_team_member_id
          ) {
            steps.push(
              `Asignar responsable de contingencia para ${name}.`,
            );
          }
        }

        if (
          !steps.length
        ) {
          steps.push(
            "Mantener contactos alternativos de proveedores disponibles.",
          );

          steps.push(
            "Confirmar canal interno de escalación.",
          );
        }

        return steps;
      },
      [
        data,
      ],
    );

  return (
    <section>
      <strong>
        Recovery Plan
      </strong>

      <ol>
        {
          plan.map(
            step => (
              <li
                key={
                  step
                }
              >
                {step}
              </li>
            ),
          )
        }
      </ol>
    </section>
  );
}
