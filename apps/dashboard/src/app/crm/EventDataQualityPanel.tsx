"use client";

import { useMemo } from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventDataQualityPanel() {
  const { data } =
    useEventOperations();

  const audit =
    useMemo(() => {
      const issues:
        string[] = [];

      const event =
        data?.event;

      if (!event?.event_date) {
        issues.push(
          "Evento sin fecha",
        );
      }

      if (
        !Number(
          event?.guest_count ?? 0,
        )
      ) {
        issues.push(
          "Cantidad de invitados ausente",
        );
      }

      if (!event?.city) {
        issues.push(
          "Ciudad no informada",
        );
      }

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

        if (!item.service_name) {
          issues.push(
            "Servicio sin nombre",
          );
        }

        if (
          !item.assigned_provider_id
        ) {
          issues.push(
            `${name}: proveedor vacío`,
          );
        }

        if (
          item.provider_cost == null
        ) {
          issues.push(
            `${name}: coste sin cargar`,
          );
        }

        if (
          item.client_price == null
        ) {
          issues.push(
            `${name}: precio cliente vacío`,
          );
        }

        if (
          !item.service_status
        ) {
          issues.push(
            `${name}: estado vacío`,
          );
        }
      }

      const totalChecks =
        3
        + (
          data?.requirements
            ?.length
          ?? 0
        )
        * 5;

      const quality =
        totalChecks > 0
          ? Math.max(
              0,
              Math.round(
                (
                  1
                  - issues.length
                    / totalChecks
                )
                * 100,
              ),
            )
          : 100;

      return {
        quality,
        issues,
      };
    }, [data]);

  return (
    <section>
      <strong>
        Data Quality
      </strong>

      <h3>
        {audit.quality}%
      </h3>

      <div
        style={{
          display: "grid",
          gap: 5,
        }}
      >
        {audit.issues
          .slice(0, 12)
          .map((issue) => (
            <div key={issue}>
              {issue}
            </div>
          ))}

        {!audit.issues.length ? (
          <span>
            Datos operativos completos.
          </span>
        ) : null}
      </div>
    </section>
  );
}
