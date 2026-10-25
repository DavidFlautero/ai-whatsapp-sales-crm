"use client";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventStalenessMonitor() {
  const {
    lastUpdatedAt,
    stale,
    error,
  } =
    useEventOperations();

  const age =
    lastUpdatedAt
      ? Math.round(
          (
            Date.now()
            - lastUpdatedAt
          )
          / 1000,
        )
      : null;

  return (
    <section>
      <strong>
        Observability
      </strong>

      <div>
        Estado datos:{" "}
        <strong>
          {
            error
              ? "ERROR"
              : stale
                ? "STALE"
                : "FRESH"
          }
        </strong>
      </div>

      <div>
        Edad snapshot:{" "}
        {
          age !== null
            ? `${age}s`
            : "—"
        }
      </div>

      {
        error
          ? (
            <div>
              {
                error
              }
            </div>
          )
          : null
      }
    </section>
  );
}
