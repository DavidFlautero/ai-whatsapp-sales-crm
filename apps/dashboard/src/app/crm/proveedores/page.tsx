"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import styles from "./proveedores.module.css";


type Provider = {
  id: string;

  name?: string | null;
  contact_name?: string | null;

  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;

  city?: string | null;
  province?: string | null;
  service_area?: string | null;

  notes?: string | null;

  status?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
};


type ProviderProfile = {
  id?: string;

  provider_id: string;

  provider_type?: string | null;

  service_categories?: string[] | null;

  commercial_relationship?: string | null;
  relationship?: string | null;

  factual_summary?: string | null;
  factual_notes?: string | null;

  known_preferences?: unknown;

  commercial_conditions?: unknown;

  source_metadata?: unknown;

  created_at?: string | null;
  updated_at?: string | null;
};


type CategoryDefinition = {
  id: string;
  label: string;
  shortLabel: string;

  keywords: string[];

  types?: string[];
};


type EnrichedProvider = {
  provider: Provider;
  profile?: ProviderProfile;

  categoryId: string;

  completion: number;

  missing: string[];
};


const CATEGORIES: CategoryDefinition[] = [
  {
    id: "dj-music",
    label: "DJs, música y conjuntos",
    shortLabel: "DJs / Música",

    keywords: [
      "dj",
      "musica",
      "music",
      "cantante",
      "orquesta",
      "grupo",
      "conjunto",
      "banda",
      "gala records",
      "productor musical",
    ],
  },

  {
    id: "catering",
    label: "Catering",
    shortLabel: "Catering",

    keywords: [
      "catering",
      "cocinero",
      "cocinera",
      "cook",
      "food",
      "comida",
      "bebida",
      "paella",
      "restaurante",
      "ultramarino",
      "menu",
      "menú",
    ],
  },

  {
    id: "sound-light",
    label: "Sonido y luces",
    shortLabel: "Sonido / Luces",

    keywords: [
      "sonido",
      "sound",
      "luces",
      "lighting",
      "iluminacion",
      "iluminación",
      "equipo",
      "altavoz",
      "microfono",
      "micrófono",
      "technical",
      "reparaciones",
    ],
  },

  {
    id: "photo-video",
    label: "Foto y vídeo",
    shortLabel: "Foto / Vídeo",

    keywords: [
      "foto",
      "fotogra",
      "video",
      "vídeo",
      "videogra",
      "360",
      "camara",
      "cámara",
      "media_provider",
    ],
  },

  {
    id: "decoration",
    label: "Decoración",
    shortLabel: "Decoración",

    keywords: [
      "decor",
      "flor",
      "ambient",
    ],

    types: [
      "decoration_provider",
    ],
  },

  {
    id: "furniture",
    label: "Mobiliario",
    shortLabel: "Mobiliario",

    keywords: [
      "mobiliario",
      "furniture",
      "chair",
      "silla",
      "mesa",
    ],

    types: [
      "furniture_provider",
    ],
  },

  {
    id: "transport",
    label: "Transporte",
    shortLabel: "Transporte",

    keywords: [
      "transport",
      "bus",
      "autocar",
      "taxi",
      "limusina",
      "coche",
      "vehiculo",
      "vehículo",
      "conductor",
      "furgoneta",
      "eventscars",
      "massabus",
    ],

    types: [
      "transport_provider",
    ],
  },

  {
    id: "staff",
    label: "Personal y seguridad",
    shortLabel: "Personal",

    keywords: [
      "staff",
      "camarero",
      "camarera",
      "waiter",
      "seguridad",
      "personal",
      "azafata",
      "hospitality",
      "kitchen_staff",
      "event_staff",
    ],

    types: [
      "staff_provider",
      "security_provider",
    ],
  },

  {
    id: "real-estate",
    label: "Inmobiliario",
    shortLabel: "Inmobiliario",

    keywords: [
      "real_estate",
      "inmobili",
      "property",
      "comprador",
      "venta",
      "inversor",
      "traspaso",
    ],

    types: [
      "real_estate_partner",
      "partner_lead",
    ],
  },

  {
    id: "owners",
    label: "Propietarios de espacios",
    shortLabel: "Propietarios",

    keywords: [
      "owner",
      "chalet",
      "venue",
      "propietario",
      "propietaria",
      "finca",
      "masia",
      "masía",
    ],

    types: [
      "owner",
      "owner_contact",
      "partner_owner",
    ],
  },

  {
    id: "other",
    label: "Otros servicios",
    shortLabel: "Otros",

    keywords: [],
  },
];


