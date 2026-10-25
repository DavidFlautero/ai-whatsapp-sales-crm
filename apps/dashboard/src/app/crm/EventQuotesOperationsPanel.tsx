"use client";

import {
  useEffect,
  useState,
} from "react";

type Quote = {
  id?: string;
  status?: string | null;
  total?: number | string | null;
  total_amount?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
  version?: number | null;
};

function money(
  value:
    | number
    | string
    | null
    | undefined,
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
    Number(
      value
      ?? 0,
    ),
  );
}

export function EventQuotesOperationsPanel({
  eventId,
}: {
  eventId: string;
}) {
  const [
    quotes,
    setQuotes,
  ] =
    useState<
      Quote[]
    >([]);

  useEffect(
    () => {
      let active =
        true;

      async function load() {
        const response =
          await fetch(
            `/api/crm/events/${eventId}/quotes`,
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

        const rows =
          Array.isArray(
            body.quotes,
          )
            ? body.quotes
            : Array.isArray(
                body,
              )
              ? body
              : [];

        if (
          active
        ) {
          setQuotes(rows);
        }
      }

      void load()
        .catch(
          () => undefined,
        );

      return () => {
        active =
          false;
      };
    },
    [
      eventId,
    ],
  );

  const latest =
    quotes[0];

  const accepted =
    quotes.find(
      quote =>
        [
          "accepted",
          "approved",
        ].includes(
          quote.status
          ?? "",
        ),
    );

  return (
    <section>
      <strong>
        Presupuestos
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
          label="Versiones"
          value={String(
            quotes.length,
          )}
        />

        <Metric
          label="Último estado"
          value={
            latest?.status
            ?? "Sin presupuesto"
          }
        />

        <Metric
          label="Último total"
          value={
            latest
              ? money(
                  latest.total
                  ?? latest.total_amount,
                )
              : "—"
          }
        />

        <Metric
          label="Aceptado"
          value={
            accepted
              ? "Sí"
              : "No"
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
        }}
      >
        {value}
      </strong>
    </article>
  );
}
