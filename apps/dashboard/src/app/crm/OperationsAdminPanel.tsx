"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import styles from "./operations-admin.module.css";

type Category = {
  id: string;
  name: string;
  code?: string | null;
};

type Provider = {
  id: string;
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  province?: string | null;
  city?: string | null;
  address?: string | null;
  service_area?: string | null;
  internal_rating?: string | number | null;
  notes?: string | null;
};

type ProviderService = {
  id: string;
  provider_id: string;
  category_id: string;
  name: string;
  description?: string | null;
  pricing_model?: string | null;
  cost_from?: string | number | null;
  cost_to?: string | number | null;
  suggested_client_price?: string | number | null;
  capacity_min?: number | null;
  capacity_max?: number | null;
  lead_time_days?: number | null;
};

type TeamMember = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  access_role?: string | null;
};

type Props = {
  categories: Category[];
  providers: Provider[];
  team: TeamMember[];
  onReload: () => Promise<void> | void;
  initialSection?:
    | "providers"
    | "categories"
    | "team";
};

const emptyProvider = {
  id: "",
  name: "",
  contactName: "",
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  province: "Valencia",
  city: "Valencia",
  address: "",
  serviceArea: "",
  internalRating: "5",
  notes: "",
};

const emptyService = {
  id: "",
  providerId: "",
  categoryId: "",
  name: "",
  description: "",
  pricingModel: "quote",
  costFrom: "",
  costTo: "",
  suggestedClientPrice: "",
  capacityMin: "",
  capacityMax: "",
  leadTimeDays: "",
};

const emptyCategory = {
  id: "",
  name: "",
};

const emptyTeam = {
  id: "",
  name: "",
  email: "",
  phone: "",
  accessRole: "seller",
};

async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response =
    await fetch(
      `/api${path}`,
      {
        ...init,
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type":
            "application/json",
          Accept:
            "application/json",
          ...init.headers,
        },
      },
    );

  const body =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      body?.error
      ?? `HTTP_${response.status}`,
    );
  }

  return body as T;
}

function valueOrNull(
  value: string,
) {
  const clean =
    value.trim();

  return clean
    ? clean
    : null;
}

