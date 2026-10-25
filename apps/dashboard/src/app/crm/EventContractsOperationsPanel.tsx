"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventContractsOperationsPanel({
  eventId: _eventId,
}: {
  eventId: string;
}) {
  const {
    data,
  } =
    useEventOperations();

  const summary =
    useMemo(
      () => {
        const rows =
          (
            data?.requirements
            ?? []
          )
            .filter(
              item =>
                item.service_status
                !== "cancelled",
            );

        const count =
          (
            status: string,
          ) =>
            rows.filter(
              item =>
                item.contract_status
                === status,
            ).length;

        return {
          pending:
            count("pending"),
          generated:
            count("generated"),
          sent:
            count("sent"),
          signed:
            count("signed"),
          notRequired:
            count("not_required"),

          pendingItems:
            rows.filter(
              item =>
                item.contract_status
                === "pending",
            ),
        };
      },
      [
        data,
      ],
    );

  return (
    <section>
      <strong>
        Contratos
      </strong>

      <div
        style={{
          display:
            "flex",
          flexWrap:
            "wrap",
          gap:
            10,
          marginTop:
            8,
        }}
      >
        <span>
          Pendientes:{" "}
          <strong>
            {summary.pending}
          </strong>
        </span>

        <span>
          Generados:{" "}
          <strong>
            {summary.generated}
          </strong>
        </span>

        <span>
          Enviados:{" "}
          <strong>
            {summary.sent}
          </strong>
        </span>

        <span>
          Firmados:{" "}
          <strong>
            {summary.signed}
          </strong>
        </span>
      </div>

      {summary.pendingItems
        .slice(0, 8)
        .map(
          (
            item,
            index,
          ) => (
            <div
              key={
                item.id
                ?? index
              }
            >
              {
                item.service_name
                ?? "Servicio"
              }
              {" · pendiente"}
            </div>
          ),
        )}
    </section>
  );
}
