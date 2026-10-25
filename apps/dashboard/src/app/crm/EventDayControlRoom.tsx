"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventDayControlRoom() {
  const {
    data,
    refresh,
    refreshing,
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
          .sort(
            (
              a,
              b,
            ) =>
              (
                a.arrival_time
                ?? a.setup_time
                ?? "99:99"
              )
                .localeCompare(
                  b.arrival_time
                  ?? b.setup_time
                  ?? "99:99",
                ),
          ),
      [
        data,
      ],
    );

  return (
    <section>
      <header
        style={{
          display:
            "flex",
          justifyContent:
            "space-between",
        }}
      >
        <strong>
          EVENT DAY CONTROL ROOM
        </strong>

        <button
          type="button"
          onClick={() => {
            void refresh();
          }}
          disabled={
            refreshing
          }
        >
          {
            refreshing
              ? "Sincronizando…"
              : "Sincronizar"
          }
        </button>
      </header>

      <div
        style={{
          marginTop:
            12,
        }}
      >
        {
          items.map(
            item => (
              <div
                key={
                  item.id
                  ?? item.service_name
                }
              >
                {
                  item.arrival_time
                  ?? item.setup_time
                  ?? "—"
                }
                {" · "}

                <strong>
                  {
                    item.service_name
                  }
                </strong>

                {" · "}

                {
                  item.service_status
                  ?? "pending"
                }

                {
                  item.is_critical
                    ? " · CRÍTICO"
                    : ""
                }
              </div>
            ),
          )
        }
      </div>
    </section>
  );
}
