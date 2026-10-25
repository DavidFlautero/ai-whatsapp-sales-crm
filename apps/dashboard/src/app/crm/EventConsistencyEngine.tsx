"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventConsistencyEngine() {
  const {
    data,
  } =
    useEventOperations();

  const issues =
    useMemo(
      () => {
        const result:
          string[] =
            [];

        for (
          const item
          of data?.requirements
          ?? []
        ) {
          const name =
            item.service_name
            ?? "Servicio";

          if (
            item.service_status
            === "confirmed"
            && !item
              .assigned_provider_id
          ) {
            result.push(
              `${name}: confirmado sin proveedor.`,
            );
          }

          if (
            item.service_status
            === "completed"
            && !item
              .assigned_provider_id
          ) {
            result.push(
              `${name}: completado sin proveedor registrado.`,
            );
          }

          if (
            item.contract_status
            === "signed"
            && !item
              .assigned_provider_id
          ) {
            result.push(
              `${name}: contrato firmado sin proveedor.`,
            );
          }

          if (
            Number(
              item.deposit_paid
              ?? 0,
            )
            >
            Number(
              item.deposit_required
              ?? 0,
            )
            && Number(
              item.deposit_required
              ?? 0,
            )
            > 0
          ) {
            result.push(
              `${name}: pago superior al anticipo requerido.`,
            );
          }
        }

        return result;
      },
      [
        data,
      ],
    );

  return (
    <section>
      <strong>
        Consistency Engine
      </strong>

      {
        issues.map(
          issue => (
            <div
              key={
                issue
              }
            >
              ⚠ {issue}
            </div>
          ),
        )
      }

      {
        !issues.length
          ? (
            <span>
              Estados internamente consistentes.
            </span>
          )
          : null
      }
    </section>
  );
}