function numberOrNull(
  value: string,
) {
  if (value === "") {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

export function OperationsAdminPanel({
  categories,
  providers,
  team,
  onReload,
  initialSection = "providers",
}: Props) {
  const [
    section,
    setSection,
  ] =
    useState(initialSection);

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    notice,
    setNotice,
  ] =
    useState<string | null>(
      null,
    );

  const [
    servicesByProvider,
    setServicesByProvider,
  ] =
    useState<
      Record<
        string,
        ProviderService[]
      >
    >({});

  const [
    providerForm,
    setProviderForm,
  ] =
    useState(
      emptyProvider,
    );

  const [
    serviceForm,
    setServiceForm,
  ] =
    useState(
      emptyService,
    );

  const [
    categoryForm,
    setCategoryForm,
  ] =
    useState(
      emptyCategory,
    );

  const [
    teamForm,
    setTeamForm,
  ] =
    useState(
      emptyTeam,
    );

  useEffect(
    () => {
      setSection(
        initialSection,
      );
    },
    [initialSection],
  );

  async function loadServices() {
    const result =
      await Promise.all(
        providers.map(
          async provider => {
            try {
              const body =
                await api<{
                  services?:
                    ProviderService[];
                }>(
                  `/crm/providers/${provider.id}/services`,
                );

              return [
                provider.id,
                body.services
                ?? [],
              ] as const;
            } catch {
              return [
                provider.id,
                [],
              ] as const;
            }
          },
        ),
      );

    setServicesByProvider(
      Object.fromEntries(
        result,
      ),
    );
  }

  useEffect(
    () => {
      void loadServices();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      providers
        .map(item => item.id)
        .join(","),
    ],
  );

  async function reload() {
    await onReload();
    await loadServices();
  }

  const visibleProviders =
    useMemo(
      () => {
        const needle =
          query
            .trim()
            .toLowerCase();

        if (!needle) {
          return providers;
        }

        return providers.filter(
          provider =>
            [
              provider.name,
              provider.contact_name,
              provider.phone,
              provider.whatsapp,
              provider.city,
              provider.service_area,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(
                needle,
              ),
        );
      },
      [
        providers,
        query,
      ],
    );

  async function saveCategory() {
    if (
      !categoryForm.name
        .trim()
    ) {
      setNotice(
        "Escribí el nombre de la categoría.",
      );
      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      if (categoryForm.id) {
        await api(
          `/crm/service-categories/${categoryForm.id}`,
          {
            method: "PATCH",
            body:
              JSON.stringify({
                name:
                  categoryForm.name,
              }),
          },
        );
      } else {
        const code =
          categoryForm.name
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(
              /[\u0300-\u036f]/g,
              "",
            )
            .replace(
              /[^a-z0-9]+/g,
              "_",
            )
            .replace(
              /^_+|_+$/g,
              "",
            )
          || `categoria_${Date.now()}`;

        await api(
          "/crm/service-categories",
          {
            method: "POST",
            body:
              JSON.stringify({
                code,
                name:
                  categoryForm.name,
                sortOrder:
                  categories.length
                  + 1,
              }),
          },
        );
      }

      setCategoryForm(
        emptyCategory,
      );

      await onReload();

      setNotice(
        "Categoría guardada.",
      );
    } catch (error) {
      setNotice(
        error
          instanceof Error
          ? error.message
          : "No se pudo guardar la categoría.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disableCategory(
    category: Category,
  ) {
    if (
      !confirm(
        `¿Desactivar "${category.name}"?`,
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      await api(
        `/crm/service-categories/${category.id}`,
        {
          method: "DELETE",
        },
      );

      await onReload();

      setNotice(
        "Categoría desactivada.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo desactivar.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveProvider() {
    if (
      !providerForm.name
        .trim()
    ) {
      setNotice(
        "El nombre del proveedor es obligatorio.",
      );
      return;
    }

    setBusy(true);
    setNotice(null);

    const payload = {
      name:
        providerForm.name.trim(),

      contactName:
        valueOrNull(
          providerForm.contactName,
        ),

      phone:
        valueOrNull(
          providerForm.phone,
        ),

      whatsapp:
        valueOrNull(
          providerForm.whatsapp,
        ),

      email:
        valueOrNull(
          providerForm.email,
        ),

      website:
        valueOrNull(
          providerForm.website,
        ),

      province:
        valueOrNull(
          providerForm.province,
        ),

      city:
        valueOrNull(
          providerForm.city,
        ),

      address:
        valueOrNull(
          providerForm.address,
        ),

      serviceArea:
        valueOrNull(
          providerForm.serviceArea,
        ),

      internalRating:
        numberOrNull(
          providerForm.internalRating,
        ),

      notes:
        valueOrNull(
          providerForm.notes,
        ),
    };

    try {
      await api(
        providerForm.id
          ? `/crm/providers/${providerForm.id}`
          : "/crm/providers",

        {
          method:
            providerForm.id
              ? "PATCH"
              : "POST",

          body:
            JSON.stringify(
              payload,
            ),
        },
      );

      setProviderForm(
        emptyProvider,
      );

      await reload();

      setNotice(
        "Proveedor guardado.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el proveedor.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disableProvider(
    provider: Provider,
  ) {
    if (
      !confirm(
        `¿Desactivar "${provider.name}"?`,
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      await api(
        `/crm/providers/${provider.id}`,
        {
          method:
            "DELETE",
        },
      );

      await reload();

      setNotice(
        "Proveedor desactivado.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo desactivar.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveService() {
    if (
      !serviceForm.providerId
      || !serviceForm.categoryId
      || !serviceForm.name.trim()
    ) {
      setNotice(
        "Proveedor, categoría y servicio son obligatorios.",
      );
      return;
    }

    setBusy(true);
    setNotice(null);

    const payload = {
      categoryId:
        serviceForm.categoryId,

      name:
        serviceForm.name.trim(),

      description:
        valueOrNull(
          serviceForm.description,
        ),

      pricingModel:
        serviceForm.pricingModel,

      costFrom:
        numberOrNull(
          serviceForm.costFrom,
        ),

      costTo:
        numberOrNull(
          serviceForm.costTo,
        ),

      suggestedClientPrice:
        numberOrNull(
          serviceForm
            .suggestedClientPrice,
        ),

      capacityMin:
        numberOrNull(
          serviceForm.capacityMin,
        ),

      capacityMax:
        numberOrNull(
          serviceForm.capacityMax,
        ),

      leadTimeDays:
        numberOrNull(
          serviceForm.leadTimeDays,
        ),
    };

    try {
      await api(
        serviceForm.id
          ? `/crm/providers/${serviceForm.providerId}/services/${serviceForm.id}`
          : `/crm/providers/${serviceForm.providerId}/services`,

        {
          method:
            serviceForm.id
              ? "PATCH"
              : "POST",

          body:
            JSON.stringify(
              payload,
            ),
        },
      );

      setServiceForm(
        emptyService,
      );

      await reload();

      setNotice(
        "Servicio guardado.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el servicio.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disableService() {
    if (
      !serviceForm.id
      || !serviceForm.providerId
    ) {
      return;
    }

    if (
      !confirm(
        "¿Desactivar este servicio?",
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      await api(
        `/crm/providers/${serviceForm.providerId}/services/${serviceForm.id}`,
        {
          method:
            "DELETE",
        },
      );

      setServiceForm(
        emptyService,
      );

      await reload();

      setNotice(
        "Servicio desactivado.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo desactivar.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveTeamMember() {
    if (
      !teamForm.name.trim()
    ) {
      setNotice(
        "El nombre es obligatorio.",
      );
      return;
    }

    setBusy(true);
    setNotice(null);

    try {
      await api(
        teamForm.id
          ? `/crm/team/${teamForm.id}`
          : "/crm/team",

        {
          method:
            teamForm.id
              ? "PATCH"
              : "POST",

          body:
            JSON.stringify({
              name:
                teamForm.name.trim(),

              email:
                valueOrNull(
                  teamForm.email,
                ),

              phone:
                valueOrNull(
                  teamForm.phone,
                ),

              accessRole:
                teamForm.accessRole,
            }),
        },
      );

      setTeamForm(
        emptyTeam,
      );

      await onReload();

      setNotice(
        "Responsable guardado.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el responsable.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disableMember(
    member: TeamMember,
  ) {
    if (
      !confirm(
        `¿Desactivar a ${member.name}?`,
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      await api(
        `/crm/team/${member.id}`,
        {
          method:
            "DELETE",
        },
      );

      await onReload();

      setNotice(
        "Responsable desactivado.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo desactivar.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={
        styles.root
      }
    >
      <div
        className={
          styles.heading
        }
      >
        <div>
          <span>
            CONFIGURACIÓN OPERATIVA
          </span>

          <h2>
            Administración
          </h2>

          <p>
            Todo lo que el negocio necesita cambiar sin tocar base de datos.
          </p>
        </div>

        {notice ? (
          <div
            className={
              styles.notice
            }
          >
            {notice}
          </div>
        ) : null}
      </div>

      <nav
        className={
          styles.subtabs
        }
      >
        <button
          data-active={
            section
            === "providers"
          }
          onClick={
            () =>
              setSection(
                "providers",
              )
          }
        >
          Proveedores
        </button>

        <button
          data-active={
            section
            === "categories"
          }
          onClick={
            () =>
              setSection(
                "categories",
              )
          }
        >
          Categorías
        </button>

        <button
          data-active={
            section
            === "team"
          }
          onClick={
            () =>
              setSection(
                "team",
              )
          }
        >
          Responsables
        </button>
      </nav>

      {section === "categories" ? (
        <div
          className={
            styles.twoColumns
          }
        >
          <div
            className={
              styles.list
            }
          >
            {categories.map(
              category => (
                <article
                  key={
                    category.id
                  }
                  className={
                    styles.row
                  }
                >
                  <div>
                    <strong>
                      {category.name}
                    </strong>

                    <small>
                      {category.code
                        ?? "Categoría de servicio"}
                    </small>
                  </div>

                  <div
                    className={
                      styles.actions
                    }
                  >
                    <button
                      onClick={
                        () =>
                          setCategoryForm({
                            id:
                              category.id,
                            name:
                              category.name,
                          })
                      }
                    >
                      Editar
                    </button>

                    <button
                      onClick={
                        () =>
                          void disableCategory(
                            category,
                          )
                      }
                    >
                      Desactivar
                    </button>
                  </div>
                </article>
              ),
            )}
          </div>

          <div
            className={
              styles.form
            }
          >
            <h3>
              {categoryForm.id
                ? "Editar categoría"
                : "Nueva categoría"}
            </h3>

            <label>
              Nombre
              <input
                value={
                  categoryForm.name
                }
                onChange={
                  event =>
                    setCategoryForm({
                      ...categoryForm,
                      name:
                        event.target.value,
                    })
                }
              />
            </label>

            <button
              disabled={busy}
              onClick={
                () =>
                  void saveCategory()
              }
            >
              Guardar categoría
            </button>

            {categoryForm.id ? (
              <button
                className={
                  styles.secondary
                }
                onClick={
                  () =>
                    setCategoryForm(
                      emptyCategory,
                    )
                }
              >
                Cancelar edición
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {section === "providers" ? (
        <>
          <div
            className={
              styles.providerToolbar
            }
          >
            <input
              value={query}
              onChange={
                event =>
                  setQuery(
                    event.target.value,
                  )
              }
              placeholder="Buscar proveedor, teléfono, ciudad o zona..."
            />

            <button
              onClick={() => {
                setProviderForm(
                  emptyProvider,
                );
                setServiceForm(
                  emptyService,
                );
              }}
            >
              + Nuevo proveedor
            </button>
          </div>

          <div
            className={
              styles.providerGrid
            }
          >
            {visibleProviders.map(
              provider => {
                const services =
                  servicesByProvider[
                    provider.id
                  ] ?? [];

                return (
                  <article
                    key={
                      provider.id
                    }
                    className={
                      styles.providerCard
                    }
                  >
                    <div
                      className={
                        styles.providerHead
                      }
                    >
                      <div>
                        <strong>
                          {
                            provider.name
                          }
                        </strong>

                        <small>
                          {
                            [
                              provider.city,
                              provider.contact_name,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                            || "Sin contacto"
                          }
                        </small>
                      </div>

                      <span>
                        ★ {
                          Number(
                            provider.internal_rating
                            ?? 0,
                          ).toFixed(1)
                        }
                      </span>
                    </div>

                    <div
                      className={
                        styles.serviceBadges
                      }
                    >
                      {services.map(
                        service => (
                          <button
                            key={
                              service.id
                            }
                            onClick={
                              () =>
                                setServiceForm({
                                  id:
                                    service.id,
                                  providerId:
                                    provider.id,
                                  categoryId:
                                    service.category_id,
                                  name:
                                    service.name,
                                  description:
                                    service.description
                                    ?? "",
                                  pricingModel:
                                    service.pricing_model
                                    ?? "quote",
                                  costFrom:
                                    String(
                                      service.cost_from
                                      ?? "",
                                    ),
                                  costTo:
                                    String(
                                      service.cost_to
                                      ?? "",
                                    ),
                                  suggestedClientPrice:
                                    String(
                                      service.suggested_client_price
                                      ?? "",
                                    ),
                                  capacityMin:
                                    String(
                                      service.capacity_min
                                      ?? "",
                                    ),
                                  capacityMax:
                                    String(
                                      service.capacity_max
                                      ?? "",
                                    ),
                                  leadTimeDays:
                                    String(
                                      service.lead_time_days
                                      ?? "",
                                    ),
                                })
                            }
                          >
                            {service.name}
                          </button>
                        ),
                      )}

                      {!services.length ? (
                        <small>
                          Sin servicios
                        </small>
                      ) : null}
                    </div>

                    <div
                      className={
                        styles.actions
                      }
                    >
                      {provider.whatsapp ? (
                        <a
                          target="_blank"
                          rel="noreferrer"
                          href={
                            `https://wa.me/${
                              provider.whatsapp
                                .replace(
                                  /\D/g,
                                  "",
                                )
                            }`
                          }
                        >
                          WhatsApp
                        </a>
                      ) : null}

                      <button
                        onClick={
                          () =>
                            setProviderForm({
                              id:
                                provider.id,
                              name:
                                provider.name,
                              contactName:
                                provider.contact_name
                                ?? "",
                              phone:
                                provider.phone
                                ?? "",
                              whatsapp:
                                provider.whatsapp
                                ?? "",
                              email:
                                provider.email
                                ?? "",
                              website:
                                provider.website
                                ?? "",
                              province:
                                provider.province
                                ?? "",
                              city:
                                provider.city
                                ?? "",
                              address:
                                provider.address
                                ?? "",
                              serviceArea:
                                provider.service_area
                                ?? "",
                              internalRating:
                                String(
                                  provider.internal_rating
                                  ?? "",
                                ),
                              notes:
                                provider.notes
                                ?? "",
                            })
                        }
                      >
                        Editar
                      </button>

                      <button
                        onClick={
                          () =>
                            setServiceForm({
                              ...emptyService,
                              providerId:
                                provider.id,
                            })
                        }
                      >
                        + Servicio
                      </button>

                      <button
                        onClick={
                          () =>
                            void disableProvider(
                              provider,
                            )
                        }
                      >
                        Desactivar
                      </button>
                    </div>
                  </article>
                );
              },
            )}
          </div>

          <div
            className={
              styles.formsGrid
            }
          >
            <div
              className={
                styles.form
              }
            >
              <h3>
                {providerForm.id
                  ? "Editar proveedor"
                  : "Nuevo proveedor"}
              </h3>

              {[
                ["Nombre", "name"],
                ["Contacto", "contactName"],
                ["Teléfono", "phone"],
                ["WhatsApp", "whatsapp"],
                ["Email", "email"],
                ["Web", "website"],
                ["Provincia", "province"],
                ["Ciudad", "city"],
                ["Dirección", "address"],
                ["Zona de servicio", "serviceArea"],
                ["Rating 0–5", "internalRating"],
              ].map(
                ([label, key]) => (
                  <label
                    key={key}
                  >
                    {label}

                    <input
                      value={
                        String(
                          providerForm[
                            key as keyof typeof providerForm
                          ],
                        )
                      }
                      onChange={
                        event =>
                          setProviderForm({
                            ...providerForm,
                            [key]:
                              event.target.value,
                          })
                      }
                    />
                  </label>
                ),
              )}

              <label>
                Notas
                <textarea
                  value={
                    providerForm.notes
                  }
                  onChange={
                    event =>
                      setProviderForm({
                        ...providerForm,
                        notes:
                          event.target.value,
                      })
                  }
                />
              </label>

              <button
                disabled={busy}
                onClick={
                  () =>
                    void saveProvider()
                }
              >
                Guardar proveedor
              </button>
            </div>

            <div
              className={
                styles.form
              }
            >
              <h3>
                {serviceForm.id
                  ? "Editar servicio"
                  : "Nuevo servicio del proveedor"}
              </h3>

              <label>
                Proveedor
                <select
                  value={
                    serviceForm.providerId
                  }
                  onChange={
                    event =>
                      setServiceForm({
                        ...serviceForm,
                        providerId:
                          event.target.value,
                      })
                  }
                >
                  <option value="">
                    Seleccionar
                  </option>

                  {providers.map(
                    provider => (
                      <option
                        key={
                          provider.id
                        }
                        value={
                          provider.id
                        }
                      >
                        {provider.name}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                Categoría
                <select
                  value={
                    serviceForm.categoryId
                  }
                  onChange={
                    event =>
                      setServiceForm({
                        ...serviceForm,
                        categoryId:
                          event.target.value,
                      })
                  }
                >
                  <option value="">
                    Seleccionar
                  </option>

                  {categories.map(
                    category => (
                      <option
                        key={
                          category.id
                        }
                        value={
                          category.id
                        }
                      >
                        {category.name}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                Nombre del servicio
                <input
                  value={
                    serviceForm.name
                  }
                  onChange={
                    event =>
                      setServiceForm({
                        ...serviceForm,
                        name:
                          event.target.value,
                      })
                  }
                />
              </label>

              <label>
                Descripción
                <textarea
                  value={
                    serviceForm.description
                  }
                  onChange={
                    event =>
                      setServiceForm({
                        ...serviceForm,
                        description:
                          event.target.value,
                      })
                  }
                />
              </label>

              <label>
                Modelo de precio
                <select
                  value={
                    serviceForm.pricingModel
                  }
                  onChange={
                    event =>
                      setServiceForm({
                        ...serviceForm,
                        pricingModel:
                          event.target.value,
                      })
                  }
                >
                  <option value="quote">
                    A consultar
                  </option>
                  <option value="fixed">
                    Fijo
                  </option>
                  <option value="from">
                    Desde
                  </option>
                  <option value="per_person">
                    Por persona
                  </option>
                  <option value="per_hour">
                    Por hora
                  </option>
                </select>
              </label>

              <div
                className={
                  styles.inline
                }
              >
                <label>
                  Coste desde
                  <input
                    type="number"
                    value={
                      serviceForm.costFrom
                    }
                    onChange={
                      event =>
                        setServiceForm({
                          ...serviceForm,
                          costFrom:
                            event.target.value,
                        })
                    }
                  />
                </label>

                <label>
                  Coste hasta
                  <input
                    type="number"
                    value={
                      serviceForm.costTo
                    }
                    onChange={
                      event =>
                        setServiceForm({
                          ...serviceForm,
                          costTo:
                            event.target.value,
                        })
                    }
                  />
                </label>
              </div>

              <label>
                Precio cliente sugerido
                <input
                  type="number"
                  value={
                    serviceForm.suggestedClientPrice
                  }
                  onChange={
                    event =>
                      setServiceForm({
                        ...serviceForm,
                        suggestedClientPrice:
                          event.target.value,
                      })
                  }
                />
              </label>

              <div
                className={
                  styles.inline
                }
              >
                <label>
                  Capacidad mínima
                  <input
                    type="number"
                    value={
                      serviceForm.capacityMin
                    }
                    onChange={
                      event =>
                        setServiceForm({
                          ...serviceForm,
                          capacityMin:
                            event.target.value,
                        })
                    }
                  />
                </label>

                <label>
                  Capacidad máxima
                  <input
                    type="number"
                    value={
                      serviceForm.capacityMax
                    }
                    onChange={
                      event =>
                        setServiceForm({
                          ...serviceForm,
                          capacityMax:
                            event.target.value,
                        })
                    }
                  />
                </label>
              </div>

              <label>
                Anticipación mínima (días)
                <input
                  type="number"
                  value={
                    serviceForm.leadTimeDays
                  }
                  onChange={
                    event =>
                      setServiceForm({
                        ...serviceForm,
                        leadTimeDays:
                          event.target.value,
                      })
                  }
                />
              </label>

              <button
                disabled={busy}
                onClick={
                  () =>
                    void saveService()
                }
              >
                Guardar servicio
              </button>

              {serviceForm.id ? (
                <button
                  className={
                    styles.secondaryDanger
                  }
                  onClick={
                    () =>
                      void disableService()
                  }
                >
                  Desactivar servicio
                </button>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {section === "team" ? (
        <div
          className={
            styles.twoColumns
          }
        >
          <div
            className={
              styles.list
            }
          >
            {team.map(
              member => (
                <article
                  key={
                    member.id
                  }
                  className={
                    styles.row
                  }
                >
                  <div>
                    <strong>
                      {member.name}
                    </strong>

                    <small>
                      {
                        [
                          member.access_role
                            === "admin"
                            ? "Administrador"
                            : "Operativo",
                          member.phone,
                          member.email,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      }
                    </small>
                  </div>

                  <div
                    className={
                      styles.actions
                    }
                  >
                    <button
                      onClick={
                        () =>
                          setTeamForm({
                            id:
                              member.id,
                            name:
                              member.name,
                            email:
                              member.email
                              ?? "",
                            phone:
                              member.phone
                              ?? "",
                            accessRole:
                              member.access_role
                              ?? "seller",
                          })
                      }
                    >
                      Editar
                    </button>

                    <button
                      onClick={
                        () =>
                          void disableMember(
                            member,
                          )
                      }
                    >
                      Desactivar
                    </button>
                  </div>
                </article>
              ),
            )}
          </div>

          <div
            className={
              styles.form
            }
          >
            <h3>
              {teamForm.id
                ? "Editar responsable"
                : "Nuevo responsable"}
            </h3>

            <label>
              Nombre
              <input
                value={
                  teamForm.name
                }
                onChange={
                  event =>
                    setTeamForm({
                      ...teamForm,
                      name:
                        event.target.value,
                    })
                }
              />
            </label>

            <label>
              Teléfono
              <input
                value={
                  teamForm.phone
                }
                onChange={
                  event =>
                    setTeamForm({
                      ...teamForm,
                      phone:
                        event.target.value,
                    })
                }
              />
            </label>

            <label>
              Email
              <input
                value={
                  teamForm.email
                }
                onChange={
                  event =>
                    setTeamForm({
                      ...teamForm,
                      email:
                        event.target.value,
                    })
                }
              />
            </label>

            <label>
              Acceso
              <select
                value={
                  teamForm.accessRole
                }
                onChange={
                  event =>
                    setTeamForm({
                      ...teamForm,
                      accessRole:
                        event.target.value,
                    })
                }
              >
                <option value="seller">
                  Operativo
                </option>
                <option value="admin">
                  Administrador
                </option>
              </select>
            </label>

            <button
              disabled={busy}
              onClick={
                () =>
                  void saveTeamMember()
              }
            >
              Guardar responsable
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
