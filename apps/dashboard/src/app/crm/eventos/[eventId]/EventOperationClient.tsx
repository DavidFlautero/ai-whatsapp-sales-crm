"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import styles from "./event-operation.module.css";


type Row =
  Record<
    string,
    any
  >;


type Candidate = {
  provider: Row;
  profile?: Row;

  score: number;

  reasons:
    string[];

  source:
    "server"
    | "local";
};


function arrayFrom(
  value: unknown,
  keys: string[] = [],
): Row[] {
  if (
    Array.isArray(
      value,
    )
  ) {
    return value as Row[];
  }


  if (
    value
    &&
    typeof value
      === "object"
  ) {
    const object =
      value as Row;


    for (
      const key
      of [
        ...keys,
        "data",
        "items",
        "results",
        "events",
        "requirements",
        "providers",
        "profiles",
        "candidates",
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


function objectFrom(
  value: unknown,
  keys: string[] = [],
): Row | null {
  if (
    !value
    ||
    typeof value
      !== "object"
  ) {
    return null;
  }


  const object =
    value as Row;


  for (
    const key
    of keys
  ) {
    if (
      object[key]
      &&
      typeof object[key]
        === "object"
      &&
      !Array.isArray(
        object[key],
      )
    ) {
      return object[key];
    }
  }


  return object;
}


async function request(
  url: string,
  options?: RequestInit,
) {
  const response =
    await fetch(
      url,
      {
        cache:
          "no-store",

        credentials:
          "include",

        ...options,

        headers: {
          "Content-Type":
            "application/json",

          ...(
            options?.headers
            ?? {}
          ),
        },
      },
    );


  const text =
    await response.text();


  let body:
    any = null;


  if (
    text
  ) {
    try {
      body =
        JSON.parse(
          text,
        );
    }
    catch {
      body =
        text;
    }
  }


  if (
    !response.ok
  ) {
    throw new Error(
      body?.error
      ??
      body?.message
      ??
      `HTTP ${response.status}`,
    );
  }


  return body;
}


function normalize(
  value: unknown,
) {
  return String(
    value
    ?? "",
  )
    .normalize(
      "NFD",
    )
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}


function tokens(
  value: unknown,
) {
  return normalize(
    value,
  )
    .split(
      " ",
    )
    .filter(
      token =>
        token.length > 1,
    );
}


const CATEGORY_ALIASES:
  Record<
    string,
    string[]
  > = {

  dj: [
    "dj",
    "djs",
    "music",
    "musica",
    "disc jockey",
    "animation",
  ],

  catering: [
    "catering",
    "food",
    "comida",
    "cocina",
    "banquete",
  ],

  sound: [
    "sound",
    "sonido",
    "audio",
    "pa",
  ],

  light: [
    "light",
    "lights",
    "lighting",
    "luz",
    "luces",
    "iluminacion",
  ],

  photo: [
    "photo",
    "photography",
    "fotografia",
    "fotografo",
    "foto",
  ],

  video: [
    "video",
    "videography",
    "videografo",
    "360",
  ],

  decoration: [
    "decoration",
    "decoracion",
    "decor",
    "flores",
    "flowers",
  ],

  furniture: [
    "furniture",
    "mobiliario",
    "chairs",
    "sillas",
    "tables",
    "mesas",
  ],

  transport: [
    "transport",
    "transporte",
    "bus",
    "autocar",
    "taxi",
    "limousine",
    "limusina",
    "cars",
  ],

  security: [
    "security",
    "seguridad",
    "vigilancia",
  ],

  staff: [
    "staff",
    "personal",
    "waiter",
    "camarero",
    "camareros",
    "chef",
    "cocineros",
  ],

  venue: [
    "venue",
    "espacio",
    "chalet",
    "masia",
    "salon",
    "local",
  ],
};


function requirementLabel(
  requirement: Row,
) {
  return String(
    requirement
      .category_name
    ??
    requirement
      .service_name
    ??
    requirement
      .name
    ??
    requirement
      .title
    ??
    requirement
      .category
      ?.name
    ??
    "Servicio",
  );
}


function expandedTerms(
  label: string,
) {
  const normalized =
    normalize(
      label,
    );


  const result =
    new Set(
      tokens(
        normalized,
      ),
    );


  for (
    const [
      key,
      aliases,
    ]
    of Object.entries(
      CATEGORY_ALIASES,
    )
  ) {
    const match =
      normalized.includes(
        key,
      )
      ||
      aliases.some(
        alias =>
          normalized.includes(
            normalize(
              alias,
            ),
          ),
      );


    if (
      match
    ) {
      result.add(
        key,
      );


      for (
        const alias
        of aliases
      ) {
        result.add(
          normalize(
            alias,
          ),
        );
      }
    }
  }


  return [
    ...result,
  ];
}


function providerTerms(
  provider: Row,
  profile?: Row,
) {
  /*
   * IMPORTANTE:
   * service_categories y provider_type son la fuente principal.
   * NO clasificamos a Bandana como DJ por contener "banda".
   */
  const categories =
    Array.isArray(
      profile
        ?.service_categories,
    )
      ? profile
          ?.service_categories
      : [];


  const explicit =
    [
      ...categories,
      profile
        ?.provider_type,
      provider
        ?.type,
    ]
      .filter(
        Boolean,
      )
      .map(
        normalize,
      );


  const result =
    new Set<string>();


  for (
    const item
    of explicit
  ) {
    result.add(
      item,
    );


    for (
      const token
      of tokens(
        item,
      )
    ) {
      result.add(
        token,
      );
    }


    for (
      const [
        key,
        aliases,
      ]
      of Object.entries(
        CATEGORY_ALIASES,
      )
    ) {
      if (
        item.includes(
          key,
        )
        ||
        aliases.some(
          alias =>
            item.includes(
              normalize(
                alias,
              ),
            ),
        )
      ) {
        result.add(
          key,
        );


        for (
          const alias
          of aliases
        ) {
          result.add(
            normalize(
              alias,
            ),
          );
        }
      }
    }
  }


  return [
    ...result,
  ];
}


function localScore(
  requirement: Row,
  provider: Row,
  profile: Row | undefined,
  event: Row,
): Candidate | null {
  const wanted =
    expandedTerms(
      requirementLabel(
        requirement,
      ),
    );


  const offered =
    providerTerms(
      provider,
      profile,
    );


  let score =
    0;

  const reasons:
    string[] = [];


  const serviceMatches =
    wanted.filter(
      wantedTerm =>
        offered.some(
          offeredTerm =>
            offeredTerm
              === wantedTerm
            ||
            offeredTerm.includes(
              wantedTerm,
            )
            ||
            wantedTerm.includes(
              offeredTerm,
            ),
        ),
    );


  if (
    serviceMatches.length
  ) {
    score +=
      60;

    reasons.push(
      "Servicio compatible",
    );
  }
  else {
    /*
     * Si no coincide la categoría explícita,
     * no lo presentamos como candidato.
     */
    return null;
  }


  const eventCity =
    normalize(
      event.city,
    );

  const eventProvince =
    normalize(
      event.province,
    );

  const providerLocation =
    normalize(
      [
        provider.city,
        provider.province,
        provider.address,
        provider.service_area,
      ]
        .filter(
          Boolean,
        )
        .join(
          " ",
        ),
    );


  if (
    eventCity
    &&
    providerLocation
      .includes(
        eventCity,
      )
  ) {
    score +=
      18;

    reasons.push(
      "Misma ciudad/zona",
    );
  }
  else if (
    eventProvince
    &&
    providerLocation
      .includes(
        eventProvince,
      )
  ) {
    score +=
      10;

    reasons.push(
      "Misma provincia",
    );
  }


  if (
    provider.whatsapp
  ) {
    score +=
      7;

    reasons.push(
      "WhatsApp disponible",
    );
  }
  else if (
    provider.phone
  ) {
    score +=
      5;

    reasons.push(
      "Teléfono disponible",
    );
  }


  if (
    provider.email
  ) {
    score +=
      3;
  }


  if (
    profile
      ?.commercial_conditions
  ) {
    score +=
      5;

    reasons.push(
      "Condiciones comerciales registradas",
    );
  }


  if (
    profile
      ?.factual_notes
    ||
    profile
      ?.factual_summary
  ) {
    score +=
      3;

    reasons.push(
      "Perfil documentado",
    );
  }


  return {
    provider,
    profile,
    score,
    reasons,
    source:
      "local",
  };
}


function money(
  value: unknown,
) {
  const numeric =
    Number(
      value
      ?? 0,
    );


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
    Number.isFinite(
      numeric,
    )
      ? numeric
      : 0,
  );
}


function dateText(
  value: unknown,
) {
  if (
    !value
  ) {
    return "Sin fecha";
  }


  const date =
    new Date(
      `${String(
        value,
      ).slice(
        0,
        10,
      )}T12:00:00`,
    );


  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return String(
      value,
    );
  }


  return new Intl.DateTimeFormat(
    "es-ES",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",
    },
  ).format(
    date,
  );
}


function timeText(
  value: unknown,
) {
  if (
    !value
  ) {
    return "—";
  }


  return String(
    value,
  ).slice(
    0,
    5,
  );
}


function statusLabel(
  value: unknown,
) {
  const status =
    normalize(
      value,
    );


  const labels:
    Record<
      string,
      string
    > = {
    lead:
      "Lead",

    planning:
      "Planificación",

    pending:
      "Pendiente",

    reserved:
      "Reservado",

    confirmed:
      "Confirmado",

    approved:
      "Confirmado",

    cancelled:
      "Cancelado",

    completed:
      "Completado",
  };


  return (
    labels[
      status
    ]
    ??
    String(
      value
      ?? "Sin estado",
    )
  );
}


export default function EventOperationClient({
  eventId,
}: {
  eventId: string;
}) {
  const [
    event,
    setEvent,
  ] =
    useState<Row | null>(
      null,
    );


  const [
    requirements,
    setRequirements,
  ] =
    useState<Row[]>(
      [],
    );


  const [
    providers,
    setProviders,
  ] =
    useState<Row[]>(
      [],
    );


  const [
    profiles,
    setProfiles,
  ] =
    useState<Row[]>(
      [],
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );


  const [
    error,
    setError,
  ] =
    useState(
      "",
    );


  const [
    searchingAll,
    setSearchingAll,
  ] =
    useState(
      false,
    );


  const [
    activeRequirementId,
    setActiveRequirementId,
  ] =
    useState<
      string
      | null
    >(
      null,
    );


  const [
    candidateMap,
    setCandidateMap,
  ] =
    useState<
      Record<
        string,
        Candidate[]
      >
    >(
      {},
    );


  const [
    assigningKey,
    setAssigningKey,
  ] =
    useState(
      "",
    );


  const profileMap =
    useMemo(
      () =>
        new Map(
          profiles.map(
            profile => [
              String(
                profile
                  .provider_id,
              ),
              profile,
            ],
          ),
        ),
      [
        profiles,
      ],
    );


  const load =
    useCallback(
      async () => {
        setError(
          "",
        );


        try {
          const [
            eventBody,
            requirementsBody,
            providersBody,
            profilesBody,
          ] =
            await Promise.all([
              request(
                `/api/crm/events/${eventId}`,
              ),

              request(
                `/api/crm/events/${eventId}/requirements`,
              ),

              request(
                "/api/crm/providers?limit=500",
              ),

              request(
                "/api/crm/provider-profiles?limit=500",
              ),
            ]);


          setEvent(
            objectFrom(
              eventBody,
              [
                "event",
                "data",
              ],
            ),
          );


          setRequirements(
            arrayFrom(
              requirementsBody,
              [
                "requirements",
              ],
            ),
          );


          setProviders(
            arrayFrom(
              providersBody,
              [
                "providers",
              ],
            ),
          );


          setProfiles(
            arrayFrom(
              profilesBody,
              [
                "profiles",
              ],
            ),
          );
        }
        catch (
          loadError
        ) {
          setError(
            loadError
              instanceof Error
              ? loadError.message
              : "No se pudo cargar el evento.",
          );
        }
        finally {
          setLoading(
            false,
          );
        }
      },
      [
        eventId,
      ],
    );


  useEffect(
    () => {
      void load();
    },
    [
      load,
    ],
  );


  async function searchRequirement(
    requirement: Row,
  ) {
    if (
      !event
    ) {
      return;
    }


    const requirementId =
      String(
        requirement.id,
      );


    setActiveRequirementId(
      requirementId,
    );


    /*
     * PRIMERA OPCIÓN:
     * usar el motor del backend que ya existe.
     */
    try {
      const body =
        await request(
          `/api/crm/events/${eventId}/requirements/${requirementId}/provider-candidates`,
        );


      const serverCandidates =
        arrayFrom(
          body,
          [
            "candidates",
            "providers",
          ],
        );


      if (
        serverCandidates.length
      ) {
        const mapped =
          serverCandidates
            .map(
              item => {
                const provider =
                  item.provider
                  ??
                  item;


                return {
                  provider,

                  profile:
                    profileMap.get(
                      String(
                        provider.id,
                      ),
                    ),

                  score:
                    Number(
                      item.score
                      ??
                      item.match_score
                      ??
                      item.rank_score
                      ??
                      100,
                    ),

                  reasons:
                    Array.isArray(
                      item.reasons,
                    )
                      ? item.reasons
                      : [
                          "Motor de matching del CRM",
                        ],

                  source:
                    "server" as const,
                };
              },
            )
            .filter(
              candidate =>
                Boolean(
                  candidate
                    .provider
                    ?.id,
                ),
            );


        if (
          mapped.length
        ) {
          setCandidateMap(
            current => ({
              ...current,

              [
                requirementId
              ]:
                mapped,
            }),
          );


          return;
        }
      }
    }
    catch {
      /*
       * Si esa ruta no está activa en esta versión,
       * hacemos el barrido completo local.
       */
    }


    /*
     * FALLBACK:
     * recorrer TODOS los proveedores.
     */
    const local =
      providers
        .map(
          provider =>
            localScore(
              requirement,
              provider,
              profileMap.get(
                String(
                  provider.id,
                ),
              ),
              event,
            ),
        )
        .filter(
          (
            candidate,
          ): candidate is Candidate =>
            Boolean(
              candidate,
            ),
        )
        .sort(
          (
            a,
            b,
          ) =>
            b.score
            -
            a.score,
        );


    setCandidateMap(
      current => ({
        ...current,

        [
          requirementId
        ]:
          local,
      }),
    );
  }


  async function searchAll() {
    const pending =
      requirements.filter(
        requirement =>
          !(
            requirement
              .assigned_provider_id
            ??
            requirement
              .provider_id
          ),
      );


    if (
      !pending.length
    ) {
      return;
    }


    setSearchingAll(
      true,
    );


    try {
      for (
        const requirement
        of pending
      ) {
        await searchRequirement(
          requirement,
        );
      }


      if (
        pending[0]
      ) {
        setActiveRequirementId(
          String(
            pending[0].id,
          ),
        );
      }
    }
    finally {
      setSearchingAll(
        false,
      );
    }
  }


  async function assignProvider(
    requirement: Row,
    provider: Row,
  ) {
    const key =
      `${requirement.id}:${provider.id}`;


    setAssigningKey(
      key,
    );


    try {
      /*
       * Mismo contrato que ya usa EventServicesPanel:
       * assignedProviderId + serviceStatus.
       */
      await request(
        `/api/crm/events/${eventId}/requirements/${requirement.id}`,
        {
          method:
            "PATCH",

          body:
            JSON.stringify({
              assignedProviderId:
                provider.id,

              serviceStatus:
                "approved",
            }),
        },
      );


      await load();


      setActiveRequirementId(
        null,
      );
    }
    catch (
      assignError
    ) {
      setError(
        assignError
          instanceof Error
          ? assignError.message
          : "No se pudo asignar el proveedor.",
      );
    }
    finally {
      setAssigningKey(
        "",
      );
    }
  }


  if (
    loading
  ) {
    return (
      <main
        className={
          styles.page
        }
      >
        <div
          className={
            styles.loading
          }
        >
          Cargando evento…
        </div>
      </main>
    );
  }


  if (
    !event
  ) {
    return (
      <main
        className={
          styles.page
        }
      >
        <div
          className={
            styles.errorBox
          }
        >
          <strong>
            No se encontró el evento.
          </strong>

          <span>
            {error}
          </span>

          <Link
            href="/crm/eventos"
          >
            Volver a eventos
          </Link>
        </div>
      </main>
    );
  }


  const pendingCount =
    requirements.filter(
      requirement =>
        !(
          requirement
            .assigned_provider_id
          ??
          requirement
            .provider_id
        ),
    ).length;


  const assignedCount =
    requirements.length
    -
    pendingCount;


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
        <div
          className={
            styles.backRow
          }
        >
          <Link
            href="/crm/eventos"
          >
            ← Eventos
          </Link>

          <span>
            ID {eventId}
          </span>
        </div>


        <header
          className={
            styles.hero
          }
        >
          <div
            className={
              styles.heroMain
            }
          >
            <div
              className={
                styles.eyebrow
              }
            >
              {
                event.event_type
                ??
                "Evento"
              }
            </div>

            <h1>
              {
                event.title
                ??
                "Evento sin título"
              }
            </h1>

            <div
              className={
                styles.heroMeta
              }
            >
              <span>
                {
                  dateText(
                    event.event_date,
                  )
                }
              </span>

              <span>
                {
                  timeText(
                    event.start_time,
                  )
                }
                {" – "}
                {
                  timeText(
                    event.end_time,
                  )
                }
              </span>

              <span>
                {
                  event.guest_count
                  ??
                  "—"
                }
                {" personas"}
              </span>

              <span>
                {
                  event.city
                  ??
                  "Ubicación pendiente"
                }
              </span>
            </div>
          </div>


          <div
            className={
              styles.heroActions
            }
          >
            <span
              className={
                styles.status
              }
            >
              {
                statusLabel(
                  event.status,
                )
              }
            </span>

            <button
              type="button"
              className={
                styles.primary
              }
              disabled={
                searchingAll
                ||
                pendingCount
                  === 0
              }
              onClick={
                () =>
                  void searchAll()
              }
            >
              {
                searchingAll
                  ? "Buscando en todos…"
                  : "Buscar proveedores automáticamente"
              }
            </button>
          </div>
        </header>


        {
          error
          ? (
              <div
                className={
                  styles.inlineError
                }
              >
                {error}
              </div>
            )
          : null
        }


        <section
          className={
            styles.metrics
          }
        >
          <Metric
            label="Servicios"
            value={
              requirements.length
            }
          />

          <Metric
            label="Confirmados"
            value={
              assignedCount
            }
          />

          <Metric
            label="Sin proveedor"
            value={
              pendingCount
            }
            warning={
              pendingCount
                > 0
            }
          />

          <Metric
            label="Presupuesto"
            value={
              money(
                event.target_budget,
              )
            }
          />

          <Metric
            label="Precio cliente"
            value={
              money(
                event.final_client_price,
              )
            }
          />

          <Metric
            label="Margen"
            value={
              money(
                event.gross_margin,
              )
            }
          />
        </section>


        <div
          className={
            styles.grid
          }
        >
          <section
            className={
              styles.panel
            }
          >
            <div
              className={
                styles.panelHeader
              }
            >
              <div>
                <span>
                  OPERACIÓN
                </span>

                <h2>
                  Servicios y proveedores
                </h2>

                <p>
                  Cada necesidad se gestiona dentro de este evento.
                </p>
              </div>

              <button
                type="button"
                className={
                  styles.secondary
                }
                onClick={
                  () =>
                    void searchAll()
                }
                disabled={
                  searchingAll
                }
              >
                Barrer todos los proveedores
              </button>
            </div>


            <div
              className={
                styles.requirements
              }
            >
              {
                requirements.length
                  === 0
                ? (
                    <div
                      className={
                        styles.empty
                      }
                    >
                      Este evento todavía no tiene servicios registrados.
                    </div>
                  )
                : requirements.map(
                    requirement => {
                      const id =
                        String(
                          requirement.id,
                        );


                      const assignedProviderId =
                        requirement
                          .assigned_provider_id
                        ??
                        requirement
                          .provider_id;


                      const provider =
                        providers.find(
                          item =>
                            String(
                              item.id,
                            )
                            ===
                            String(
                              assignedProviderId
                              ?? "",
                            ),
                        );


                      const candidates =
                        candidateMap[
                          id
                        ]
                        ?? [];


                      const open =
                        activeRequirementId
                        === id;


                      return (
                        <article
                          key={
                            id
                          }
                          className={
                            styles.requirement
                          }
                        >
                          <div
                            className={
                              styles.requirementTop
                            }
                          >
                            <div>
                              <span
                                className={
                                  styles.requirementCategory
                                }
                              >
                                {
                                  requirementLabel(
                                    requirement,
                                  )
                                }
                              </span>

                              <strong>
                                {
                                  provider
                                    ?.name
                                  ??
                                  requirement
                                    .provider_name
                                  ??
                                  "Sin proveedor"
                                }
                              </strong>

                              <small>
                                {
                                  assignedProviderId
                                    ? `Estado: ${statusLabel(
                                        requirement
                                          .status
                                        ??
                                        requirement
                                          .service_status
                                        ??
                                        "approved",
                                      )}`
                                    : "Pendiente de asignar"
                                }
                              </small>
                            </div>


                            <div
                              className={
                                styles.requirementActions
                              }
                            >
                              {
                                !assignedProviderId
                                  ? (
                                      <button
                                        type="button"
                                        className={
                                          styles.searchButton
                                        }
                                        onClick={
                                          () =>
                                            void searchRequirement(
                                              requirement,
                                            )
                                        }
                                      >
                                        Buscar proveedores
                                      </button>
                                    )
                                  : (
                                      <button
                                        type="button"
                                        className={
                                          styles.secondary
                                        }
                                        onClick={
                                          () =>
                                            void searchRequirement(
                                              requirement,
                                            )
                                        }
                                      >
                                        Buscar alternativa
                                      </button>
                                    )
                              }
                            </div>
                          </div>


                          {
                            open
                            ? (
                                <div
                                  className={
                                    styles.candidates
                                  }
                                >
                                  <div
                                    className={
                                      styles.candidateHeader
                                    }
                                  >
                                    <div>
                                      <strong>
                                        Proveedores compatibles
                                      </strong>

                                      <span>
                                        {
                                          candidates.length
                                        }
                                        {" encontrados tras revisar "}
                                        {
                                          providers.length
                                        }
                                        {" proveedores"}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      className={
                                        styles.textButton
                                      }
                                      onClick={
                                        () =>
                                          setActiveRequirementId(
                                            null,
                                          )
                                      }
                                    >
                                      Cerrar
                                    </button>
                                  </div>


                                  {
                                    candidates.length
                                      === 0
                                    ? (
                                        <div
                                          className={
                                            styles.emptyCandidates
                                          }
                                        >
                                          No encontramos un proveedor con categoría explícitamente compatible.
                                          No se usarán coincidencias por nombre.
                                        </div>
                                      )
                                    : (
                                        <div
                                          className={
                                            styles.candidateList
                                          }
                                        >
                                          {
                                            candidates
                                              .slice(
                                                0,
                                                30,
                                              )
                                              .map(
                                                (
                                                  candidate,
                                                  index,
                                                ) => {
                                                  const candidateProvider =
                                                    candidate
                                                      .provider;


                                                  const phone =
                                                    candidateProvider
                                                      .whatsapp
                                                    ??
                                                    candidateProvider
                                                      .phone;


                                                  const assignKey =
                                                    `${id}:${candidateProvider.id}`;


                                                  return (
                                                    <div
                                                      key={
                                                        candidateProvider.id
                                                        ??
                                                        index
                                                      }
                                                      className={
                                                        styles.candidate
                                                      }
                                                    >
                                                      <div
                                                        className={
                                                          styles.rank
                                                        }
                                                      >
                                                        {
                                                          index
                                                          +
                                                          1
                                                        }
                                                      </div>


                                                      <div
                                                        className={
                                                          styles.candidateInfo
                                                        }
                                                      >
                                                        <strong>
                                                          {
                                                            candidateProvider.name
                                                          }
                                                        </strong>

                                                        <span>
                                                          {
                                                            [
                                                              candidateProvider.city,
                                                              candidateProvider.province,
                                                              phone,
                                                            ]
                                                              .filter(
                                                                Boolean,
                                                              )
                                                              .join(
                                                                " · ",
                                                              )
                                                            ||
                                                            "Sin datos de contacto"
                                                          }
                                                        </span>

                                                        <div
                                                          className={
                                                            styles.reasonRow
                                                          }
                                                        >
                                                          {
                                                            candidate
                                                              .reasons
                                                              .slice(
                                                                0,
                                                                4,
                                                              )
                                                              .map(
                                                                reason => (
                                                                  <small
                                                                    key={
                                                                      reason
                                                                    }
                                                                  >
                                                                    {
                                                                      reason
                                                                    }
                                                                  </small>
                                                                ),
                                                              )
                                                          }
                                                        </div>
                                                      </div>


                                                      <div
                                                        className={
                                                          styles.candidateScore
                                                        }
                                                      >
                                                        <span>
                                                          {
                                                            Math.round(
                                                              candidate.score,
                                                            )
                                                          }
                                                        </span>

                                                        <small>
                                                          score
                                                        </small>
                                                      </div>


                                                      <button
                                                        type="button"
                                                        className={
                                                          styles.assign
                                                        }
                                                        disabled={
                                                          assigningKey
                                                          ===
                                                          assignKey
                                                        }
                                                        onClick={
                                                          () =>
                                                            void assignProvider(
                                                              requirement,
                                                              candidateProvider,
                                                            )
                                                        }
                                                      >
                                                        {
                                                          assigningKey
                                                          ===
                                                          assignKey
                                                            ? "Asignando…"
                                                            : "Seleccionar"
                                                        }
                                                      </button>
                                                    </div>
                                                  );
                                                },
                                              )
                                          }
                                        </div>
                                      )
                                  }
                                </div>
                              )
                            : null
                          }
                        </article>
                      );
                    },
                  )
              }
            </div>
          </section>


          <aside
            className={
              styles.side
            }
          >
            <section
              className={
                styles.panel
              }
            >
              <div
                className={
                  styles.panelHeader
                }
              >
                <div>
                  <span>
                    EVENTO
                  </span>

                  <h2>
                    Información
                  </h2>
                </div>
              </div>


              <div
                className={
                  styles.dataList
                }
              >
                <DataRow
                  label="Fecha"
                  value={
                    dateText(
                      event.event_date,
                    )
                  }
                />

                <DataRow
                  label="Horario"
                  value={
                    `${timeText(
                      event.start_time,
                    )} – ${timeText(
                      event.end_time,
                    )}`
                  }
                />

                <DataRow
                  label="Invitados"
                  value={
                    String(
                      event.guest_count
                      ??
                      "—",
                    )
                  }
                />

                <DataRow
                  label="Lugar"
                  value={
                    event.venue_name
                    ??
                    "Pendiente"
                  }
                />

                <DataRow
                  label="Dirección"
                  value={
                    event.venue_address
                    ??
                    "Pendiente"
                  }
                />

                <DataRow
                  label="Ciudad"
                  value={
                    event.city
                    ??
                    "Pendiente"
                  }
                />

                <DataRow
                  label="Estado"
                  value={
                    statusLabel(
                      event.status,
                    )
                  }
                />
              </div>
            </section>


            <section
              className={
                styles.panel
              }
            >
              <div
                className={
                  styles.panelHeader
                }
              >
                <div>
                  <span>
                    CLIENTE
                  </span>

                  <h2>
                    Solicitud
                  </h2>
                </div>
              </div>

              <div
                className={
                  styles.requestText
                }
              >
                {
                  event.customer_request
                  ??
                  "Sin solicitud registrada."
                }
              </div>
            </section>


            <section
              className={
                styles.panel
              }
            >
              <div
                className={
                  styles.panelHeader
                }
              >
                <div>
                  <span>
                    SIGUIENTE PASO
                  </span>

                  <h2>
                    Acción
                  </h2>
                </div>
              </div>

              <div
                className={
                  styles.nextAction
                }
              >
                {
                  event.next_action
                  ??
                  "Sin acción pendiente"
                }
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}


function Metric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <div
      className={[
        styles.metric,
        warning
          ? styles.metricWarning
          : "",
      ].join(
        " ",
      )}
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}


function DataRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className={
        styles.dataRow
      }
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}
