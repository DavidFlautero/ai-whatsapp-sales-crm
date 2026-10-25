"use client";

import { useMemo } from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventPremortemPanel() {
  const { data } =
    useEventOperations();

  const failures =
    useMemo(() => {
      const result:
        string[] = [];

      for (
        const item
        of data?.requirements ?? []
      ) {
        const name =
          item.service_name
          ?? "Servicio";

        if (
          item.is_critical
          && !item.assigned_provider_id
        ) {
          result.push(
            `${name}: podría fallar por ausencia de proveedor`,
          );
        }

        if (
          item.contract_status
          === "pending"
        ) {
          result.push(
            `${name}: riesgo contractual`,
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
          result.push(
            `${name}: riesgo por anticipo pendiente`,
          );
        }
      }

      return result;
    }, [data]);

  return (
    <section>
      <strong>
        Pre-Mortem
      </strong>

      <p>
        Si el evento fallara,
        las causas más plausibles
        hoy serían:
      </p>

      {failures
        .slice(0, 10)
        .map((failure, index) => (
          <div key={failure}>
            {index + 1}.{" "}
            {failure}
          </div>
        ))}

      {!failures.length ? (
        <span>
          No se detectan fallos previsibles graves.
        </span>
      ) : null}
    </section>
  );
}
