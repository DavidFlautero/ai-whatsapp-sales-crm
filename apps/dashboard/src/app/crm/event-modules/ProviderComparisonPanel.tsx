"use client";

export type ProviderComparison = {
  id: string;

  provider_id: string;
  provider_name: string;

  amount?:
    number
    | null;

  currency?:
    string
    | null;

  available?:
    boolean
    | null;

  capacity?:
    number
    | null;

  city?:
    string
    | null;

  rating?:
    number
    | null;

  incidents?:
    number
    | null;

  deposit_amount?:
    number
    | null;

  notes?:
    string
    | null;
};

type Props = {
  options:
    ProviderComparison[];

  guestCount?:
    number
    | null;

  selectedProviderId?:
    string
    | null;

  onSelect:
    (
      option:
        ProviderComparison,
    ) => void;

  onDiscard?: (
    option:
      ProviderComparison,
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
    return "Sin precio";
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

export function ProviderComparisonPanel({
  options,
  guestCount,
  selectedProviderId,
  onSelect,
  onDiscard,
}: Props) {
  const sorted =
    [...options]
      .sort(
        (
          a,
          b,
        ) => {
          if (
            a.available
            !== b.available
          ) {
            return a.available
              ? -1
              : 1;
          }

          if (
            a.amount !== null
            && a.amount !== undefined
            && b.amount !== null
            && b.amount !== undefined
          ) {
            return (
              a.amount
              - b.amount
            );
          }

          return 0;
        },
      );

  return (
    <section
      style={{
        display:
          "grid",

        gap:
          14,
      }}
    >
      <header>
        <h3
          style={{
            margin:
              0,
          }}
        >
          Comparar proveedores
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
          Comparación operativa antes
          de contratar.
        </div>
      </header>

      <div
        style={{
          overflowX:
            "auto",
        }}
      >
        <table
          style={{
            width:
              "100%",

            borderCollapse:
              "collapse",

            fontSize:
              13,
          }}
        >
          <thead>
            <tr
              style={{
                textAlign:
                  "left",

                borderBottom:
                  "1px solid #d1d5db",
              }}
            >
              <th
                style={{
                  padding:
                    10,
                }}
              >
                Proveedor
              </th>

              <th>
                Precio
              </th>

              <th>
                Disponible
              </th>

              <th>
                Capacidad
              </th>

              <th>
                Ciudad
              </th>

              <th>
                Rating
              </th>

              <th>
                Incidencias
              </th>

              <th />
            </tr>
          </thead>

          <tbody>
            {sorted.map(
              (
                option,
              ) => {
                const selected =
                  selectedProviderId
                  === option
                    .provider_id;

                const capacityOk =
                  !guestCount
                  || !option
                    .capacity
                  || option
                    .capacity
                  >= guestCount;

                return (
                  <tr
                    key={
                      option.id
                    }
                    style={{
                      borderBottom:
                        "1px solid #e5e7eb",

                      background:
                        selected
                          ? "#f0fdf4"
                          : "#fff",
                    }}
                  >
                    <td
                      style={{
                        padding:
                          10,
                      }}
                    >
                      <strong>
                        {
                          option
                            .provider_name
                        }
                      </strong>

                      {selected ? (
                        <div
                          style={{
                            marginTop:
                              3,

                            color:
                              "#166534",

                            fontSize:
                              11,

                            fontWeight:
                              700,
                          }}
                        >
                          SELECCIONADO
                        </div>
                      ) : null}
                    </td>

                    <td>
                      {
                        money(
                          option.amount,
                          option.currency
                          ?? "EUR",
                        )
                      }
                    </td>

                    <td>
                      {
                        option
                          .available
                        === true
                          ? "✓ Sí"
                          : option
                              .available
                            === false
                            ? "✕ No"
                            : "Por confirmar"
                      }
                    </td>

                    <td>
                      <span
                        style={{
                          color:
                            capacityOk
                              ? "#166534"
                              : "#991b1b",
                        }}
                      >
                        {
                          option
                            .capacity
                          ?? "—"
                        }

                        {
                          guestCount
                            && option
                              .capacity
                            ? capacityOk
                              ? " ✓"
                              : " ✕"
                            : ""
                        }
                      </span>
                    </td>

                    <td>
                      {
                        option.city
                        ?? "—"
                      }
                    </td>

                    <td>
                      {
                        option.rating
                        ?? "—"
                      }
                    </td>

                    <td>
                      {
                        option
                          .incidents
                        ?? 0
                      }
                    </td>

                    <td>
                      <div
                        style={{
                          display:
                            "flex",

                          gap:
                            6,

                          justifyContent:
                            "flex-end",
                        }}
                      >
                        {onDiscard ? (
                          <button
                            type="button"
                            onClick={() =>
                              onDiscard(
                                option,
                              )
                            }
                          >
                            Descartar
                          </button>
                        ) : null}

                        <button
                          type="button"
                          disabled={
                            option
                              .available
                            === false
                            || !capacityOk
                          }
                          onClick={() =>
                            onSelect(
                              option,
                            )
                          }
                        >
                          {selected
                            ? "Seleccionado"
                            : "Elegir"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>

      {!options.length ? (
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
          Necesitamos al menos una
          cotización para comparar
          proveedores.
        </div>
      ) : null}
    </section>
  );
}
