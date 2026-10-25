"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

function minutes(
  value?:
    | string
    | null,
) {
  if (!value) {
    return null;
  }

  const match =
    value.match(
      /(\d{1,2}):(\d{2})/,
    );

  if (!match) {
    return null;
  }

  return (
    Number(
      match[1],
    )
    * 60
    + Number(
        match[2],
      )
  );
}

export function EventScheduleConflictDetector() {
  const {
    data,
  } =
    useEventOperations();

  const conflicts =
    useMemo(
      () => {
        const services =
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
                  ?? item.service_name
                  ?? "service",

                name:
                  item.service_name
                  ?? "Servicio",

                arrival:
                  minutes(
                    item.arrival_time,
                  ),

                setup:
                  minutes(
                    item.setup_time,
                  ),
              }),
            );

        const result:
          string[] =
            [];

        for (
          const item
          of services
        ) {
          if (
            item.arrival !== null
            && item.setup !== null
            && item.setup
            < item.arrival
          ) {
            result.push(
              `${item.name}: montaje anterior a llegada.`,
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
        Schedule Integrity
      </strong>

      {
        conflicts.map(
          item => (
            <div
              key={
                item
              }
            >
              ⚠ {item}
            </div>
          ),
        )
      }

      {
        !conflicts.length
          ? (
            <span>
              Timeline consistente.
            </span>
          )
          : null
      }
    </section>
  );
}
