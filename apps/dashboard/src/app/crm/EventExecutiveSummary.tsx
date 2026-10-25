"use client";

import styles from "./event-executive-summary.module.css";

type Props = {
  title: string;
  status?: string | null;
  eventDate?: string | null;
  eventEndDate?: string | null;
  guestCount?: number | null;
  targetBudget?: number | string | null;
  finalClientPrice?: number | string | null;
  finalProviderCost?: number | string | null;
  nextAction?: string | null;
  nextActionAt?: string | null;
  servicesCount: number;
  assignmentsCount: number;
  quotesCount: number;
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
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    },
  ).format(
    Number(value ?? 0),
  );
}

function dateLabel(
  value?: string | null,
) {
  if (!value) {
    return "Sin fecha";
  }

  const date =
    new Date(
      `${value.slice(0, 10)}T12:00:00`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "es-ES",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

export function EventExecutiveSummary({
  title,
  status,
  eventDate,
  eventEndDate,
  guestCount,
  targetBudget,
  finalClientPrice,
  finalProviderCost,
  nextAction,
  nextActionAt,
  servicesCount,
  assignmentsCount,
  quotesCount,
}: Props) {
  const sale =
    Number(
      finalClientPrice
      ?? targetBudget
      ?? 0,
    );

  const cost =
    Number(
      finalProviderCost
      ?? 0,
    );

  const margin =
    sale - cost;

  return (
    <div className={styles.root}>
      <section className={styles.hero}>
        <div className={styles.heroMain}>
          <span className={styles.eyebrow}>
            EVENTO EN OPERACIÓN
          </span>

          <h2>
            {title}
          </h2>

          <div className={styles.meta}>
            <span>
              {dateLabel(
                eventDate,
              )}
              {eventEndDate
                && eventEndDate
                  !== eventDate
                ? ` → ${dateLabel(
                    eventEndDate,
                  )}`
                : ""}
            </span>

            <span>
              {guestCount ?? 0}
              {" "}invitados
            </span>

            <span>
              Estado:
              {" "}
              {status ?? "Nuevo"}
            </span>
          </div>
        </div>

        <div className={styles.nextAction}>
          <span>
            Siguiente acción
          </span>

          <strong>
            {nextAction
              ?? "Definir siguiente paso"}
          </strong>

          <small>
            {nextActionAt
              ? `Fecha límite: ${dateLabel(
                  nextActionAt,
                )}`
              : "Sin fecha límite"}
          </small>
        </div>
      </section>

      <section className={styles.metrics}>
        <article>
          <span>
            Venta estimada
          </span>

          <strong>
            {money(sale)}
          </strong>
        </article>

        <article>
          <span>
            Coste proveedor
          </span>

          <strong>
            {money(cost)}
          </strong>
        </article>

        <article>
          <span>
            Margen esperado
          </span>

          <strong>
            {money(margin)}
          </strong>
        </article>

        <article>
          <span>
            Servicios
          </span>

          <strong>
            {servicesCount}
          </strong>
        </article>

        <article>
          <span>
            Responsables
          </span>

          <strong>
            {assignmentsCount}
          </strong>
        </article>

        <article>
          <span>
            Presupuestos
          </span>

          <strong>
            {quotesCount}
          </strong>
        </article>
      </section>
    </div>
  );
}
