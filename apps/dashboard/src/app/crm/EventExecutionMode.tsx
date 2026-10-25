"use client";

import { useMemo } from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventExecutionMode() {
  const { data } =
    useEventOperations();

  const timeline =
    useMemo(() => {
      return (
        data?.requirements
        ?? []
      )
        .filter(
          item =>
            item.service_status
            !== "cancelled",
        )
        .map((item) => ({
          id:
            item.id
            ?? item.service_name
            ?? "service",

          name:
            item.service_name
            ?? "Servicio",

          time:
            item.arrival_time
            ?? item.setup_time
            ?? "99:99",

          status:
            item.service_status
            ?? "pending",

          critical:
            Boolean(
              item.is_critical,
            ),
        }))
        .sort(
          (a, b) =>
            a.time.localeCompare(
              b.time,
            ),
        );
    }, [data]);

  return (
    <section>
      <strong>
        Execution Mode
      </strong>

      <div
        style={{
          display: "grid",
          gap: 8,
          marginTop: 10,
        }}
      >
        {timeline.map(
          (item) => (
            <article
              key={item.id}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "80px 1fr 100px",
                gap: 10,
              }}
            >
              <strong>
                {item.time === "99:99"
                  ? "—"
                  : item.time}
              </strong>

              <span>
                {item.critical
                  ? "⚠ "
                  : ""}
                {item.name}
              </span>

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
