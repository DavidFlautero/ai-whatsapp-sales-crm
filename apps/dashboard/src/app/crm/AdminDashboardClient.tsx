"use client";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import styles from "./admin-dashboard.module.css";


type Row =
  Record<string, any>;


type DashboardData = {
  providers: Row[];
  profiles: Row[];
  venues: Row[];
  events: Row[];
  requests: Row[];
};


const INITIAL_DATA: DashboardData = {
  providers: [],
  profiles: [],
  venues: [],
  events: [],
  requests: [],
};


type IconName =
  | "calendar"
  | "inbox"
  | "users"
  | "building"
  | "home"
  | "alert"
  | "phone"
  | "message"
  | "location"
  | "database"
  | "check"
  | "file"
  | "arrow"
  | "sparkles"
  | "plus"
  | "clock";


function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const content:
    Record<IconName, React.ReactNode> = {
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </>
    ),

    inbox: (
      <>
        <path d="M4 5h16v14H4z" />
        <path d="m4 13 4-4h8l4 4M8 13h8" />
      </>
    ),

    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20c.5-4 2.4-6 5.5-6s5 2 5.5 6" />
        <path d="M16 5.5a3 3 0 0 1 0 5.8M17 14c2.2.8 3.4 2.8 3.5 6" />
      </>
    ),

    building: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="1.5" />
        <path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3" />
      </>
    ),

    home: (
      <>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v9h13v-9M9 19v-5h6v5" />
      </>
    ),

    alert: (
      <>
        <path d="m12 3 9 16H3L12 3Z" />
        <path d="M12 9v4M12 16h.01" />
      </>
    ),

    phone: (
      <path d="M5 4h4l2 5-2.4 1.5a15 15 0 0 0 5 5L15 13l5 2v4c0 1-1 2-2 2C10 20 4 14 3 6c0-1 1-2 2-2Z" />
    ),

    message: (
      <>
        <path d="M4 5h16v12H9l-5 4V5Z" />
        <path d="M8 9h8M8 13h5" />
      </>
    ),

    location: (
      <>
        <path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),

    database: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </>
    ),

    check: (
      <path d="m5 12 4 4L19 6" />
    ),

    file: (
      <>
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </>
    ),

    arrow: (
      <path d="M5 12h14M14 7l5 5-5 5" />
    ),

    sparkles: (
      <>
        <path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z" />
        <path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" />
      </>
    ),

    plus: (
      <path d="M12 5v14M5 12h14" />
    ),

    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  };

  return (
    <svg {...common}>
      {content[name]}
    </svg>
  );
}


function arrayFrom(
  value: unknown,
): Row[] {
  if (
    Array.isArray(value)
  ) {
    return value as Row[];
  }

  if (
    value
    &&
    typeof value === "object"
  ) {
    const object =
      value as Row;

    for (
      const key
      of [
        "data",
        "items",
        "results",
        "providers",
        "profiles",
        "venues",
        "events",
        "requests",
      ]
    ) {
      if (
        Array.isArray(
          object[key],
        )
      ) {
        return object[key];
      }
    }
  }

  return [];
}


async function fetchArray(
  urls: string[],
): Promise<Row[]> {
  for (
    const url
    of urls
  ) {
    try {
      const response =
        await fetch(
          url,
          {
            cache: "no-store",
            credentials: "include",
          },
        );

      if (
        !response.ok
      ) {
        continue;
      }

      const body =
        await response.json();

      return arrayFrom(
        body,
      );
    } catch {
      // probar siguiente endpoint
    }
  }

  return [];
}


function lower(
  value: unknown,
) {
  return String(
    value ?? "",
  )
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    );
}


function displayName(
  row: Row,
) {
  return (
    row.name
    ??
    row.title
    ??
    row.event_name
    ??
    row.full_name
    ??
    "Sin nombre"
  );
}


