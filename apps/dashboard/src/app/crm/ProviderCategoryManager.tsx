"use client";

import {
  useMemo,
  useState,
} from "react";

import styles from "./provider-category-manager.module.css";

type Category = {
  id: string;
  name: string;
};

type ProviderService = {
  id?: string;
  provider_id?: string | null;
  category_id?: string | null;
  service_name?: string | null;
  name?: string | null;
  base_price?: string | number | null;
  price?: string | number | null;
  active?: boolean | null;
};

type Provider = {
  id: string;
  name: string;
  city?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  internal_rating?: string | number | null;
  times_used?: number | null;
  incident_count?: number | null;
  average_response_minutes?: number | null;
  services?: ProviderService[];
};

type Props = {
  categories: Category[];
  providers: Provider[];
  providerServices?: ProviderService[];
};

export function ProviderCategoryManager({
  categories,
  providers,
  providerServices = [],
}: Props) {
  const [selectedCategory, setSelectedCategory] =
    useState<string>(
      categories[0]?.id ?? "all",
    );

  const [query, setQuery] =
    useState("");

  const [editingProvider, setEditingProvider] =
    useState<string | null>(null);

  const [addingServiceTo, setAddingServiceTo] =
    useState<string | null>(null);

  const linkedServices =
    useMemo(
      () => {
        const result =
          new Map<string, ProviderService[]>();

        for (const service of providerServices) {
          if (!service.provider_id) {
            continue;
          }

          const current =
            result.get(
              service.provider_id,
            ) ?? [];

          current.push(service);

          result.set(
            service.provider_id,
            current,
          );
        }

        for (const provider of providers) {
          if (provider.services?.length) {
            result.set(
              provider.id,
              [
                ...(result.get(provider.id) ?? []),
                ...provider.services,
              ],
            );
          }
        }

        return result;
      },
      [
        providerServices,
        providers,
      ],
    );

  const visibleProviders =
    providers.filter(
      (provider) => {
        const services =
          linkedServices.get(
            provider.id,
          ) ?? [];

        const categoryMatch =
          selectedCategory === "all"
          || services.some(
            (service) =>
              service.category_id
              === selectedCategory,
          );

        const text =
          `${provider.name} ${provider.city ?? ""}`
            .toLowerCase();

        const searchMatch =
          text.includes(
            query
              .trim()
              .toLowerCase(),
          );

        return (
          categoryMatch
          && searchMatch
        );
      },
    );

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div>
          <span>
            CATÁLOGO DE PROVEEDORES
          </span>

          <h3>
            Proveedores por servicio
          </h3>

          <p>
            Organiza proveedores según
            los servicios que realmente prestan.
          </p>
        </div>

        <button
          type="button"
          className={styles.primary}
        >
          + Nuevo proveedor
        </button>
      </div>

      <div className={styles.search}>
        <input
          value={query}
          onChange={
            (event) =>
              setQuery(
                event.target.value,
              )
          }
          placeholder="Buscar proveedor..."
        />
      </div>

      <div className={styles.categoryBar}>
        <button
          type="button"
          data-active={
            selectedCategory
            === "all"
          }
          onClick={
            () =>
              setSelectedCategory(
                "all",
              )
          }
        >
          Todos
        </button>

        {categories.map(
          (category) => (
            <button
              key={category.id}
              type="button"
              data-active={
                selectedCategory
                === category.id
              }
              onClick={
                () =>
                  setSelectedCategory(
                    category.id,
                  )
              }
            >
              {category.name}
            </button>
          ),
        )}
      </div>

      <div className={styles.grid}>
        {visibleProviders.map(
          (provider) => {
            const services =
              linkedServices.get(
                provider.id,
              ) ?? [];

            const phone =
              provider.whatsapp
              || provider.phone;

            return (
              <article
                key={provider.id}
                className={styles.provider}
              >
                <div className={styles.providerTop}>
                  <div>
                    <strong>
                      {provider.name}
                    </strong>

                    <small>
                      {
                        provider.city
                        ?? "Valencia"
                      }
                    </small>
                  </div>

                  <div className={styles.rating}>
                    ★ {
                      Number(
                        provider.internal_rating
                        ?? 0,
                      ).toFixed(1)
                    }
                  </div>
                </div>

                <div className={styles.stats}>
                  <span>
                    {provider.times_used ?? 0}
                    {" usos"}
                  </span>

                  <span>
                    {provider.incident_count ?? 0}
                    {" incidencias"}
                  </span>

                  <span>
                    {
                      provider
                        .average_response_minutes
                      ?? "—"
                    }
                    {" min respuesta"}
                  </span>
                </div>

                <div className={styles.services}>
                  <div className={styles.serviceHeader}>
                    <strong>
                      Servicios
                    </strong>

                    <button
                      type="button"
                      onClick={
                        () =>
                          setAddingServiceTo(
                            provider.id,
                          )
                      }
                    >
                      + Agregar servicio
                    </button>
                  </div>

                  <div className={styles.badges}>
                    {services.map(
                      (
                        service,
                        index,
                      ) => {
                        const category =
                          categories.find(
                            (item) =>
                              item.id
                              === service.category_id,
                          );

                        return (
                          <span
                            key={
                              service.id
                              ?? `${provider.id}-${index}`
                            }
                          >
                            {
                              service.service_name
                              ?? service.name
                              ?? category?.name
                              ?? "Servicio"
                            }
                          </span>
                        );
                      },
                    )}

                    {!services.length ? (
                      <small>
                        Sin servicios vinculados
                      </small>
                    ) : null}
                  </div>

                  {addingServiceTo
                    === provider.id ? (
                    <div className={styles.inlineEditor}>
                      <select defaultValue="">
                        <option
                          value=""
                          disabled
                        >
                          Seleccionar categoría
                        </option>

                        {categories.map(
                          (category) => (
                            <option
                              key={category.id}
                              value={category.id}
                            >
                              {category.name}
                            </option>
                          ),
                        )}
                      </select>

                      <input
                        placeholder="Nombre del servicio"
                      />

                      <input
                        type="number"
                        placeholder="Precio base €"
                      />

                      <button
                        type="button"
                      >
                        Guardar
                      </button>

                      <button
                        type="button"
                        onClick={
                          () =>
                            setAddingServiceTo(
                              null,
                            )
                        }
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className={styles.actions}>
                  {phone ? (
                    <a
                      href={
                        `https://wa.me/${
                          phone.replace(
                            /\D/g,
                            "",
                          )
                        }`
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp
                    </a>
                  ) : null}

                  <button
                    type="button"
                    onClick={
                      () =>
                        setEditingProvider(
                          provider.id,
                        )
                    }
                  >
                    Editar proveedor
                  </button>
                </div>

                {editingProvider
                  === provider.id ? (
                  <div className={styles.editor}>
                    <strong>
                      Editar proveedor
                    </strong>

                    <input
                      defaultValue={
                        provider.name
                      }
                    />

                    <input
                      defaultValue={
                        provider.city
                        ?? ""
                      }
                      placeholder="Ciudad"
                    />

                    <input
                      defaultValue={
                        phone
                        ?? ""
                      }
                      placeholder="WhatsApp"
                    />

                    <div>
                      <button
                        type="button"
                      >
                        Guardar cambios
                      </button>

                      <button
                        type="button"
                        onClick={
                          () =>
                            setEditingProvider(
                              null,
                            )
                        }
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          },
        )}

        {!visibleProviders.length ? (
          <div className={styles.empty}>
            <strong>
              No hay proveedores
              en esta categoría.
            </strong>

            <p>
              Agrega un proveedor
              o vincula un servicio.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
