"use client";

import { useEffect, useMemo, useState } from "react";

type Provider = {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  province?: string | null;
  provider_type?: string | null;
  category?: string | null;
  service_category?: string | null;
  status?: string | null;
  notes?: string | null;
};

type ProviderProfile = {
  id?: string;
  provider_id: string;
  provider_type?: string | null;
  service_categories?: string[] | null;
  relationship?: string | null;
  factual_summary?: string | null;
  factual_notes?: string | null;
};

type CategoryDefinition = {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  types?: string[];
};

const CATEGORIES: CategoryDefinition[] = [
  {
    id: "spaces",
    name: "Chalets y espacios",
    description: "Propietarios, chalets, fincas, locales y espacios",
    types: ["owner", "owner_contact", "partner_owner"],
    keywords: [
      "chalet",
      "espacio",
      "propietario",
      "propietaria",
      "finca",
      "masia",
      "local",
      "terreno",
    ],
  },
  {
    id: "catering",
    name: "Catering",
    description: "Catering, cocina, comida y bebida",
    keywords: [
      "catering",
      "cocinero",
      "cocinera",
      "comida",
      "paella",
      "bebida",
      "restaurante",
    ],
  },
  {
    id: "dj-music",
    name: "DJs y música",
    description: "DJs, músicos, cantantes, grupos y orquestas",
    keywords: [
      "dj",
      "musica",
      "músic",
      "cantante",
      "orquesta",
      "grupo musical",
      "productor musical",
      "gala records",
    ],
  },
  {
    id: "sound-light",
    name: "Sonido y luces",
    description: "Sonido, iluminación y material técnico",
    keywords: [
      "sonido",
      "luces",
      "iluminacion",
      "iluminación",
      "altavoz",
      "microfono",
      "micrófono",
      "mezcladora",
      "potencia",
      "equipo",
      "discomovil",
      "discomóvil",
    ],
  },
  {
    id: "animation",
    name: "Animación y artistas",
    description: "Animadores, bailarines, magos, modelos y shows",
    keywords: [
      "animacion",
      "animación",
      "artista",
      "bailarin",
      "bailarín",
      "bailarina",
      "gogo",
      "gogó",
      "mago",
      "modelo",
      "payaso",
      "zancudo",
      "strip",
      "show",
      "performance",
      "pintacaras",
    ],
  },
  {
    id: "decoration",
    name: "Decoración",
    description: "Decoradores, flores y ambientación",
    keywords: [
      "decor",
      "flor",
      "ambientacion",
      "ambientación",
    ],
  },
  {
    id: "photo-video",
    name: "Foto y vídeo",
    description: "Fotografía, vídeo, 360 y producción audiovisual",
    keywords: [
      "fotogra",
      "foto",
      "video",
      "vídeo",
      "360",
      "camara",
      "cámara",
      "videogra",
    ],
  },
  {
    id: "furniture",
    name: "Mobiliario",
    description: "Mesas, sillas y alquiler de mobiliario",
    keywords: [
      "mobiliario",
      "sillas",
      "mesas",
      "mueble",
    ],
  },
  {
    id: "transport",
    name: "Transporte",
    description: "Conductores, buses, coches y transporte",
    keywords: [
      "transporte",
      "conductor",
      "autocar",
      "bus",
      "limusina",
      "coche",
      "vehiculo",
      "vehículo",
      "taxi",
    ],
  },
  {
    id: "staff",
    name: "Personal",
    description: "Camareros, seguridad y personal auxiliar",
    keywords: [
      "camarero",
      "camarera",
      "staff",
      "personal",
      "seguridad",
      "azafata",
    ],
  },
  {
    id: "real-estate",
    name: "Inmobiliario",
    description: "Socios inmobiliarios, ventas y compradores",
    keywords: [
      "inmobili",
      "comprador",
      "venta",
      "piso",
      "inversor",
      "traspaso",
    ],
  },
  {
    id: "other",
    name: "Otros servicios",
    description: "Servicios y colaboradores sin categoría específica",
    keywords: [],
  },
];

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function providerText(
  provider: Provider,
  profile?: ProviderProfile,
) {
  return normalize(
    [
      provider.name,
      provider.provider_type,
      provider.category,
      provider.service_category,
      provider.notes,
      profile?.provider_type,
      profile?.service_categories?.join(" "),
      profile?.relationship,
      profile?.factual_summary,
      profile?.factual_notes,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function categoryFor(
  provider: Provider,
  profile?: ProviderProfile,
) {
  const type = normalize(
    provider.provider_type ||
      profile?.provider_type,
  );

  const text = providerText(
    provider,
    profile,
  );

  for (const category of CATEGORIES) {
    if (category.id === "other") continue;

    if (
      category.types?.some(
        candidate =>
          normalize(candidate) === type,
      )
    ) {
      return category.id;
    }

    if (
      category.keywords.some(keyword =>
        text.includes(
          normalize(keyword),
        ),
      )
    ) {
      return category.id;
    }
  }

  return "other";
}

function unwrap(data: any) {
  if (!data) return [];

  const possible =
    data.items ??
    data.providers ??
    data.profiles ??
    data.data ??
    data;

  return Array.isArray(possible)
    ? possible
    : [];
}

async function tryFetch(
  urls: string[],
) {
  for (const url of urls) {
    try {
      const response = await fetch(
        url,
        {
          credentials: "include",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        continue;
      }

      return await response.json();
    } catch {
      // probar siguiente endpoint
    }
  }

  return null;
}

export function ProvidersCatalog() {
  const [providers, setProviders] =
    useState<Provider[]>([]);

  const [profiles, setProfiles] =
    useState<ProviderProfile[]>([]);

  const [selectedCategory, setSelectedCategory] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState("");

  const [onlyPending, setOnlyPending] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const providerData =
        await tryFetch([
          "/api/crm/providers?limit=500",
          "/api/crm/providers",
          "/api/crm/proveedores?limit=500",
        ]);

      if (!providerData) {
        setError(
          "No fue posible cargar los proveedores.",
        );
        setLoading(false);
        return;
      }

      setProviders(
        unwrap(providerData),
      );

      const profileData =
        await tryFetch([
          "/api/crm/provider-profiles?limit=500",
          "/api/crm/provider-profiles",
        ]);

      if (profileData) {
        setProfiles(
          unwrap(profileData),
        );
      }

      setLoading(false);
    }

    load();
  }, []);

  const profileMap =
    useMemo(() => {
      return new Map(
        profiles.map(profile => [
          profile.provider_id,
          profile,
        ]),
      );
    }, [profiles]);

  const categorized =
    useMemo(() => {
      const map =
        new Map<string, Provider[]>();

      CATEGORIES.forEach(category =>
        map.set(category.id, []),
      );

      providers.forEach(provider => {
        const profile =
          profileMap.get(provider.id);

        const category =
          categoryFor(
            provider,
            profile,
          );

        map.get(category)?.push(
          provider,
        );
      });

      for (const list of map.values()) {
        list.sort((a, b) =>
          String(a.name ?? "").localeCompare(
            String(b.name ?? ""),
            "es",
          ),
        );
      }

      return map;
    }, [providers, profileMap]);

  const selectedDefinition =
    CATEGORIES.find(
      category =>
        category.id === selectedCategory,
    );

  const currentProviders =
    useMemo(() => {
      if (!selectedCategory) {
        return [];
      }

      const query =
        normalize(search);

      return (
        categorized.get(
          selectedCategory,
        ) ?? []
      ).filter(provider => {
        const profile =
          profileMap.get(provider.id);

        const pending =
          !provider.phone ||
          !provider.city ||
          !(
            profile?.factual_summary ||
            profile?.factual_notes
          );

        if (
          onlyPending &&
          !pending
        ) {
          return false;
        }

        if (!query) {
          return true;
        }

        return normalize(
          [
            provider.name,
            provider.phone,
            provider.email,
            provider.city,
            provider.province,
            providerText(
              provider,
              profile,
            ),
          ].join(" "),
        ).includes(query);
      });
    }, [
      categorized,
      selectedCategory,
      search,
      onlyPending,
      profileMap,
    ]);

  const pendingTotal =
    providers.filter(provider => {
      const profile =
        profileMap.get(provider.id);

      return (
        !provider.phone ||
        !provider.city ||
        !(
          profile?.factual_summary ||
          profile?.factual_notes
        )
      );
    }).length;

  if (loading) {
    return (
      <section className="crm-provider-catalog">
        <div className="crm-provider-loading">
          Cargando proveedores...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="crm-provider-catalog">
        <div className="crm-provider-error">
          {error}
        </div>
      </section>
    );
  }

  if (!selectedCategory) {
    return (
      <section className="crm-provider-catalog">
        <div className="crm-provider-head">
          <div>
            <h2>Proveedores</h2>
            <p>
              Red operativa organizada por
              categorías.
            </p>
          </div>

          <div className="crm-provider-summary">
            <div>
              <strong>
                {providers.length}
              </strong>
              <span>
                Proveedores
              </span>
            </div>

            <div>
              <strong>
                {
                  CATEGORIES.filter(
                    category =>
                      (
                        categorized.get(
                          category.id,
                        ) ?? []
                      ).length > 0,
                  ).length
                }
              </strong>
              <span>
                Categorías
              </span>
            </div>

            <div>
              <strong>
                {pendingTotal}
              </strong>
              <span>
                Pendientes
              </span>
            </div>
          </div>
        </div>

        <div className="crm-provider-category-grid">
          {CATEGORIES.map(category => {
            const count =
              (
                categorized.get(
                  category.id,
                ) ?? []
              ).length;

            if (count === 0) {
              return null;
            }

            return (
              <button
                type="button"
                key={category.id}
                className="crm-provider-category-card"
                onClick={() => {
                  setSelectedCategory(
                    category.id,
                  );
                  setSearch("");
                  setOnlyPending(false);
                }}
              >
                <div className="crm-provider-category-card-top">
                  <div className="crm-provider-category-icon">
                    {category.name
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>

                  <div className="crm-provider-category-count">
                    {count}
                  </div>
                </div>

                <div className="crm-provider-category-name">
                  {category.name}
                </div>

                <div className="crm-provider-category-description">
                  {category.description}
                </div>

                <div className="crm-provider-category-action">
                  Ver proveedores
                  <span>→</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="crm-provider-catalog">
      <button
        type="button"
        className="crm-provider-back"
        onClick={() => {
          setSelectedCategory(null);
          setSearch("");
          setOnlyPending(false);
        }}
      >
        ← Todas las categorías
      </button>

      <div className="crm-provider-head crm-provider-head-category">
        <div>
          <h2>
            {selectedDefinition?.name}
          </h2>

          <p>
            {
              selectedDefinition
                ?.description
            }
          </p>
        </div>

        <div className="crm-provider-category-total">
          <strong>
            {
              (
                categorized.get(
                  selectedCategory,
                ) ?? []
              ).length
            }
          </strong>
          <span>
            proveedores
          </span>
        </div>
      </div>

      <div className="crm-provider-toolbar">
        <input
          value={search}
          onChange={event =>
            setSearch(
              event.target.value,
            )
          }
          placeholder={`Buscar en ${selectedDefinition?.name ?? "proveedores"}...`}
        />

        <button
          type="button"
          className={
            onlyPending
              ? "active"
              : ""
          }
          onClick={() =>
            setOnlyPending(
              current => !current,
            )
          }
        >
          Solo pendientes
        </button>
      </div>

      <div className="crm-provider-list">
        {currentProviders.map(provider => {
          const profile =
            profileMap.get(provider.id);

          const pending: string[] =
            [];

          if (!provider.phone) {
            pending.push(
              "Teléfono",
            );
          }

          if (!provider.city) {
            pending.push(
              "Zona",
            );
          }

          if (
            !profile?.factual_summary &&
            !profile?.factual_notes
          ) {
            pending.push(
              "Perfil",
            );
          }

          return (
            <div
              key={provider.id}
              className="crm-provider-row"
            >
              <div className="crm-provider-avatar">
                {String(
                  provider.name ?? "?",
                )
                  .slice(0, 1)
                  .toUpperCase()}
              </div>

              <div className="crm-provider-main">
                <div className="crm-provider-name">
                  {provider.name ||
                    "Proveedor sin nombre"}
                </div>

                <div className="crm-provider-meta">
                  {[
                    provider.city,
                    provider.province,
                    provider.phone,
                  ]
                    .filter(Boolean)
                    .join(" · ") ||
                    "Información básica pendiente"}
                </div>

                {profile
                  ?.service_categories
                  ?.length ? (
                  <div className="crm-provider-tags">
                    {profile.service_categories
                      .slice(0, 5)
                      .map(service => (
                        <span key={service}>
                          {service}
                        </span>
                      ))}
                  </div>
                ) : null}
              </div>

              <div className="crm-provider-status">
                {pending.length ? (
                  <>
                    <span className="crm-provider-pending-title">
                      Pendiente
                    </span>

                    <div className="crm-provider-pending-tags">
                      {pending.map(item => (
                        <span key={item}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <span className="crm-provider-complete">
                    Completo
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {currentProviders.length ===
          0 && (
          <div className="crm-provider-empty">
            No hay proveedores con
            estos filtros.
          </div>
        )}
      </div>
    </section>
  );
}