function normalize(
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
    )
    .trim();
}


function extractArray(
  value: unknown,
): any[] {
  if (
    Array.isArray(value)
  ) {
    return value;
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const object =
      value as Record<
        string,
        unknown
      >;

    for (
      const key
      of [
        "data",
        "items",
        "results",
        "providers",
        "profiles",
      ]
    ) {
      if (
        Array.isArray(
          object[key],
        )
      ) {
        return object[key] as any[];
      }
    }
  }

  return [];
}


function safeText(
  value: unknown,
) {
  if (
    value === undefined
    ||
    value === null
    ||
    value === ""
  ) {
    return "—";
  }

  if (
    typeof value === "string"
  ) {
    return value;
  }

  try {
    return JSON.stringify(
      value,
      null,
      2,
    );
  } catch {
    return String(value);
  }
}


function providerSearchText(
  provider: Provider,
  profile?: ProviderProfile,
) {
  return normalize(
    [
      provider.name,
      provider.contact_name,

      provider.phone,
      provider.whatsapp,
      provider.email,

      provider.city,
      provider.province,
      provider.service_area,

      provider.notes,

      profile?.provider_type,

      profile?.commercial_relationship,
      profile?.relationship,

      profile?.factual_summary,
      profile?.factual_notes,

      ...(
        profile
          ?.service_categories
        ?? []
      ),
    ].join(" "),
  );
}


function resolveCategory(
  provider: Provider,
  profile?: ProviderProfile,
) {
  const text =
    providerSearchText(
      provider,
      profile,
    );

  const providerType =
    normalize(
      profile
        ?.provider_type,
    );

  for (
    const category
    of CATEGORIES
  ) {
    if (
      category.id ===
      "other"
    ) {
      continue;
    }

    if (
      category.types
        ?.some(
          type =>
            normalize(type)
            === providerType,
        )
    ) {
      return category.id;
    }

    if (
      category.keywords
        .some(
          keyword =>
            text.includes(
              normalize(
                keyword,
              ),
            ),
        )
    ) {
      return category.id;
    }
  }

  return "other";
}


function calculateCompletion(
  provider: Provider,
  profile?: ProviderProfile,
) {
  const fields = [
    Boolean(
      provider.name,
    ),

    Boolean(
      provider.contact_name,
    ),

    Boolean(
      provider.phone
      ||
      provider.whatsapp,
    ),

    Boolean(
      provider.city
      ||
      provider.service_area,
    ),

    Boolean(
      profile,
    ),

    Boolean(
      profile
        ?.service_categories
        ?.length,
    ),
  ];

  const complete =
    fields.filter(Boolean)
      .length;

  return Math.round(
    (
      complete
      /
      fields.length
    )
    * 100,
  );
}


function missingFields(
  provider: Provider,
  profile?: ProviderProfile,
) {
  const result:
    string[] = [];

  if (
    !provider.contact_name
  ) {
    result.push(
      "Contacto",
    );
  }

  if (
    !provider.phone
    &&
    !provider.whatsapp
  ) {
    result.push(
      "Teléfono",
    );
  }

  if (
    !provider.city
    &&
    !provider.service_area
  ) {
    result.push(
      "Zona",
    );
  }

  if (
    !profile
  ) {
    result.push(
      "Perfil",
    );
  }

  if (
    profile
    &&
    !profile
      .service_categories
      ?.length
  ) {
    result.push(
      "Servicios",
    );
  }

  return result;
}


function categoryName(
  categoryId: string,
) {
  return (
    CATEGORIES.find(
      category =>
        category.id ===
        categoryId,
    )?.shortLabel
    ??
    "Otros"
  );
}


