"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventClientFollowupPanel() {
  const {
    data,
  } =
    useEventOperations();

  const signals =
    useMemo(
      () => {
        const result:
          string[] =
            [];

        const event =
          data?.event;

        if (
          !event?.guest_count
        ) {
          result.push(
            "Confirmar número de invitados.",
          );
        }

        if (
          !event?.event_date
        ) {
          result.push(
            "Confirmar fecha definitiva.",
          );
        }

        const services =
          data?.requirements
          ?? [];

        if (
          services.some(
            item =>
              item.client_price
              == null,
          )
        ) {
          result.push(
            "Presupuesto contiene servicios sin precio.",
          );
        }

        if (
          services.some(
            item =>
              item.service_status
              === "pending_approval",
          )
        ) {
          result.push(
            "Hay servicios pendientes de aprobación.",
          );
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
        Client Follow-up
      </strong>

      {
        signals.map(
          signal => (
            <div
              key={
                signal
              }
            >
              {signal}
            </div>
          ),
        )
      }

      {
        !signals.length
          ? (
            <span>
              Sin follow-up requerido.
            </span>
          )
          : null
      }
    </section>
  );
}
