"use client";

export type ProviderAvailability = {
  provider_id: string;
  provider_name: string;

  status:
    | "unknown"
    | "requested"
    | "available"
    | "tentative"
    | "unavailable"
    | "reserved";

  event_date?: string | null;
  checked_at?: string | null;
  notes?: string | null;
};


type Props = {
  eventDate?: string | null;

  items:
    ProviderAvailability[];

  onRequestCheck?: (
    item:
      ProviderAvailability,
  ) => void;

  onSetStatus?: (
    item:
      ProviderAvailability,

    status:
      ProviderAvailability[
        "status"
      ],
  ) => void;
};


const LABELS:
  Record<
    ProviderAvailability["status"],
    string
  > = {
    unknown:
      "Sin consultar",

    requested:
      "Consulta enviada",

    available:
      "Disponible",

    tentative:
      "Tentativa",

    unavailable:
      "No disponible",

    reserved:
      "Reservado",
  };


function formatDate(
  value?:
    string | null,
) {
  if (!value) {
    return "sin definir";
  }

  const date =
    new Date(
      `${value}T00:00:00`,
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
      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric",
    },
  ).format(
    date,
  );
}


export function ProviderAvailabilityPanel({
  eventDate,
  items,
  onRequestCheck,
  onSetStatus,
}: Props) {

  return (
    <section
      style={{
        display:
          "grid",

        gap:
          14,

        marginBottom:
          18,
      }}
    >

      <header>
        <h3
          style={{
            margin:
              0,

            fontSize:
              15,
          }}
        >
          Disponibilidad de proveedores
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
          Fecha del evento:{" "}
          {
            formatDate(
              eventDate,
            )
          }
        </div>
      </header>


      {!items.length ? (
        <div
          style={{
            padding:
              14,

            border:
              "1px solid #e5e7eb",

            borderRadius:
              10,

            color:
              "#6b7280",

            fontSize:
              13,
          }}
        >
          No hay proveedores compatibles
          para consultar.
        </div>
      ) : null}


      <div
        style={{
          display:
            "grid",

          gap:
            8,
        }}
      >

        {items.map(
          (
            item,
          ) => {

            const status =
              item.status;

            return (
              <article
                key={
                  item.provider_id
                }
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "minmax(0,1fr) auto",

                  gap:
                    14,

                  padding:
                    14,

                  border:
                    status
                    === "available"
                      ? "1px solid #86efac"
                      : status
                        === "tentative"
                        ? "1px solid #fde68a"
                        : status
                          === "unavailable"
                          ? "1px solid #fecaca"
                          : status
                            === "reserved"
                            ? "1px solid #93c5fd"
                            : "1px solid #e5e7eb",

                  borderRadius:
                    10,

                  background:
                    "#fff",
                }}
              >

                <div>
                  <strong>
                    {
                      item
                        .provider_name
                    }
                  </strong>


                  <div
                    style={{
                      marginTop:
                        4,

                      fontSize:
                        12,

                      fontWeight:
                        600,
                    }}
                  >
                    {
                      LABELS[
                        status
                      ]
                    }
                  </div>


                  {item
                    .checked_at ? (
                    <div
                      style={{
                        marginTop:
                          4,

                        color:
                          "#6b7280",

                        fontSize:
                          11,
                      }}
                    >
                      Última comprobación:{" "}
                      {
                        new Intl.DateTimeFormat(
                          "es-ES",
                          {
                            dateStyle:
                              "short",

                            timeStyle:
                              "short",
                          },
                        ).format(
                          new Date(
                            item
                              .checked_at,
                          ),
                        )
                      }
                    </div>
                  ) : null}


                  {item.notes ? (
                    <div
                      style={{
                        marginTop:
                          5,

                        fontSize:
                          12,
                      }}
                    >
                      {
                        item.notes
                      }
                    </div>
                  ) : null}
                </div>


                <div
                  style={{
                    display:
                      "flex",

                    gap:
                      6,

                    alignItems:
                      "center",

                    flexWrap:
                      "wrap",

                    justifyContent:
                      "flex-end",
                  }}
                >

                  {onRequestCheck
                  && (
                    status
                    === "unknown"
                    || status
                    === "requested"
                  ) ? (
                    <button
                      type="button"

                      onClick={() =>
                        onRequestCheck(
                          item,
                        )
                      }
                    >
                      {
                        status
                        === "requested"
                          ? "Reconsultar"
                          : "Consultar"
                      }
                    </button>
                  ) : null}


                  {onSetStatus ? (
                    <>

                      <button
                        type="button"

                        disabled={
                          status
                          === "available"
                        }

                        onClick={() =>
                          onSetStatus(
                            item,
                            "available",
                          )
                        }
                      >
                        Disponible
                      </button>


                      <button
                        type="button"

                        disabled={
                          status
                          === "tentative"
                        }

                        onClick={() =>
                          onSetStatus(
                            item,
                            "tentative",
                          )
                        }
                      >
                        Tentativa
                      </button>


                      <button
                        type="button"

                        disabled={
                          status
                          === "unavailable"
                        }

                        onClick={() =>
                          onSetStatus(
                            item,
                            "unavailable",
                          )
                        }
                      >
                        No disponible
                      </button>


                      <button
                        type="button"

                        disabled={
                          status
                          === "reserved"
                        }

                        onClick={() =>
                          onSetStatus(
                            item,
                            "reserved",
                          )
                        }
                      >
                        Reservado
                      </button>

                    </>
                  ) : null}

                </div>

              </article>
            );
          },
        )}

      </div>

    </section>
  );
}
