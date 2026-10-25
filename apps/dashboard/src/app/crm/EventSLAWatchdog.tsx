"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

function daysUntil(
  value?:
    | string
    | null,
) {
  if (!value) {
    return null;
  }

  const target =
    new Date(
      `${value.slice(0,10)}T12:00:00`,
    );

  const now =
    new Date();

  now.setHours(
    0,
    0,
    0,
    0,
  );

  if (
    Number.isNaN(
      target.getTime(),
    )
  ) {
    return null;
  }

  return Math.ceil(
    (
      target.getTime()
      - now.getTime()
    )
    / 86400000,
  );
}

export function EventSLAWatchdog() {
  const {
    data,
  } =
    useEventOperations();

  const alerts =
    useMemo(
      () => {
        const result:
          Array<{
            key: string;
            urgency:
              | "critical"
              | "high"
              | "medium";
            text: string;
          }> =
            [];

        const eventDays =
          daysUntil(
            data?.event
              ?.event_date,
          );

        for (
          const item
          of data
            ?.requirements
          ?? []
        ) {
          if (
            item.service_status
            === "cancelled"
          ) {
            continue;
          }

          const name =
            item.service_name
            ?? "Servicio";

          if (
            !item
              .assigned_provider_id
            && eventDays !== null
            && eventDays <= 7
          ) {
            result.push({
              key:
                `provider-${item.id}`,
              urgency:
                item.is_critical
                  ? "critical"
                  : "high",
              text:
                `${name}: sin proveedor a ${eventDays} días del evento`,
            });
          }

          if (
            item.contract_status
            === "pending"
            && eventDays !== null
            && eventDays <= 10
          ) {
            result.push({
              key:
                `contract-${item.id}`,
              urgency:
                "high",
              text:
                `${name}: contrato pendiente a ${eventDays} días`,
            });
          }

          const due =
            daysUntil(
              item
                .provider_payment_due_date,
            );

          if (
            due !== null
            && due < 0
          ) {
            result.push({
              key:
                `payment-${item.id}`,
              urgency:
                "critical",
              text:
                `${name}: pago vencido hace ${Math.abs(due)} día(s)`,
            });
          } else if (
            due !== null
            && due <= 3
          ) {
            result.push({
              key:
                `payment-${item.id}`,
              urgency:
                "medium",
              text:
                `${name}: pago vence en ${due} día(s)`,
            });
          }
        }

        const order = {
          critical:
            3,
          high:
            2,
          medium:
            1,
        };

        return result.sort(
          (
            left,
            right,
          ) =>
            order[
              right.urgency
            ]
            - order[
              left.urgency
            ],
        );
      },
      [
        data,
      ],
    );

  return (
    <section>
      <strong>
        SLA Watchdog
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
          alerts
            .slice(
              0,
              12,
            )
            .map(
              item => (
                <article
                  key={
                    item.key
                  }
                  data-severity={
                    item.urgency
                  }
                >
                  {
                    item.text
                  }
                </article>
              ),
            )
        }

        {
          !alerts.length
            ? (
              <span>
                Sin SLA críticos o vencidos.
              </span>
            )
            : null
        }
      </div>
    </section>
  );
}
