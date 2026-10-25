"use client";

import styles from "./event-quote-preview.module.css";

type Requirement = {
  id: string;
  service_name?: string | null;
  quantity?: string | number | null;
  client_price?: number | string | null;
  provider_cost?: number | string | null;
  service_status?: string | null;
};

type Props = {
  requirements: Requirement[];
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
  ).format(Number(value ?? 0));
}

export function EventQuotePreview({
  requirements,
}: Props) {
  const lines =
    requirements.slice(
      0,
      8,
    );

  const subtotal =
    lines.reduce(
      (
        acc,
        item,
      ) =>
        acc
        + Number(
          item.client_price
          ?? 0,
        ),
      0,
    );

  const cost =
    lines.reduce(
      (
        acc,
        item,
      ) =>
        acc
        + Number(
          item.provider_cost
          ?? 0,
        ),
      0,
    );

  const margin =
    subtotal - cost;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <span>
            PRESUPUESTO
          </span>

          <h3>
            Propuesta comercial
          </h3>

          <p>
            Servicios incluidos,
            venta y margen estimado.
          </p>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
          >
            Generar PDF
          </button>

          <button
            type="button"
            className={styles.primary}
          >
            Enviar presupuesto
          </button>
        </div>
      </div>

      <div className={styles.table}>
        <div className={styles.rowHeader}>
          <span>
            Servicio
          </span>

          <span>
            Cant.
          </span>

          <span>
            Coste
          </span>

          <span>
            Venta
          </span>

          <span>
            Estado
          </span>
        </div>

        {lines.map(
          (
            item,
          ) => (
            <div
              key={item.id}
              className={styles.row}
            >
              <strong>
                {
                  item.service_name
                  ?? "Servicio"
                }
              </strong>

              <span>
                {
                  item.quantity
                  ?? 1
                }
              </span>

              <span>
                {
                  money(
                    item.provider_cost,
                  )
                }
              </span>

              <span>
                {
                  money(
                    item.client_price,
                  )
                }
              </span>

              <span>
                {
                  item.service_status
                  ?? "Pendiente"
                }
              </span>
            </div>
          ),
        )}

        {!lines.length ? (
          <div className={styles.empty}>
            Agrega servicios
            para construir el
            presupuesto.
          </div>
        ) : null}
      </div>

      <div className={styles.totals}>
        <div>
          <span>
            Coste total
          </span>

          <strong>
            {money(cost)}
          </strong>
        </div>

        <div>
          <span>
            Margen estimado
          </span>

          <strong>
            {money(margin)}
          </strong>
        </div>

        <div className={styles.total}>
          <span>
            Total cliente
          </span>

          <strong>
            {money(subtotal)}
          </strong>
        </div>
      </div>
    </div>
  );
}
