"use client";

import { useMemo } from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventClosureCockpit() {
  const { data } =
    useEventOperations();

  const result =
    useMemo(() => {
      const services =
        (
          data?.requirements
          ?? []
        )
          .filter(
            item =>
              item.service_status
              !== "cancelled",
          );

      const completed =
        services.filter(
          item =>
            item.service_status
            === "completed",
        ).length;

      const paymentsClosed =
        services.filter(
          item =>
            Number(
              item.deposit_paid
              ?? 0,
            )
            >=
            Number(
              item.deposit_required
              ?? 0,
            ),
        ).length;

      const contractsClosed =
        services.filter(
          item =>
            [
              "signed",
              "not_required",
            ].includes(
              item.contract_status
              ?? "",
            ),
        ).length;

      return {
        total:
          services.length,
        completed,
        paymentsClosed,
        contractsClosed,
        ready:
          services.length > 0
          && completed
            === services.length
          && paymentsClosed
            === services.length,
      };
    }, [data]);

  return (
    <section>
      <strong>
        Closure Cockpit
      </strong>

      <div>
        Servicios terminados:
        {" "}
        {result.completed}
        /
        {result.total}
      </div>

      <div>
        Pagos cerrados:
        {" "}
        {result.paymentsClosed}
        /
        {result.total}
      </div>

      <div>
        Contratos cerrados:
        {" "}
        {result.contractsClosed}
        /
        {result.total}
      </div>

      <div>
        Estado:
        {" "}
        <strong>
          {result.ready
            ? "LISTO PARA CIERRE"
            : "CIERRE BLOQUEADO"}
        </strong>
      </div>
    </section>
  );
}
