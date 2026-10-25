"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventProviderFollowupPanel() {
  const {
    data,
  } =
    useEventOperations();

  const queue =
    useMemo(
      () => {
        const now =
          Date.now();

        return (
          data
            ?.availability
          ?? []
        )
          .filter(
            row =>
              row.status
              === "requested",
          )
          .map(
            row => {
              const checked =
                row.checked_at
                  ? new Date(
                      row.checked_at,
                    )
                    .getTime()
                  : 0;

              const ageHours =
                checked
                  ? (
                      now
                      - checked
                    )
                    / 3600000
                  : 999;

              return {
                ...row,
                ageHours,
                overdue:
                  ageHours
                  >= 24,
              };
            },
          )
          .sort(
            (
              left,
              right,
            ) =>
              right.ageHours
              - left.ageHours,
          );
      },
      [
        data,
      ],
    );

  return (
    <section>
      <strong>
        Provider Follow-up
      </strong>

      <div
        style={{
          display:
            "grid",
          gap:
            7,
          marginTop:
            8,
        }}
      >
        {
          queue.map(
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
                  item.overdue
                    ? "⚠ "
                    : ""
                }

                Proveedor{" "}
                {
                  item
                    .provider_id
                    ?.slice(
                      0,
                      8,
                    )
                  ?? "—"
                }

                {" · "}

                {
                  Math.round(
                    item.ageHours,
                  )
                }
                h esperando
              </div>
            ),
          )
        }

        {
          !queue.length
            ? (
              <span>
                Sin proveedores esperando respuesta.
              </span>
            )
            : null
        }
      </div>
    </section>
  );
}
