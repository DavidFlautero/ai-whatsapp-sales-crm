"use client";

import Link
  from "next/link";

import {
  useEffect,
  useState,
} from "react";

type LeadRequest = {
  id: string;
  status: string;
  source?: string | null;
  customer_name?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  event_type?: string | null;
  service_mode?: string | null;
  event_date?: string | null;
  event_start_time?: string | null;
  event_end_time?: string | null;
  date_flexible?: boolean;
  province?: string | null;
  municipality?: string | null;
  guest_count?: number | null;
  budget_initial?: number | string | null;
  budget_max?: number | string | null;
  requested_services?: string[];
  customer_message?: string | null;
  internal_notes?: string | null;
  created_at?: string | null;
};

function shortTime(
  value:
    string
    | null
    | undefined,
) {
  if (!value) {
    return "—";
  }

  return value.slice(
    0,
    5,
  );
}


function money(
  value:
    number
    | string
    | null
    | undefined,
) {
  if (
    value === null
    || value === undefined
    || value === ""
  ) {
    return "—";
  }

  return new Intl
    .NumberFormat(
      "es-ES",
      {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      },
    )
    .format(
      Number(
        value,
      ),
    );
}

export default function LeadRequestsPage() {
  const [
    items,
    setItems,
  ] =
    useState<
      LeadRequest[]
    >(
      [],
    );

  const [
    selected,
    setSelected,
  ] =
    useState<
      LeadRequest | null
    >(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  async function load() {
    const response =
      await fetch(
        "/api/crm/lead-requests",
      );

    const body =
      await response
        .json();

    if (
      !response.ok
    ) {
      throw new Error(
        body?.error
        ?? "No se pudieron cargar las solicitudes.",
      );
    }

    setItems(
      body.requests
      ?? [],
    );

    setLoading(
      false,
    );
  }

  useEffect(
    () => {
      void load();
    },
    [],
  );

  async function changeStatus(
    status: string,
  ) {
    if (
      !selected
    ) {
      return;
    }

    const response =
      await fetch(
        `/api/crm/lead-requests/${selected.id}`,
        {
          method:
            "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              status,
            }),
        },
      );

    const body =
      await response
        .json();

    if (
      !response.ok
    ) {
      return;
    }

    setSelected(
      body.request,
    );

    await load();
  }

  return (
    <main
      style={{
        minHeight:
          "100vh",

        background:
          "#f5f6f7",

        padding:
          28,
      }}
    >
      <div
        style={{
          width:
            "min(1360px, 100%)",

          margin:
            "0 auto",
        }}
      >
        <header
          style={{
            display:
              "flex",

            justifyContent:
              "space-between",

            alignItems:
              "end",

            marginBottom:
              22,
          }}
        >
          <div>


            <h1
              style={{
                margin:
                  "9px 0 4px",
              }}
            >
              Solicitudes
            </h1>

            <p
              style={{
                margin:
                  0,

                color:
                  "#777",
              }}
            >
              Leads recibidos desde la web y canales comerciales.
            </p>
          </div>

        </header>

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "400px minmax(0, 1fr)",

            gap:
              17,
          }}
        >
          <section
            style={{
              overflow:
                "hidden",

              background:
                "#fff",

              border:
                "1px solid #e2e2df",

              borderRadius:
                12,
            }}
          >
            {
              loading
                ? (
                  <div
                    style={{
                      padding:
                        20,
                    }}
                  >
                    Cargando…
                  </div>
                )
                : null
            }

            {
              items.map(
                (
                  item,
                ) => (
                  <button
                    key={
                      item.id
                    }
                    type="button"
                    onClick={
                      () =>
                        setSelected(
                          item,
                        )
                    }
                    style={{
                      width:
                        "100%",

                      padding:
                        15,

                      border:
                        0,

                      borderBottom:
                        "1px solid #eee",

                      background:
                        selected?.id
                        === item.id
                          ? "#f4f4f0"
                          : "#fff",

                      textAlign:
                        "left",

                      cursor:
                        "pointer",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",

                        justifyContent:
                          "space-between",

                        gap:
                          12,
                      }}
                    >
                      <strong>
                        {
                          item.customer_name
                          || "Sin nombre"
                        }
                      </strong>

                      <small>
                        {
                          item.status
                        }
                      </small>
                    </div>

                    <div
                      style={{
                        marginTop:
                          7,

                        color:
                          "#666",

                        fontSize:
                          12,
                      }}
                    >
                      {
                        item.event_type
                        || "Sin tipo"
                      }
                      {" · "}
                      {
                        item.municipality
                        || item.province
                        || "Ubicación pendiente"
                      }
                    </div>

                    <div
                      style={{
                        marginTop:
                          6,

                        fontSize:
                          12,

                        color:
                          "#8a877f",
                      }}
                    >
                      {
                        money(
                          item.budget_initial,
                        )
                      }
                      {" – "}
                      {
                        money(
                          item.budget_max,
                        )
                      }
                    </div>
                  </button>
                ),
              )
            }
          </section>

              {
                selected
                  ? (
                    <div
                      style={{
                        marginTop: 14,
                        padding: 14,
                        border:
                          "1px solid #e4e7e9",
                        borderRadius: 10,
                        background:
                          "#fafbfb",
                      }}
                    >
                      <strong
                        style={{
                          display: "block",
                          marginBottom: 10,
                        }}
                      >
                        Horario del evento
                      </strong>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(2, minmax(0, 1fr))",
                          gap: 12,
                        }}
                      >
                        <div>
                          <small
                            style={{
                              display: "block",
                              color: "#777",
                              marginBottom: 4,
                            }}
                          >
                            Entrada / inicio
                          </small>

                          <strong>
                            {
                              shortTime(
                                selected.event_start_time,
                              )
                            }
                          </strong>
                        </div>

                        <div>
                          <small
                            style={{
                              display: "block",
                              color: "#777",
                              marginBottom: 4,
                            }}
                          >
                            Salida / entrega
                          </small>

                          <strong>
                            {
                              shortTime(
                                selected.event_end_time,
                              )
                            }
                          </strong>
                        </div>
                      </div>

                      {
                        selected.event_start_time
                        && selected.event_end_time
                        && selected.event_end_time
                          < selected.event_start_time
                          ? (
                            <small
                              style={{
                                display: "block",
                                marginTop: 10,
                                color: "#59636e",
                              }}
                            >
                              La salida corresponde al día siguiente.
                            </small>
                          )
                          : null
                      }
                    </div>
                  )
                  : null
              }

          <section
            style={{
              minHeight:
                560,

              padding:
                24,

              background:
                "#fff",

              border:
                "1px solid #e2e2df",

              borderRadius:
                12,
            }}
          >
            {
              !selected
                ? (
                  <div
                    style={{
                      color:
                        "#777",
                    }}
                  >
                    Selecciona una solicitud.
                  </div>
                )
                : (
                  <>
                    <div
                      style={{
                        display:
                          "flex",

                        justifyContent:
                          "space-between",

                        gap:
                          20,
                      }}
                    >
                      <div>
                        <small
                          style={{
                            color:
                              "#777",
                          }}
                        >
                          SOLICITUD
                        </small>

                        <h2
                          style={{
                            margin:
                              "5px 0",
                          }}
                        >
                          {
                            selected.customer_name
                          }
                        </h2>

                        <div
                          style={{
                            color:
                              "#666",
                          }}
                        >
                          {
                            selected.event_type
                          }
                        </div>
                      </div>

                      <select
                        value={
                          selected.status
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            void changeStatus(
                              event.target.value,
                            )
                        }
                      >
                        <option value="new">
                          Nueva
                        </option>

                        <option value="contacted">
                          Contactado
                        </option>

                        <option value="qualified">
                          Calificado
                        </option>

                        <option value="proposal">
                          Propuesta
                        </option>

                        <option value="converted">
                          Convertido
                        </option>

                        <option value="lost">
                          Perdido
                        </option>
                      </select>
                    </div>

                    <div
                      style={{
                        marginTop:
                          28,

                        display:
                          "grid",

                        gridTemplateColumns:
                          "repeat(3, minmax(0, 1fr))",

                        gap:
                          12,
                      }}
                    >
                      {
                        [
                          [
                            "WhatsApp",
                            selected.whatsapp
                            || "—",
                          ],
                          [
                            "Fecha",
                            selected.event_date
                            || (
                              selected.date_flexible
                                ? "Flexible"
                                : "—"
                            ),
                          ],
                          [
                            "Invitados",
                            selected.guest_count
                            ?? "—",
                          ],
                          [
                            "Ubicación",
                            [
                              selected.municipality,
                              selected.province,
                            ]
                              .filter(
                                Boolean,
                              )
                              .join(
                                ", ",
                              )
                            || "—",
                          ],
                          [
                            "Presupuesto inicial",
                            money(
                              selected.budget_initial,
                            ),
                          ],
                          [
                            "Máximo",
                            money(
                              selected.budget_max,
                            ),
                          ],
                        ].map(
                          (
                            [
                              label,
                              value,
                            ],
                          ) => (
                            <article
                              key={
                                label
                              }
                              style={{
                                padding:
                                  14,

                                border:
                                  "1px solid #ecebe7",

                                borderRadius:
                                  9,

                                background:
                                  "#fafafa",
                              }}
                            >
                              <small
                                style={{
                                  color:
                                    "#888",
                                }}
                              >
                                {
                                  label
                                }
                              </small>

                              <strong
                                style={{
                                  display:
                                    "block",

                                  marginTop:
                                    5,
                                }}
                              >
                                {
                                  value
                                }
                              </strong>
                            </article>
                          ),
                        )
                      }
                    </div>

                    <div
                      style={{
                        marginTop:
                          26,
                      }}
                    >
                      <strong>
                        Servicios solicitados
                      </strong>

                      <div
                        style={{
                          marginTop:
                            10,

                          display:
                            "flex",

                          gap:
                            7,

                          flexWrap:
                            "wrap",
                        }}
                      >
                        {
                          (
                            selected.requested_services
                            ?? []
                          ).map(
                            (
                              service,
                            ) => (
                              <span
                                key={
                                  service
                                }
                                style={{
                                  padding:
                                    "7px 10px",

                                  borderRadius:
                                    999,

                                  background:
                                    "#efefeb",

                                  fontSize:
                                    12,
                                }}
                              >
                                {
                                  service
                                }
                              </span>
                            ),
                          )
                        }
                      </div>
                    </div>

                    {
                      selected.customer_message
                        ? (
                          <div
                            style={{
                              marginTop:
                                26,
                            }}
                          >
                            <strong>
                              Lo que nos contó
                            </strong>

                            <p
                              style={{
                                color:
                                  "#555",

                                lineHeight:
                                  1.65,

                                whiteSpace:
                                  "pre-line",
                              }}
                            >
                              {
                                selected.customer_message
                              }
                            </p>
                          </div>
                        )
                        : null
                    }

                    <div
                      style={{
                        marginTop:
                          30,

                        display:
                          "flex",

                        gap:
                          9,
                      }}
                    >
                      {
                        selected.whatsapp
                          ? (
                            <a
                              href={
                                `https://wa.me/${selected.whatsapp.replace(/\D/g, "")}`
                              }
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                padding:
                                  "10px 14px",

                                background:
                                  "#171717",

                                color:
                                  "#fff",

                                borderRadius:
                                  8,

                                textDecoration:
                                  "none",

                                fontWeight:
                                  700,
                              }}
                            >
                              WhatsApp
                            </a>
                          )
                          : null
                      }

                      <Link
                        href="/crm"
                        style={{
                          padding:
                            "10px 14px",

                          border:
                            "1px solid #ccc",

                          borderRadius:
                            8,

                          color:
                            "#222",

                          textDecoration:
                            "none",

                          fontWeight:
                            700,
                        }}
                      >
                        Ir a eventos
                      </Link>
                    </div>
                  </>
                )
            }
          </section>
        </div>
      </div>
    </main>
  );
}