function formatDate(
  value: unknown,
) {
  if (!value) {
    return "Sin fecha";
  }

  const date =
    new Date(
      String(value),
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Sin fecha";
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


function providerCategory(
  provider: Row,
  profile?: Row,
) {
  const text =
    lower(
      [
        provider.name,
        provider.notes,
        profile?.provider_type,
        profile?.service_categories?.join?.(" "),
        profile?.factual_summary,
      ].join(
        " ",
      ),
    );

  if (
    text.includes("catering")
    ||
    text.includes("cociner")
    ||
    text.includes("comida")
  ) {
    return "Catering";
  }

  if (
    text.includes("dj")
    ||
    text.includes("musica")
    ||
    text.includes("music")
    ||
    text.includes("banda")
  ) {
    return "DJs / Música";
  }

  if (
    text.includes("sonido")
    ||
    text.includes("sound")
    ||
    text.includes("luces")
  ) {
    return "Sonido / Luces";
  }

  if (
    text.includes("foto")
    ||
    text.includes("video")
    ||
    text.includes("360")
  ) {
    return "Foto / Vídeo";
  }

  if (
    text.includes("decor")
    ||
    text.includes("flor")
  ) {
    return "Decoración";
  }

  if (
    text.includes("silla")
    ||
    text.includes("mesa")
    ||
    text.includes("mobiliario")
  ) {
    return "Mobiliario";
  }

  if (
    text.includes("taxi")
    ||
    text.includes("bus")
    ||
    text.includes("transport")
    ||
    text.includes("limus")
    ||
    text.includes("coche")
  ) {
    return "Transporte";
  }

  if (
    text.includes("camarer")
    ||
    text.includes("staff")
    ||
    text.includes("seguridad")
  ) {
    return "Personal";
  }

  if (
    text.includes("inmobili")
    ||
    text.includes("inversor")
    ||
    text.includes("comprador")
  ) {
    return "Inmobiliario";
  }

  if (
    text.includes("owner")
    ||
    text.includes("propietar")
  ) {
    return "Propietarios";
  }

  return "Otros";
}


export default function AdminDashboardClient() {
  const [
    data,
    setData,
  ] =
    useState<DashboardData>(
      INITIAL_DATA,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);


  useEffect(
    () => {
      let active = true;

      async function load() {
        const [
          providers,
          profiles,
          venues,
          events,
          requests,
        ] =
          await Promise.all([
            fetchArray([
              "/api/crm/providers?limit=500",
              "/api/crm/providers",
            ]),

            fetchArray([
              "/api/crm/provider-profiles?limit=500",
              "/api/crm/provider-profiles",
            ]),

            fetchArray([
              "/api/crm/venues?limit=500",
              "/api/crm/venues",
            ]),

            fetchArray([
              "/api/crm/events?limit=200",
              "/api/crm/events",
            ]),

            fetchArray([
              "/api/crm/requests?limit=200",
              "/api/crm/solicitudes?limit=200",
              "/api/crm/requests",
            ]),
          ]);

        if (
          active
        ) {
          setData({
            providers,
            profiles,
            venues,
            events,
            requests,
          });

          setLoading(
            false,
          );
        }
      }

      load();

      return () => {
        active = false;
      };
    },
    [],
  );


  const profileMap =
    useMemo(
      () =>
        new Map(
          data.profiles.map(
            profile => [
              profile.provider_id,
              profile,
            ],
          ),
        ),
      [
        data.profiles,
      ],
    );


  const providerStats =
    useMemo(
      () => {
        let phone = 0;
        let whatsapp = 0;
        let zone = 0;
        let profile = 0;

        const incomplete:
          {
            id: string;
            name: string;
            missing: string[];
          }[] = [];

        const categories =
          new Map<
            string,
            number
          >();

        for (
          const provider
          of data.providers
        ) {
          const currentProfile =
            profileMap.get(
              provider.id,
            );

          const missing:
            string[] = [];

          const hasPhone =
            Boolean(
              provider.phone
              ||
              provider.whatsapp,
            );

          const hasWhatsapp =
            Boolean(
              provider.whatsapp,
            );

          const hasZone =
            Boolean(
              provider.city
              ||
              provider.province
              ||
              provider.service_area,
            );

          if (
            hasPhone
          ) {
            phone++;
          } else {
            missing.push(
              "teléfono",
            );
          }

          if (
            hasWhatsapp
          ) {
            whatsapp++;
          }

          if (
            hasZone
          ) {
            zone++;
          } else {
            missing.push(
              "zona",
            );
          }

          if (
            currentProfile
          ) {
            profile++;
          } else {
            missing.push(
              "perfil",
            );
          }

          const category =
            providerCategory(
              provider,
              currentProfile,
            );

          categories.set(
            category,
            (
              categories.get(
                category,
              )
              ?? 0
            ) + 1,
          );

          if (
            missing.length > 0
          ) {
            incomplete.push({
              id:
                String(
                  provider.id,
                ),

              name:
                displayName(
                  provider,
                ),

              missing,
            });
          }
        }

        return {
          phone,
          whatsapp,
          zone,
          profile,
          incomplete,
          categories,
        };
      },
      [
        data.providers,
        profileMap,
      ],
    );


  const venueStats =
    useMemo(
      () => {
        const chalets =
          data.venues.filter(
            venue => {
              const text =
                lower(
                  [
                    venue.name,
                    venue.title,
                    venue.slug,
                    venue.venue_type,
                    venue.type,
                    venue.category,
                  ].join(" "),
                );

              return (
                text.includes(
                  "chalet",
                )
                ||
                text.includes(
                  "villa",
                )
              );
            },
          );

        const incomplete =
          data.venues.filter(
            venue =>
              !(
                venue.city
                ||
                venue.location
                ||
                venue.address
              )
              ||
              !(
                venue.capacity
                ||
                venue.capacity_max
                ||
                venue.max_capacity
              ),
          );

        return {
          chalets,
          incomplete,
        };
      },
      [
        data.venues,
      ],
    );


  const upcomingEvents =
    useMemo(
      () => {
        return [
          ...data.events,
        ]
          .sort(
            (
              a,
              b,
            ) => {
              const aDate =
                new Date(
                  String(
                    a.event_date
                    ??
                    a.date
                    ??
                    a.starts_at
                    ??
                    "9999-12-31",
                  ),
                ).getTime();

              const bDate =
                new Date(
                  String(
                    b.event_date
                    ??
                    b.date
                    ??
                    b.starts_at
                    ??
                    "9999-12-31",
                  ),
                ).getTime();

              return (
                aDate
                -
                bDate
              );
            },
          )
          .slice(
            0,
            6,
          );
      },
      [
        data.events,
      ],
    );


  const attentionItems =
    useMemo(
      () => {
        const result:
          {
            title: string;
            detail: string;
            href: string;
            kind: string;
          }[] = [];

        for (
          const provider
          of providerStats
            .incomplete
            .slice(
              0,
              5,
            )
        ) {
          result.push({
            title:
              provider.name,

            detail:
              `Falta ${provider.missing.join(
                ", ",
              )}`,

            href:
              "/crm/proveedores",

            kind:
              "Proveedor",
          });
        }

        for (
          const venue
          of venueStats
            .incomplete
            .slice(
              0,
              3,
            )
        ) {
          result.push({
            title:
              displayName(
                venue,
              ),

            detail:
              "Espacio con información pendiente",

            href:
              "/crm/espacios",

            kind:
              "Espacio",
          });
        }

        return result.slice(
          0,
          7,
        );
      },
      [
        providerStats,
        venueStats,
      ],
    );


  const quality =
    data.providers.length
      ? Math.round(
          (
            providerStats.phone
            +
            providerStats.zone
            +
            providerStats.profile
          )
          /
          (
            data.providers.length
            *
            3
          )
          *
          100,
        )
      : 0;


  return (
    <main
      className={
        styles.page
      }
    >
      <div
        className={
          styles.container
        }
      >
        <header
          className={
            styles.pageHeader
          }
        >
          <div>
            <div
              className={
                styles.eyebrow
              }
            >
              Centro de operaciones
            </div>

            <h1>
              Panel general
            </h1>

            <p>
              Estado operativo,
              datos pendientes y
              accesos rápidos de
              Eventos Mediterráneo.
            </p>
          </div>

          <div
            className={
              styles.quickActions
            }
          >
            <Link
              href="/crm/eventos"
              className={
                styles.primaryAction
              }
            >
              <Icon
                name="plus"
                size={15}
              />
              Nuevo evento
            </Link>

            <Link
              href="/crm/solicitudes"
              className={
                styles.secondaryAction
              }
            >
              <Icon
                name="plus"
                size={15}
              />
              Solicitud
            </Link>

            <Link
              href="/crm/proveedores"
              className={
                styles.secondaryAction
              }
            >
              <Icon
                name="plus"
                size={15}
              />
              Proveedor
            </Link>

            <Link
              href="/crm/espacios"
              className={
                styles.secondaryAction
              }
            >
              <Icon
                name="plus"
                size={15}
              />
              Espacio
            </Link>
          </div>
        </header>


        <section
          className={
            styles.kpiGrid
          }
        >
          <KpiCard
            icon="calendar"
            label="Eventos"
            value={
              loading
                ? "…"
                : data.events.length
            }
            detail="Gestión operativa"
            href="/crm/eventos"
          />

          <KpiCard
            icon="inbox"
            label="Solicitudes"
            value={
              loading
                ? "…"
                : data.requests.length
            }
            detail="Entradas comerciales"
            href="/crm/solicitudes"
          />

          <KpiCard
            icon="users"
            label="Proveedores"
            value={
              loading
                ? "…"
                : data.providers.length
            }
            detail={
              `${providerStats.incomplete.length} con datos pendientes`
            }
            href="/crm/proveedores"
            warning={
              providerStats.incomplete.length
                > 0
            }
          />

          <KpiCard
            icon="building"
            label="Espacios"
            value={
              loading
                ? "…"
                : data.venues.length
            }
            detail={
              `${venueStats.incomplete.length} requieren revisión`
            }
            href="/crm/espacios"
          />

          <KpiCard
            icon="home"
            label="Chalets"
            value={
              loading
                ? "…"
                : venueStats.chalets.length
            }
            detail="Espacios tipo chalet / villa"
            href="/crm/espacios?type=chalet"
          />

          <KpiCard
            icon="alert"
            label="Pendientes"
            value={
              loading
                ? "…"
                : (
                    providerStats
                      .incomplete
                      .length
                    +
                    venueStats
                      .incomplete
                      .length
                  )
            }
            detail="Datos que necesitan atención"
            href="/crm/pendientes"
            warning
          />
        </section>


        <section
          className={
            styles.mainGrid
          }
        >
          <Panel
            title="Requiere atención"
            subtitle="Información que el administrador puede completar ahora."
            className={
              styles.attentionPanel
            }
          >
            {
              attentionItems.length
                === 0
              ? (
                  <EmptyState
                    text="No hay pendientes detectados."
                  />
                )
              : (
                  <div
                    className={
                      styles.attentionList
                    }
                  >
                    {
                      attentionItems.map(
                        (
                          item,
                          index,
                        ) => (
                          <Link
                            key={
                              `${item.title}-${index}`
                            }
                            href={
                              item.href
                            }
                            className={
                              styles.attentionRow
                            }
                          >
                            <div
                              className={
                                styles.attentionStatus
                              }
                            />

                            <div
                              className={
                                styles.attentionContent
                              }
                            >
                              <div
                                className={
                                  styles.attentionMeta
                                }
                              >
                                {
                                  item.kind
                                }
                              </div>

                              <strong>
                                {
                                  item.title
                                }
                              </strong>

                              <span>
                                {
                                  item.detail
                                }
                              </span>
                            </div>

                            <span
                              className={
                                styles.rowArrow
                              }
                            >
                              <Icon
                                name="arrow"
                                size={16}
                              />
                            </span>
                          </Link>
                        ),
                      )
                    }
                  </div>
                )
            }
          </Panel>


          <Panel
            title="Calidad del CRM"
            subtitle="Cobertura real de la información almacenada."
            action={
              <Link
                href="/crm/proveedores"
                className={
                  styles.panelLink
                }
              >
                Revisar datos
              </Link>
            }
          >
            <div
              className={
                styles.qualityHeader
              }
            >
              <strong>
                {quality}%
              </strong>

              <span>
                completitud general
              </span>
            </div>

            <div
              className={
                styles.progressTrack
              }
            >
              <div
                className={
                  styles.progressValue
                }
                style={{
                  width:
                    `${quality}%`,
                }}
              />
            </div>

            <QualityRow
              icon="phone"
              label="Con teléfono"
              value={
                providerStats.phone
              }
              total={
                data.providers.length
              }
            />

            <QualityRow
              icon="message"
              label="Con WhatsApp"
              value={
                providerStats.whatsapp
              }
              total={
                data.providers.length
              }
            />

            <QualityRow
              icon="location"
              label="Con zona"
              value={
                providerStats.zone
              }
              total={
                data.providers.length
              }
            />

            <QualityRow
              icon="database"
              label="Con perfil CRM"
              value={
                providerStats.profile
              }
              total={
                data.providers.length
              }
            />
          </Panel>
        </section>


        <section
          className={
            styles.mainGrid
          }
        >
          <Panel
            title="Red de proveedores"
            subtitle="Distribución actual de servicios y colaboradores."
            action={
              <Link
                href="/crm/proveedores"
                className={
                  styles.panelLink
                }
              >
                Ver todos
              </Link>
            }
          >
            <div
              className={
                styles.categoryGrid
              }
            >
              {
                [
                  [
                    "Catering",
                    "catering",
                  ],
                  [
                    "DJs / Música",
                    "dj-music",
                  ],
                  [
                    "Sonido / Luces",
                    "sound-light",
                  ],
                  [
                    "Foto / Vídeo",
                    "photo-video",
                  ],
                  [
                    "Decoración",
                    "decoration",
                  ],
                  [
                    "Mobiliario",
                    "furniture",
                  ],
                  [
                    "Transporte",
                    "transport",
                  ],
                  [
                    "Personal",
                    "staff",
                  ],
                  [
                    "Inmobiliario",
                    "real-estate",
                  ],
                  [
                    "Propietarios",
                    "owners",
                  ],
                  [
                    "Otros",
                    "other",
                  ],
                ].map(
                  (
                    [
                      label,
                      category,
                    ],
                  ) => (
                    <Link
                      key={
                        category
                      }
                      href={
                        `/crm/proveedores?category=${category}`
                      }
                      className={
                        styles.categoryCard
                      }
                    >
                      <span>
                        {label}
                      </span>

                      <strong>
                        {
                          providerStats
                            .categories
                            .get(
                              label,
                            )
                          ?? 0
                        }
                      </strong>

                      <Icon
                        name="arrow"
                        size={14}
                      />
                    </Link>
                  ),
                )
              }
            </div>
          </Panel>


          <Panel
            title="Espacios y chalets"
            subtitle="Inventario operativo de localizaciones."
            action={
              <Link
                href="/crm/espacios"
                className={
                  styles.panelLink
                }
              >
                Gestionar
              </Link>
            }
          >
            <div
              className={
                styles.spaceSummary
              }
            >
              <SummaryStat
                value={
                  data.venues.length
                }
                label="Espacios"
              />

              <SummaryStat
                value={
                  venueStats
                    .chalets
                    .length
                }
                label="Chalets"
              />

              <SummaryStat
                value={
                  venueStats
                    .incomplete
                    .length
                }
                label="Incompletos"
                warning
              />
            </div>

            <div
              className={
                styles.compactRows
              }
            >
              {
                venueStats
                  .incomplete
                  .slice(
                    0,
                    5,
                  )
                  .map(
                    (
                      venue,
                      index,
                    ) => (
                      <Link
                        key={
                          venue.id
                          ??
                          index
                        }
                        href="/crm/espacios"
                        className={
                          styles.compactRow
                        }
                      >
                        <div>
                          <strong>
                            {
                              displayName(
                                venue,
                              )
                            }
                          </strong>

                          <span>
                            Información pendiente
                          </span>
                        </div>

                        <Icon
                          name="arrow"
                          size={15}
                        />
                      </Link>
                    ),
                  )
              }

              {
                venueStats
                  .incomplete
                  .length
                  === 0
                &&
                (
                  <EmptyState
                    text="No hay espacios incompletos detectados."
                  />
                )
              }
            </div>
          </Panel>
        </section>


        <section
          className={
            styles.mainGrid
          }
        >
          <Panel
            title="Próximos eventos"
            subtitle="Vista rápida de la operación."
            action={
              <Link
                href="/crm/eventos"
                className={
                  styles.panelLink
                }
              >
                Abrir eventos
              </Link>
            }
          >
            {
              upcomingEvents.length
                === 0
              ? (
                  <EmptyState
                    text="No se recibieron eventos desde la API."
                  />
                )
              : (
                  <div
                    className={
                      styles.eventList
                    }
                  >
                    {
                      upcomingEvents.map(
                        (
                          event,
                          index,
                        ) => (
                          <Link
                            key={
                              event.id
                              ??
                              index
                            }
                            href={`/crm/eventos/${event.id}`}
                            className={
                              styles.eventRow
                            }
                          >
                            <div
                              className={
                                styles.eventDate
                              }
                            >
                              <Icon
                                name="calendar"
                                size={15}
                              />

                              {
                                formatDate(
                                  event.event_date
                                  ??
                                  event.date
                                  ??
                                  event.starts_at,
                                )
                              }
                            </div>

                            <div
                              className={
                                styles.eventIdentity
                              }
                            >
                              <strong>
                                {
                                  displayName(
                                    event,
                                  )
                                }
                              </strong>

                              <span>
                                {
                                  event.client_name
                                  ??
                                  event.customer_name
                                  ??
                                  "Cliente sin definir"
                                }
                              </span>
                            </div>

                            <span
                              className={
                                styles.eventStatus
                              }
                            >
                              {
                                event.status
                                ??
                                "Activo"
                              }
                            </span>
                          </Link>
                        ),
                      )
                    }
                  </div>
                )
            }
          </Panel>


          <Panel
            title="Estado administrativo"
            subtitle="Resumen de información crítica del CRM."
          >
            <div
              className={
                styles.adminStatusGrid
              }
            >
              <AdminStatus
                icon="users"
                label="Proveedores completos"
                value={
                  data.providers.length
                  -
                  providerStats
                    .incomplete
                    .length
                }
                total={
                  data.providers.length
                }
              />

              <AdminStatus
                icon="building"
                label="Espacios completos"
                value={
                  data.venues.length
                  -
                  venueStats
                    .incomplete
                    .length
                }
                total={
                  data.venues.length
                }
              />

              <AdminStatus
                icon="phone"
                label="Teléfonos registrados"
                value={
                  providerStats.phone
                }
                total={
                  data.providers.length
                }
              />

              <AdminStatus
                icon="message"
                label="WhatsApp registrados"
                value={
                  providerStats.whatsapp
                }
                total={
                  data.providers.length
                }
              />
            </div>
          </Panel>
        </section>


        <section
          className={
            styles.bottomGrid
          }
        >
          <Link
            href="/conversations"
            className={
              styles.systemCard
            }
          >
            <div
              className={
                styles.systemIcon
              }
            >
              <Icon
                name="message"
                size={20}
              />
            </div>

            <div>
              <strong>
                WhatsApp y conversaciones
              </strong>

              <span>
                Abrir centro de comunicaciones
              </span>
            </div>

            <Icon
              name="arrow"
              size={16}
            />
          </Link>


          <Link
            href="/ai-core"
            className={
              styles.systemCard
            }
          >
            <div
              className={
                styles.systemIcon
              }
            >
              <Icon
                name="sparkles"
                size={20}
              />
            </div>

            <div>
              <strong>
                Asistente IA
              </strong>

              <span>
                Robot y automatización operativa
              </span>
            </div>

            <Icon
              name="arrow"
              size={16}
            />
          </Link>


          <Link
            href="/crm/pendientes"
            className={
              styles.systemCard
            }
          >
            <div
              className={
                styles.systemIcon
              }
            >
              <Icon
                name="file"
                size={20}
              />
            </div>

            <div>
              <strong>
                Archivos y migración
              </strong>

              <span>
                Datos pendientes de revisar
              </span>
            </div>

            <Icon
              name="arrow"
              size={16}
            />
          </Link>
        </section>
      </div>
    </main>
  );
}


function KpiCard({
  icon,
  label,
  value,
  detail,
  href,
  warning = false,
}: {
  icon: IconName;
  label: string;
  value: string | number;
  detail: string;
  href: string;
  warning?: boolean;
}) {
  return (
    <Link
      href={
        href
      }
      className={[
        styles.kpiCard,
        warning
          ? styles.kpiWarning
          : "",
      ].join(" ")}
    >
      <div
        className={
          styles.kpiTop
        }
      >
        <span
          className={
            styles.kpiIcon
          }
        >
          <Icon
            name={
              icon
            }
            size={17}
          />
        </span>

        <Icon
          name="arrow"
          size={15}
        />
      </div>

      <strong
        className={
          styles.kpiValue
        }
      >
        {value}
      </strong>

      <span
        className={
          styles.kpiLabel
        }
      >
        {label}
      </span>

      <small>
        {detail}
      </small>
    </Link>
  );
}


function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        styles.panel,
        className,
      ].join(" ")}
    >
      <header
        className={
          styles.panelHeader
        }
      >
        <div>
          <h2>
            {title}
          </h2>

          <p>
            {subtitle}
          </p>
        </div>

        {action}
      </header>

      <div
        className={
          styles.panelBody
        }
      >
        {children}
      </div>
    </section>
  );
}


