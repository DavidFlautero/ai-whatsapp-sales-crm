"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventProviderQueuePanel({
  eventId: _eventId,
}: {
  eventId: string;
}) {
  const {
    data,
  } =
    useEventOperations();

  const counters =
    useMemo(
      () => {
        const rows =
          data?.availability
          ?? [];

        return {
          requested:
            rows.filter(
              item =>
                item.status
                === "requested",
            ).length,

          available:
            rows.filter(
              item =>
                item.status
                === "available",
            ).length,

          tentative:
            rows.filter(
              item =>
                item.status
                === "tentative",
            ).length,

          reserved:
            rows.filter(
              item =>
                item.status
                === "reserved",
            ).length,

          unavailable:
            rows.filter(
              item =>
                item.status
                === "unavailable",
            ).length,
        };
      },
      [
        data,
      ],
    );

  return (
    <section>
      <strong>
        Disponibilidad de proveedores
      </strong>

      <div
        style={{
          display:
            "flex",
          flexWrap:
            "wrap",
          gap:
            12,
          marginTop:
            8,
        }}
      >
        <span>
          Esperando:{" "}
          <strong>
            {counters.requested}
          </strong>
        </span>

        <span>
          Disponibles:{" "}
          <strong>
            {counters.available}
          </strong>
        </span>

        <span>
          Tentativos:{" "}
          <strong>
            {counters.tentative}
          </strong>
        </span>

        <span>
          Reservados:{" "}
          <strong>
            {counters.reserved}
          </strong>
        </span>

        <span>
          No disponibles:{" "}
          <strong>
            {counters.unavailable}
          </strong>
        </span>
      </div>
    </section>
  );
}
