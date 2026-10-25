"use client";

import { useMemo } from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventRunbookPanel() {
  const { data } =
    useEventOperations();

  const runbook =
    useMemo(() => {
      const steps:
        string[] = [];

      steps.push(
        "Confirmar responsables operativos",
      );

      for (
        const item
        of data?.requirements ?? []
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
          !item.assigned_provider_id
        ) {
          steps.push(
            `Asignar proveedor: ${name}`,
          );
        }

        if (
          item.contract_status
          === "pending"
        ) {
          steps.push(
            `Cerrar contrato: ${name}`,
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
          steps.push(
            `Resolver anticipo: ${name}`,
          );
        }
      }

      steps.push(
        "Revisión final de readiness",
      );

      return steps;
    }, [data]);

  return (
    <section>
      <strong>
        Runbook operativo
      </strong>

      <ol>
        {runbook.map(
          (step) => (
            <li key={step}>
              {step}
            </li>
          ),
        )}
      </ol>
    </section>
  );
}
