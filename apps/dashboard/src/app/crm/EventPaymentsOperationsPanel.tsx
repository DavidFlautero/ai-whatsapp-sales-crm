"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

function n(
  value: unknown,
) {
  const parsed =
    Number(
      value
      ?? 0,
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}

function money(
  value: number,
) {
  return new Intl.NumberFormat(
    "es-ES",
    {
      style:
        "currency",
      currency:
        "EUR",
      maximumFractionDigits:
        0,
    },
  ).format(value);
}

export function EventPaymentsOperationsPanel({
  eventId: _eventId,
}: {
  eventId: string;
}) {
  const {
    data,
  } =
    useEventOperations();

  const pending =
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
            item => {
              const required =
                n(
                  item.deposit_required,
                );

              const paid =
                n(
                  item.deposit_paid,
                );

              return {
                ...item,
                required,
                paid,
                pending:
                  Math.max(
                    0,
                    required
                    - paid,
                  ),
              };
            },
          )
          .filter(
            item =>
              item.pending
              > 0,
          )
          .sort(
            (
              left,
              right,
            ) =>
              (
                left
                  .provider_payment_due_date
                ?? "9999"
              )
                .localeCompare(
                  right
                    .provider_payment_due_date
                  ?? "9999",
                ),
          ),
      [
        data,
      ],
    );

  const total =
    pending.reduce(
      (
        sum,
        item,
      ) =>
        sum
        + item.pending,
      0,
    );

  return (
    <section>
      <strong>
        Pagos a proveedores
      </strong>

      <div>
        Pendiente total:{" "}
        <strong>
          {money(total)}
        </strong>
      </div>

      {pending
        .slice(0, 10)
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
              {" · "}
              {
                money(
                  item.pending,
                )
              }
            </div>
          ),
        )}

      {!pending.length ? (
        <span>
          Sin anticipos pendientes.
        </span>
      ) : null}
    </section>
  );
}
