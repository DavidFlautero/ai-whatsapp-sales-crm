"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

function num(
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
  ).format(
    value,
  );
}

export function EventCashflowForecast() {
  const {
    data,
  } =
    useEventOperations();

  const forecast =
    useMemo(
      () => {
        let revenue =
          0;

        let committed =
          0;

        let paid =
          0;

        let outstanding =
          0;

        let due7 =
          0;

        let due30 =
          0;

        let overdue =
          0;

        const now =
          Date.now();

        for (
          const item
          of data?.requirements
          ?? []
        ) {
          if (
            item.service_status
            === "cancelled"
          ) {
            continue;
          }

          revenue +=
            num(
              item.client_price,
            );

          committed +=
            num(
              item.provider_cost,
            );

          paid +=
            num(
              item.deposit_paid,
            );

          const pending =
            Math.max(
              0,
              num(
                item.deposit_required,
              )
              - num(
                  item.deposit_paid,
                ),
            );

          outstanding +=
            pending;

          if (
            pending <= 0
          ) {
            continue;
          }

          const rawDue =
            item.provider_payment_due_date;

          if (
            !rawDue
          ) {
            due30 +=
              pending;

            continue;
          }

          const due =
            new Date(
              rawDue,
            )
              .getTime();

          if (
            Number.isNaN(
              due,
            )
          ) {
            continue;
          }

          const days =
            (
              due
              - now
            )
            / 86400000;

          if (
            days < 0
          ) {
            overdue +=
              pending;
          }

          if (
            days <= 7
          ) {
            due7 +=
              pending;
          }

          if (
            days <= 30
          ) {
            due30 +=
              pending;
          }
        }

        return {
          revenue,
          committed,
          paid,
          outstanding,
          due7,
          due30,
          overdue,

          projectedMargin:
            revenue
            - committed,

          liquidityAfter30Days:
            revenue
            - paid
            - due30,
        };
      },
      [
        data,
      ],
    );

  return (
    <section>
      <strong>
        Forecast financiero
      </strong>

      <div
        style={{
          display:
            "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(135px,1fr))",
          gap:
            9,
          marginTop:
            10,
        }}
      >
        <Metric
          label="Ingresos"
          value={
            money(
              forecast.revenue,
            )
          }
        />

        <Metric
          label="Coste comprometido"
          value={
            money(
              forecast.committed,
            )
          }
        />

        <Metric
          label="Pagado"
          value={
            money(
              forecast.paid,
            )
          }
        />

        <Metric
          label="Pendiente"
          value={
            money(
              forecast.outstanding,
            )
          }
        />

        <Metric
          label="Salida 7 días"
          value={
            money(
              forecast.due7,
            )
          }
        />

        <Metric
          label="Salida 30 días"
          value={
            money(
              forecast.due30,
            )
          }
        />

        <Metric
          label="Vencido"
          value={
            money(
              forecast.overdue,
            )
          }
        />

        <Metric
          label="Margen proyectado"
          value={
            money(
              forecast.projectedMargin,
            )
          }
        />
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article>
      <small>
        {label}
      </small>

      <strong
        style={{
          display:
            "block",
          marginTop:
            3,
        }}
      >
        {value}
      </strong>
    </article>
  );
}