function formatDate(
  value?: string | null,
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
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


function cleanPhone(
  value?: string | null,
) {
  return String(
    value ?? "",
  ).replace(
    /[^+\d]/g,
    "",
  );
}


export default function ProveedoresPage() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const [
    providers,
    setProviders,
  ] =
    useState<
      Provider[]
    >([]);

  const [
    profiles,
    setProfiles,
  ] =
    useState<
      ProviderProfile[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    completionFilter,
    setCompletionFilter,
  ] =
    useState<
      "all"
      |
      "complete"
      |
      "pending"
    >("all");

  const [
    zoneFilter,
    setZoneFilter,
  ] =
    useState(
      "all",
    );

  const [
    selectedId,
    setSelectedId,
  ] =
    useState<
      string | null
    >(null);


  const categoryParam =
    searchParams.get(
      "category",
    );

  const selectedCategory =
    CATEGORIES.some(
      category =>
        category.id ===
        categoryParam,
    )
      ? categoryParam!
      : "all";


  useEffect(
    () => {
      let cancelled =
        false;

      async function load() {
        setLoading(true);
        setError(null);

        try {
          const [
            providersResponse,
            profilesResponse,
          ] =
            await Promise.all([
              fetch(
                "/api/crm/providers?limit=500",
                {
                  credentials:
                    "include",

                  cache:
                    "no-store",
                },
              ),

              fetch(
                "/api/crm/provider-profiles?limit=500",
                {
                  credentials:
                    "include",

                  cache:
                    "no-store",
                },
              ),
            ]);

          if (
            !providersResponse.ok
          ) {
            throw new Error(
              `Providers HTTP ${providersResponse.status}`,
            );
          }

          const providersBody =
            await providersResponse.json();

          let profilesBody:
            unknown = [];

          if (
            profilesResponse.ok
          ) {
            profilesBody =
              await profilesResponse.json();
          }

          if (
            !cancelled
          ) {
            setProviders(
              extractArray(
                providersBody,
              ),
            );

            setProfiles(
              extractArray(
                profilesBody,
              ),
            );
          }
        } catch (
          loadError
        ) {
          console.error(
            loadError,
          );

          if (
            !cancelled
          ) {
            setError(
              "No se pudo cargar el directorio de proveedores.",
            );
          }
        } finally {
          if (
            !cancelled
          ) {
            setLoading(
              false,
            );
          }
        }
      }

      load();

      return () => {
        cancelled =
          true;
      };
    },
    [],
  );


  const profileMap =
    useMemo(
      () =>
        new Map(
          profiles.map(
            profile => [
              profile.provider_id,
              profile,
            ],
          ),
        ),
      [
        profiles,
      ],
    );


  const enriched =
    useMemo<
      EnrichedProvider[]
    >(
      () =>
        providers.map(
          provider => {
            const profile =
              profileMap.get(
                provider.id,
              );

            return {
              provider,

              profile,

              categoryId:
                resolveCategory(
                  provider,
                  profile,
                ),

              completion:
                calculateCompletion(
                  provider,
                  profile,
                ),

              missing:
                missingFields(
                  provider,
                  profile,
                ),
            };
          },
        ),
      [
        providers,
        profileMap,
      ],
    );


  const zones =
    useMemo(
      () => {
        const values =
          new Set<
            string
          >();

        for (
          const item
          of enriched
        ) {
          const zone =
            item.provider.city
            ||
            item.provider
              .province
            ||
            item.provider
              .service_area;

          if (zone) {
            values.add(
              zone,
            );
          }
        }

        return [
          ...values,
        ].sort(
          (
            a,
            b,
          ) =>
            a.localeCompare(
              b,
              "es",
            ),
        );
      },
      [
        enriched,
      ],
    );


  const filtered =
    useMemo(
      () => {
        const search =
          normalize(
            query,
          );

        return enriched
          .filter(
            item => {
              if (
                selectedCategory
                  !== "all"
                &&
                item.categoryId
                  !== selectedCategory
              ) {
                return false;
              }

              if (
                zoneFilter
                  !== "all"
              ) {
                const zoneText =
                  normalize(
                    [
                      item
                        .provider
                        .city,

                      item
                        .provider
                        .province,

                      item
                        .provider
                        .service_area,
                    ].join(
                      " ",
                    ),
                  );

                if (
                  !zoneText.includes(
                    normalize(
                      zoneFilter,
                    ),
                  )
                ) {
                  return false;
                }
              }

              if (
                completionFilter
                  === "complete"
                &&
                item.completion
                  < 100
              ) {
                return false;
              }

              if (
                completionFilter
                  === "pending"
                &&
                item.completion
                  === 100
              ) {
                return false;
              }

              if (
                search
                &&
                !providerSearchText(
                  item.provider,
                  item.profile,
                ).includes(
                  search,
                )
              ) {
                return false;
              }

              return true;
            },
          )
          .sort(
            (
              a,
              b,
            ) =>
              String(
                a.provider.name
                ?? "",
              ).localeCompare(
                String(
                  b.provider.name
                  ?? "",
                ),
                "es",
              ),
          );
      },
      [
        enriched,
        selectedCategory,
        zoneFilter,
        completionFilter,
        query,
      ],
    );


  const selected =
    useMemo(
      () =>
        enriched.find(
          item =>
            item.provider.id
            === selectedId,
        )
        ??
        null,
      [
        enriched,
        selectedId,
      ],
    );


  const totalCurrentCategory =
    useMemo(
      () =>
        selectedCategory
          === "all"
          ? enriched.length
          : enriched.filter(
              item =>
                item.categoryId
                === selectedCategory,
            ).length,
      [
        enriched,
        selectedCategory,
      ],
    );


  const completeCount =
    useMemo(
      () =>
        enriched.filter(
          item => {
            if (
              selectedCategory
                !== "all"
              &&
              item.categoryId
                !== selectedCategory
            ) {
              return false;
            }

            return (
              item.completion
              === 100
            );
          },
        ).length,
      [
        enriched,
        selectedCategory,
      ],
    );


  const pendingCount =
    totalCurrentCategory
    -
    completeCount;


  const title =
    selectedCategory
      === "all"
      ? "Directorio de proveedores"
      : (
          CATEGORIES.find(
            category =>
              category.id
              === selectedCategory,
          )?.label
          ??
          "Proveedores"
        );


  function clearFilters() {
    setQuery("");

    setZoneFilter(
      "all",
    );

    setCompletionFilter(
      "all",
    );
  }


  function goCategory(
    id: string,
  ) {
    setSelectedId(
      null,
    );

    if (
      id === "all"
    ) {
      router.push(
        "/crm/proveedores",
      );

      return;
    }

    router.push(
      `/crm/proveedores?category=${encodeURIComponent(
        id,
      )}`,
    );
  }


  return (
    <>
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
              styles.header
            }
          >
            <div>
              <div
                className={
                  styles.eyebrow
                }
              >
                CRM / PROVEEDORES
              </div>

              <h1
                className={
                  styles.title
                }
              >
                {title}
              </h1>

              <p
                className={
                  styles.subtitle
                }
              >
                Directorio comercial y operativo de Eventos Mediterráneo.
              </p>
            </div>

            <div
              className={
                styles.headerActions
              }
            >
              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={
                  clearFilters
                }
              >
                Limpiar filtros
              </button>

              <button
                type="button"
                className={
                  styles.primaryButton
                }
                onClick={() =>
                  router.push(
                    "/crm?view=admin",
                  )
                }
              >
                + Nuevo proveedor
              </button>
            </div>
          </header>


          <section
            className={
              styles.metricBar
            }
          >
            <Metric
              label="Proveedores"
              value={
                totalCurrentCategory
              }
            />

            <Metric
              label="Completos"
              value={
                completeCount
              }
            />

            <Metric
              label="Pendientes"
              value={
                pendingCount
              }
              warning={
                pendingCount > 0
              }
            />

            <Metric
              label="Resultados"
              value={
                filtered.length
              }
            />
          </section>


          <section
            className={
              styles.categoryStrip
            }
          >
            <button
              type="button"
              className={
                selectedCategory
                  === "all"
                  ? styles.categoryActive
                  : styles.categoryButton
              }
              onClick={() =>
                goCategory(
                  "all",
                )
              }
            >
              Todos

              <span>
                {
                  enriched.length
                }
              </span>
            </button>

            {
              CATEGORIES.map(
                category => {
                  const count =
                    enriched.filter(
                      item =>
                        item.categoryId
                        === category.id,
                    ).length;

                  return (
                    <button
                      type="button"
                      key={
                        category.id
                      }
                      className={
                        selectedCategory
                          === category.id
                          ? styles.categoryActive
                          : styles.categoryButton
                      }
                      onClick={() =>
                        goCategory(
                          category.id,
                        )
                      }
                    >
                      {
                        category
                          .shortLabel
                      }

                      <span>
                        {count}
                      </span>
                    </button>
                  );
                },
              )
            }
          </section>


          <section
            className={
              styles.toolbar
            }
          >
            <div
              className={
                styles.searchWrap
              }
            >
              <span
                className={
                  styles.searchIcon
                }
              >
                ⌕
              </span>

              <input
                type="search"
                value={
                  query
                }
                onChange={
                  event =>
                    setQuery(
                      event
                        .target
                        .value,
                    )
                }
                placeholder="Buscar proveedor, contacto, teléfono, ciudad o servicio..."
                className={
                  styles.search
                }
              />
            </div>

            <select
              value={
                zoneFilter
              }
              onChange={
                event =>
                  setZoneFilter(
                    event
                      .target
                      .value,
                  )
              }
              className={
                styles.select
              }
            >
              <option
                value="all"
              >
                Todas las zonas
              </option>

              {
                zones.map(
                  zone => (
                    <option
                      key={
                        zone
                      }
                      value={
                        zone
                      }
                    >
                      {zone}
                    </option>
                  ),
                )
              }
            </select>

            <select
              value={
                completionFilter
              }
              onChange={
                event =>
                  setCompletionFilter(
                    event.target.value as
                      | "all"
                      | "complete"
                      | "pending",
                  )
              }
              className={
                styles.select
              }
            >
              <option
                value="all"
              >
                Todos los estados
              </option>

              <option
                value="complete"
              >
                Completos
              </option>

              <option
                value="pending"
              >
                Pendientes
              </option>
            </select>
          </section>


          <section
            className={
              styles.tablePanel
            }
          >
            {
              loading ? (
                <TableMessage
                  text="Cargando proveedores..."
                />
              ) : error ? (
                <TableMessage
                  text={
                    error
                  }
                  error
                />
              ) : filtered
                  .length === 0 ? (
                <TableMessage
                  text="No hay proveedores para estos filtros."
                />
              ) : (
                <div
                  className={
                    styles.tableScroll
                  }
                >
                  <table
                    className={
                      styles.table
                    }
                  >
                    <thead>
                      <tr>
                        <th>
                          Proveedor
                        </th>

                        <th>
                          Servicio
                        </th>

                        <th>
                          Contacto
                        </th>

                        <th>
                          Zona
                        </th>

                        <th>
                          Teléfono
                        </th>

                        <th>
                          Estado
                        </th>

                        <th>
                          Actualizado
                        </th>

                        <th
                          aria-label="Acciones"
                        />
                      </tr>
                    </thead>

                    <tbody>
                      {
                        filtered.map(
                          item => {
                            const provider =
                              item.provider;

                            const phone =
                              provider.whatsapp
                              ||
                              provider.phone;

                            const location =
                              [
                                provider.city,

                                provider.province,
                              ]
                                .filter(
                                  Boolean,
                                )
                                .join(
                                  ", ",
                                )
                              ||
                              provider
                                .service_area
                              ||
                              "Sin definir";

                            const isComplete =
                              item.completion
                              === 100;

                            return (
                              <tr
                                key={
                                  provider.id
                                }
                                onClick={() =>
                                  setSelectedId(
                                    provider.id,
                                  )
                                }
                                className={
                                  selectedId
                                    === provider.id
                                    ? styles.selectedRow
                                    : undefined
                                }
                              >
                                <td>
                                  <div
                                    className={
                                      styles.providerCell
                                    }
                                  >
                                    <div
                                      className={
                                        styles.avatar
                                      }
                                    >
                                      {
                                        String(
                                          provider.name
                                          ??
                                          "?",
                                        )
                                          .trim()
                                          .slice(
                                            0,
                                            1,
                                          )
                                          .toUpperCase()
                                      }
                                    </div>

                                    <div
                                      className={
                                        styles.providerIdentity
                                      }
                                    >
                                      <strong>
                                        {
                                          provider.name
                                          ||
                                          "Sin nombre"
                                        }
                                      </strong>

                                      <span>
                                        {
                                          item.profile
                                            ?.provider_type
                                          ||
                                          "Proveedor"
                                        }
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                <td>
                                  <span
                                    className={
                                      styles.serviceBadge
                                    }
                                  >
                                    {
                                      categoryName(
                                        item.categoryId,
                                      )
                                    }
                                  </span>
                                </td>

                                <td>
                                  {
                                    provider
                                      .contact_name
                                    ||
                                    "—"
                                  }
                                </td>

                                <td>
                                  {
                                    location
                                  }
                                </td>

                                <td>
                                  {
                                    phone ? (
                                      <span
                                        className={
                                          styles.phone
                                        }
                                      >
                                        {phone}
                                      </span>
                                    ) : (
                                      <span
                                        className={
                                          styles.muted
                                        }
                                      >
                                        Sin teléfono
                                      </span>
                                    )
                                  }
                                </td>

                                <td>
                                  <div
                                    className={
                                      styles.statusWrap
                                    }
                                  >
                                    <span
                                      className={
                                        isComplete
                                          ? styles.statusComplete
                                          : styles.statusPending
                                      }
                                    >
                                      <i />

                                      {
                                        isComplete
                                          ? "Completo"
                                          : `${item.completion}%`
                                      }
                                    </span>

                                    {
                                      !isComplete
                                      &&
                                      item.missing
                                        .length > 0
                                      &&
                                      (
                                        <span
                                          className={
                                            styles.missingHint
                                          }
                                        >
                                          {
                                            item.missing
                                              .slice(
                                                0,
                                                2,
                                              )
                                              .join(
                                                ", ",
                                              )
                                          }
                                        </span>
                                      )
                                    }
                                  </div>
                                </td>

                                <td>
                                  <span
                                    className={
                                      styles.date
                                    }
                                  >
                                    {
                                      formatDate(
                                        item.profile
                                          ?.updated_at
                                        ||
                                        provider
                                          .updated_at,
                                      )
                                    }
                                  </span>
                                </td>

                                <td>
                                  <button
                                    type="button"
                                    className={
                                      styles.rowButton
                                    }
                                    onClick={
                                      event => {
                                        event
                                          .stopPropagation();

                                        setSelectedId(
                                          provider.id,
                                        );
                                      }
                                    }
                                  >
                                    Ver
                                  </button>
                                </td>
                              </tr>
                            );
                          },
                        )
                      }
                    </tbody>
                  </table>
                </div>
              )
            }

            {
              !loading
              &&
              !error
              &&
              filtered.length
                > 0
              &&
              (
                <div
                  className={
                    styles.tableFooter
                  }
                >
                  Mostrando{" "}
                  <strong>
                    {
                      filtered.length
                    }
                  </strong>{" "}
                  proveedores
                </div>
              )
            }
          </section>
        </div>
      </main>


      {
        selected
        &&
        (
          <>
            <button
              type="button"
              aria-label="Cerrar proveedor"
              className={
                styles.drawerBackdrop
              }
              onClick={() =>
                setSelectedId(
                  null,
                )
              }
            />

            <aside
              className={
                styles.drawer
              }
            >
              <ProviderDrawer
                item={
                  selected
                }
                onClose={() =>
                  setSelectedId(
                    null,
                  )
                }
              />
            </aside>
          </>
        )
      }
    </>
  );
}


