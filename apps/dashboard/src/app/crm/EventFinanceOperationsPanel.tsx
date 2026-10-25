"use client";

import {
  useEffect,
  useState,
} from "react";

type FinanceData = {
  providerCost?:
    | number
    | string;

  clientPrice?:
    | number
    | string;

  margin?:
    | number
    | string;

  projectedMargin?:
    | number
    | string;

  status?: string;

  [key: string]:
    unknown;
};

function num(
  value: unknown,
) {
  const result =
    Number(
      value
      ?? 0,
    );

  return Number.isFinite(
    result,
  )
    ? result
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

export function EventFinanceOperationsPanel({
  eventId,
}: {
  eventId: string;
}) {
  const [
    data,
    setData,
  ] =
    useState<
      FinanceData
      | null
    >(null);

  useEffect(
    () => {
      let active =
        true;

      async function load() {
        try {
          const response =
            await fetch(
              `/api/crm/events/${eventId}/finance`,
              {
                credentials:
                  "include",

                cache:
                  "no-store",
              },
            );

          if (
            !response.ok
          ) {
            return;
          }

          const body =
            await response.json();

          if (
            active
          ) {
            setData(
              body.finance
              ?? body,
            );
          }
        } catch {
          // No bloquea el expediente.
        }
      }

      void load();

      function refresh() {
        void load();
      }

      window.addEventListener(
        "event-service-updated",
        refresh,
      );

      return () => {
        active =
          false;

        window.removeEventListener(
          "event-service-updated",
          refresh,
        );
      };
    },
    [
      eventId,
    ],
  );

  if (
    !data
  ) {
    return (
      <div>
        Finanzas operativas sin datos.
      </div>
    );
  }

  const cost =
    num(
      data.providerCost,
    );

  const price =
    num(
      data.clientPrice,
    );

  const margin =
    num(
      data.projectedMargin
      ?? data.margin
      ?? (
        price
        - cost
      ),
    );

  const marginPercent =
    price > 0
      ? (
          margin
          / price
        )
        * 100
      : 0;

  return (
    <section>
      <strong>
        Resumen financiero
      </strong>

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(auto-fit,minmax(150px,1fr))",

          gap:
            10,

          marginTop:
            10,
        }}
      >
        <Metric
          label="Coste proveedores"
          value={money(cost)}
        />

        <Metric
          label="Precio cliente"
          value={money(price)}
        />

        <Metric
          label="Margen"
          value={money(margin)}
        />

        <Metric
          label="Margen %"
          value={`${marginPercent.toFixed(1)}%`}
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
    <article
      style={{
        padding:
          10,

        border:
          "1px solid rgba(120,120,120,.15)",

        borderRadius:
          10,
      }}
    >
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