function QualityRow({
  icon,
  label,
  value,
  total,
}: {
  icon: IconName;
  label: string;
  value: number;
  total: number;
}) {
  const percent =
    total
      ? Math.round(
          value
          /
          total
          *
          100,
        )
      : 0;

  return (
    <div
      className={
        styles.qualityRow
      }
    >
      <span
        className={
          styles.qualityIcon
        }
      >
        <Icon
          name={
            icon
          }
          size={15}
        />
      </span>

      <span
        className={
          styles.qualityLabel
        }
      >
        {label}
      </span>

      <div
        className={
          styles.miniProgress
        }
      >
        <span
          style={{
            width:
              `${percent}%`,
          }}
        />
      </div>

      <strong>
        {value}/{total}
      </strong>
    </div>
  );
}


function SummaryStat({
  value,
  label,
  warning = false,
}: {
  value: number;
  label: string;
  warning?: boolean;
}) {
  return (
    <div
      className={
        styles.summaryStat
      }
    >
      <strong
        className={
          warning
            ? styles.warningValue
            : undefined
        }
      >
        {value}
      </strong>

      <span>
        {label}
      </span>
    </div>
  );
}


function AdminStatus({
  icon,
  label,
  value,
  total,
}: {
  icon: IconName;
  label: string;
  value: number;
  total: number;
}) {
  return (
    <div
      className={
        styles.adminStatus
      }
    >
      <div
        className={
          styles.adminStatusIcon
        }
      >
        <Icon
          name={
            icon
          }
          size={17}
        />
      </div>

      <div>
        <span>
          {label}
        </span>

        <strong>
          {value}
          <small>
            /{total}
          </small>
        </strong>
      </div>
    </div>
  );
}


function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div
      className={
        styles.empty
      }
    >
      <Icon
        name="check"
        size={17}
      />

      <span>
        {text}
      </span>
    </div>
  );
}
