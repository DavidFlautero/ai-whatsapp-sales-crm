"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventOperationalTimeline({
  eventId: _eventId,
}: {
  eventId: string;
}) {
  const {
    data,
  } =
    useEventOperations();

  const items =
    useMemo(
      () =>
        (
          data?.requirements
          ?? []
        )
          .filter(
            item =>
              item.service_status
                !== "cancelled",
          )
          .map(
            item => ({
              id:
                item.id
                ?? `${item.service_name ?? "service"}-${item.arrival_time ?? item.setup_time ?? "time"}`,

              title:
                item.service_name
                ?? "Servicio",

              time:
                item.arrival_time
                ?? item.setup_time
                ?? "Sin horario",

              provider:
                item
                  .assigned_provider_id
                  ? "Proveedor asignado"
                  : "Sin proveedor",

              status:
                item.service_status
                ?? "pending",

              critical:
                Boolean(
                  item.is_critical,
                ),
            }),
          )
          .sort(
            (
              left,
              right,
            ) =>
              left.time
                .localeCompare(
                  right.time,
                ),
          ),
      [
        data,
      ],
    );

  return (
    <section>
      <strong>
        Timeline operativo
      </strong>

      <div
        style={{
          display:
            "grid",
          gap:
            8,
          marginTop:
            10,
        }}
      >
        {items.map(
          item => (
            <article
              key={item.id}
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "90px 1fr auto",
                gap:
                  12,
              }}
            >
              <strong>
                {item.time}
              </strong>

              <div>
                <strong>
                  {item.critical
                    ? "⚠ "
                    : ""}
                  {item.title}
                </strong>

                <small
                  style={{
                    display:
                      "block",
                  }}
                >
                  {item.provider}
                </small>
              </div>

              <span>
                {item.status}
              </span>
            </article>
          ),
        )}
      </div>
    </section>
  );
}
