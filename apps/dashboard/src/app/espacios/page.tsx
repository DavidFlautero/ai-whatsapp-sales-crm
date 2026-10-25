"use client";

import Link
  from "next/link";

import {
  useEffect,
  useState,
} from "react";

import styles
  from "./venues-public.module.css";

type ImageItem = {
  id?: string;
  url?: string | null;
  role?: string;
};

type Venue = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  province?: string | null;
  city?: string | null;
  public_location?: string | null;
  capacity_min?: number | null;
  capacity_max?: number | null;
  client_price_from?: number | string | null;
  currency?: string | null;
  images?: ImageItem[];
};

type Service = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  icon?: string | null;
};

function money(
  value:
    number
    | string
    | null
    | undefined,
  currency = "EUR",
) {
  const number =
    Number(
      value
      ?? 0,
    );

  return new Intl
    .NumberFormat(
      "es-ES",
      {
        style:
          "currency",
        currency,
        maximumFractionDigits:
          0,
      },
    )
    .format(
      number,
    );
}

export default function SpacesPage() {
  const [
    venues,
    setVenues,
  ] =
    useState<Venue[]>(
      [],
    );

  const [
    services,
    setServices,
  ] =
    useState<Service[]>(
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
    useState<
      string | null
    >(
      null,
    );

  useEffect(
    () => {
      void (
        async () => {
          try {
            const response =
              await fetch(
                "/api/public/venues",
              );

            const body =
              await response
                .json();

            if (
              !response.ok
            ) {
              throw new Error(
                body?.error
                ?? "No se pudo cargar el catálogo.",
              );
            }

            setVenues(
              body.venues
              ?? [],
            );

            setServices(
              body.services
              ?? [],
            );
          } catch (
            loadError
          ) {
            setError(
              loadError
                instanceof Error
                ? loadError.message
                : "No se pudo cargar el catálogo.",
            );
          } finally {
            setLoading(
              false,
            );
          }
        }
      )();
    },
    [],
  );

  return (
    <main
      className={
        styles.page
      }
    >
      <header
        className={
          styles.header
        }
      >
        <div
          className={
            styles.headerInner
          }
        >
          <div
            className={
              styles.eyebrow
            }
          >
            Eventos Mediterráneo
          </div>

          <h1>
            Espacios para celebrar algo memorable.
          </h1>

          <p>
            Chalets, fincas y espacios para eventos en Valencia.
            Encuentra el lugar y completa la celebración con catering,
            decoración, DJ, fotografía, iluminación y el resto de servicios.
          </p>
        </div>
      </header>

      <div
        className={
          styles.main
        }
      >
        {
          loading
            ? (
              <div
                className={
                  styles.empty
                }
              >
                Cargando espacios…
              </div>
            )
            : null
        }

        {
          error
            ? (
              <div
                className={
                  styles.empty
                }
              >
                {error}
              </div>
            )
            : null
        }

        {
          !loading
          && !error
          && venues.length
            === 0
            ? (
              <div
                className={
                  styles.empty
                }
              >
                Próximamente publicaremos nuestros espacios disponibles.
              </div>
            )
            : null
        }

        <section
          className={
            styles.grid
          }
        >
          {
            venues.map(
              (
                venue,
              ) => {
                const cover =
                  venue.images
                    ?.find(
                      (
                        image,
                      ) =>
                        image.role
                        === "cover",
                    )
                  ?? venue.images?.[0];

                const location =
                  venue.public_location
                  || [
                    venue.city,
                    venue.province,
                  ]
                    .filter(
                      Boolean,
                    )
                    .join(
                      ", ",
                    );

                return (
                  <article
                    key={
                      venue.id
                    }
                    className={
                      styles.card
                    }
                  >
                    <Link
                      href={
                        `/espacios/${venue.slug}`
                      }
                      className={
                        styles.media
                      }
                    >
                      {
                        cover?.url
                          ? (
                            <img
                              src={
                                cover.url
                              }
                              alt={
                                venue.name
                              }
                            />
                          )
                          : (
                            <div
                              className={
                                styles.placeholder
                              }
                            >
                              Sin imagen de portada
                            </div>
                          )
                      }
                    </Link>

                    <div
                      className={
                        styles.cardBody
                      }
                    >
                      <div
                        className={
                          styles.location
                        }
                      >
                        {
                          location
                          || "Valencia"
                        }
                      </div>

                      <h2>
                        {venue.name}
                      </h2>

                      <div
                        className={
                          styles.meta
                        }
                      >
                        {
                          venue.capacity_max
                            ? (
                              <span>
                                Hasta{" "}
                                {
                                  venue.capacity_max
                                } personas
                              </span>
                            )
                            : null
                        }
                      </div>

                      <div
                        className={
                          styles.price
                        }
                      >
                        Desde

                        <strong>
                          {
                            money(
                              venue.client_price_from,
                              venue.currency
                              || "EUR",
                            )
                          }
                        </strong>
                      </div>

                      <Link
                        className={
                          styles.link
                        }
                        href={
                          `/espacios/${venue.slug}`
                        }
                      >
                        Ver espacio
                        <span>→</span>
                      </Link>
                    </div>
                  </article>
                );
              },
            )
          }
        </section>

        {
          services.length
            > 0
            ? (
              <section
                className={
                  styles.services
                }
              >
                <div
                  className={
                    styles.eyebrow
                  }
                >
                  Todo en un mismo lugar
                </div>

                <h2>
                  También organizamos el resto del evento.
                </h2>

                <p>
                  Además del espacio podemos coordinar proveedores,
                  producción y servicios para que el cliente no tenga que
                  gestionar cada parte por separado.
                </p>

                <div
                  className={
                    styles.serviceGrid
                  }
                >
                  {
                    services.map(
                      (
                        service,
                      ) => (
                        <article
                          key={
                            service.id
                          }
                          className={
                            styles.service
                          }
                        >
                          <div
                            className={
                              styles.serviceIcon
                            }
                          >
                            {
                              service.icon
                              || "•"
                            }
                          </div>

                          <strong>
                            {service.name}
                          </strong>

                          {
                            service.description
                              ? (
                                <p>
                                  {
                                    service.description
                                  }
                                </p>
                              )
                              : null
                          }
                        </article>
                      ),
                    )
                  }
                </div>
              </section>
            )
            : null
        }
      </div>
    </main>
  );
}
