"use client";

export type ProviderQuote = {
  id: string;

  provider_id: string;
  provider_name: string;

  requirement_id?: string | null;

  status:
    | "requested"
    | "received"
    | "accepted"
    | "rejected"
    | "expired";

  amount?:
    number
    | null;

  currency?:
    string
    | null;

  deposit_amount?:
    number
    | null;

  valid_until?:
    string
    | null;

  includes?:
    string
    | null;

  conditions?:
    string
    | null;

  notes?:
    string
    | null;

  created_at?:
    string
    | null;
};

type Props = {
  quotes:
    ProviderQuote[];

  onRequestQuote?: () => void;

  onAccept?: (
    quote:
      ProviderQuote,
  ) => void;

  onReject?: (
    quote:
      ProviderQuote,
  ) => void;

  onOpen?: (
    quote:
      ProviderQuote,
  ) => void;
};

function money(
  value?:
    number
    | null,

  currency =
    "EUR",
) {
  if (
    value === null
    || value === undefined
  ) {
    return "Pendiente";
  }

  return new Intl
    .NumberFormat(
      "es-ES",
      {
        style:
          "currency",

        currency,
      },
    )
    .format(
      value,
    );
}

const STATUS:
  Record<
    ProviderQuote["status"],
    string
  > = {
    requested:
      "Solicitado",

    received:
      "Recibido",

    accepted:
      "Aceptado",

    rejected:
      "Rechazado",

    expired:
      "Vencido",
  };

export function ProviderQuotesPanel({
  quotes,
  onRequestQuote,
  onAccept,
  onReject,
  onOpen,
}: Props) {
  return (
    <section
      style={{
        display:
          "grid",

        gap:
          14,
      }}
    >
      <header
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "center",

          gap:
            16,
        }}
      >
        <div>
          <h3
            style={{
              margin:
                0,
            }}
          >
            Cotizaciones de proveedores
          </h3>

          <div
            style={{
              marginTop:
                4,

              color:
                "#6b7280",

              fontSize:
                12,
            }}
          >
            Presupuestos recibidos
            para esta necesidad.
          </div>
        </div>

        {onRequestQuote ? (
          <button
            type="button"
            onClick={
              onRequestQuote
            }
          >
            + Solicitar presupuesto
          </button>
        ) : null}
      </header>

      <div
        style={{
          display:
            "grid",

          gap:
            10,
        }}
      >
        {quotes.map(
          (
            quote,
          ) => (
            <article
              key={
                quote.id
              }
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "minmax(0,1fr) auto",

                gap:
                  16,

                padding:
                  15,

                border:
                  quote.status
                  === "accepted"
                    ? "1px solid #86efac"
                    : "1px solid #e5e7eb",

                borderRadius:
                  10,

                background:
                  quote.status
                  === "accepted"
                    ? "#f0fdf4"
                    : "#fff",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  onOpen?.(
                    quote,
                  )
                }
                style={{
                  display:
                    "grid",

                  gap:
                    5,

                  border:
                    0,

                  padding:
                    0,

                  background:
                    "transparent",

                  textAlign:
                    "left",

                  cursor:
                    onOpen
                      ? "pointer"
                      : "default",
                }}
              >
                <strong>
                  {
                    quote
                      .provider_name
                  }
                </strong>

                <span
                  style={{
                    fontSize:
                      12,

                    color:
                      "#6b7280",
                  }}
                >
                  {
                    STATUS[
                      quote.status
                    ]
                  }

                  {
                    quote.valid_until
                      ? ` · Válido hasta ${quote.valid_until}`
                      : ""
                  }
                </span>

                {quote.includes ? (
                  <span
                    style={{
                      fontSize:
                        12,

                      color:
                        "#4b5563",
                    }}
                  >
                    Incluye:{" "}
                    {
                      quote.includes
                    }
                  </span>
                ) : null}
              </button>

              <div
                style={{
                  display:
                    "grid",

                  justifyItems:
                    "end",

                  gap:
                    8,
                }}
              >
                <strong
                  style={{
                    fontSize:
                      18,
                  }}
                >
                  {
                    money(
                      quote.amount,
                      quote.currency
                      ?? "EUR",
                    )
                  }
                </strong>

                {quote.deposit_amount ? (
                  <span
                    style={{
                      fontSize:
                        11,

                      color:
                        "#6b7280",
                    }}
                  >
                    Señal{" "}
                    {
                      money(
                        quote
                          .deposit_amount,

                        quote.currency
                        ?? "EUR",
                      )
                    }
                  </span>
                ) : null}

                {quote.status
                  === "received"
                  ? (
                    <div
                      style={{
                        display:
                          "flex",

                        gap:
                          6,
                      }}
                    >
                      {onReject ? (
                        <button
                          type="button"
                          onClick={() =>
                            onReject(
                              quote,
                            )
                          }
                        >
                          Descartar
                        </button>
                      ) : null}

                      {onAccept ? (
                        <button
                          type="button"
                          onClick={() =>
                            onAccept(
                              quote,
                            )
                          }
                        >
                          Elegir
                        </button>
                      ) : null}
                    </div>
                  )
                  : null}
              </div>
            </article>
          ),
        )}

        {!quotes.length ? (
          <div
            style={{
              padding:
                24,

              border:
                "1px dashed #d1d5db",

              borderRadius:
                10,

              textAlign:
                "center",

              color:
                "#6b7280",
            }}
          >
            Todavía no se solicitaron
            presupuestos para esta
            necesidad.
          </div>
        ) : null}
      </div>
    </section>
  );
}