function Metric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div
      className={
        styles.metric
      }
    >
      <span>
        {label}
      </span>

      <strong
        className={
          warning
            ? styles.metricWarning
            : undefined
        }
      >
        {value}
      </strong>
    </div>
  );
}


function TableMessage({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  return (
    <div
      className={
        error
          ? styles.errorMessage
          : styles.tableMessage
      }
    >
      {text}
    </div>
  );
}


function ProviderDrawer({
  item,
  onClose,
}: {
  item: EnrichedProvider;
  onClose: () => void;
}) {
  const {
    provider,
    profile,
  } = item;

  const phone =
    provider.whatsapp
    ||
    provider.phone;

  const whatsapp =
    cleanPhone(
      provider.whatsapp
      ||
      provider.phone,
    );

  const location =
    [
      provider.city,
      provider.province,
    ]
      .filter(
        Boolean,
      )
      .join(
        ", ",
      )
    ||
    provider.service_area
    ||
    "Sin definir";

  return (
    <div
      className={
        styles.drawerInner
      }
    >
      <div
        className={
          styles.drawerHeader
        }
      >
        <div
          className={
            styles.drawerIdentity
          }
        >
          <div
            className={
              styles.drawerAvatar
            }
          >
            {
              String(
                provider.name
                ??
                "?",
              )
                .trim()
                .slice(
                  0,
                  1,
                )
                .toUpperCase()
            }
          </div>

          <div>
            <span
              className={
                styles.drawerCategory
              }
            >
              {
                categoryName(
                  item.categoryId,
                )
              }
            </span>

            <h2>
              {
                provider.name
                ||
                "Proveedor"
              }
            </h2>

            <p>
              {
                profile
                  ?.provider_type
                ||
                "Proveedor"
              }
            </p>
          </div>
        </div>

        <button
          type="button"
          className={
            styles.closeButton
          }
          onClick={
            onClose
          }
        >
          ×
        </button>
      </div>


      <div
        className={
          styles.drawerActions
        }
      >
        {
          whatsapp
          &&
          (
            <a
              href={
                `https://wa.me/${whatsapp.replace(
                  "+",
                  "",
                )}`
              }
              target="_blank"
              rel="noreferrer"
              className={
                styles.whatsappButton
              }
            >
              WhatsApp
            </a>
          )
        }

        {
          phone
          &&
          (
            <a
              href={
                `tel:${cleanPhone(
                  phone,
                )}`
              }
              className={
                styles.drawerActionButton
              }
            >
              Llamar
            </a>
          )
        }

        {
          provider.email
          &&
          (
            <a
              href={
                `mailto:${provider.email}`
              }
              className={
                styles.drawerActionButton
              }
            >
              Email
            </a>
          )
        }
      </div>


      <section
        className={
          styles.drawerSection
        }
      >
        <div
          className={
            styles.sectionTitle
          }
        >
          Información
        </div>

        <Definition
          label="Contacto"
          value={
            provider.contact_name
            ||
            "Sin definir"
          }
        />

        <Definition
          label="Teléfono"
          value={
            phone
            ||
            "Sin definir"
          }
        />

        <Definition
          label="Email"
          value={
            provider.email
            ||
            "Sin definir"
          }
        />

        <Definition
          label="Zona"
          value={
            location
          }
        />

        <Definition
          label="Completitud"
          value={
            `${item.completion}%`
          }
        />
      </section>


      <section
        className={
          styles.drawerSection
        }
      >
        <div
          className={
            styles.sectionTitle
          }
        >
          Servicios
        </div>

        <div
          className={
            styles.drawerTags
          }
        >
          {
            profile
              ?.service_categories
              ?.length
            ? (
                profile
                  .service_categories
                  .map(
                    service => (
                      <span
                        key={
                          service
                        }
                      >
                        {service}
                      </span>
                    ),
                  )
              )
            : (
                <span
                  className={
                    styles.emptyValue
                  }
                >
                  Sin servicios definidos
                </span>
              )
          }
        </div>
      </section>


      {
        profile
          ?.factual_summary
        &&
        (
          <section
            className={
              styles.drawerSection
            }
          >
            <div
              className={
                styles.sectionTitle
              }
            >
              Resumen
            </div>

            <p
              className={
                styles.drawerText
              }
            >
              {
                profile
                  .factual_summary
              }
            </p>
          </section>
        )
      }


      <section
        className={
          styles.drawerSection
        }
      >
        <div
          className={
            styles.sectionTitle
          }
        >
          Relación comercial
        </div>

        <p
          className={
            styles.drawerText
          }
        >
          {
            profile
              ?.commercial_relationship
            ||
            profile
              ?.relationship
            ||
            "Sin información comercial registrada."
          }
        </p>
      </section>


      {
        Boolean(
          profile?.commercial_conditions,
        )
        &&
        Object.keys(
          (
            profile?.commercial_conditions
            ?? {}
          ) as Record<string, unknown>,
        ).length > 0
        &&
        (
          <section
            className={
              styles.drawerSection
            }
          >
            <div
              className={
                styles.sectionTitle
              }
            >
              Condiciones
            </div>

            <pre
              className={
                styles.dataBlock
              }
            >
              {
                safeText(
                    profile?.commercial_conditions,
                  )
              }
            </pre>
          </section>
        )
      }


      {
        (
          provider.notes
          ||
          profile
            ?.factual_notes
        )
        &&
        (
          <section
            className={
              styles.drawerSection
            }
          >
            <div
              className={
                styles.sectionTitle
              }
            >
              Notas
            </div>

            <p
              className={
                styles.drawerText
              }
            >
              {
                profile
                  ?.factual_notes
                ||
                provider.notes
              }
            </p>
          </section>
        )
      }


      {
        item.missing.length
          > 0
        &&
        (
          <section
            className={
              styles.drawerSection
            }
          >
            <div
              className={
                styles.sectionTitle
              }
            >
              Información pendiente
            </div>

            <div
              className={
                styles.missingList
              }
            >
              {
                item.missing.map(
                  field => (
                    <span
                      key={
                        field
                      }
                    >
                      {field}
                    </span>
                  ),
                )
              }
            </div>
          </section>
        )
      }
    </div>
  );
}


function Definition({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className={
        styles.definition
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
