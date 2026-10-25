"use client";

import ReservaEspacio from "./reserva-espacio";

import Link
  from "next/link";

import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import styles
  from "../venues-public.module.css";


type ImageItem = {
  id?: string;
  url?: string | null;
  role?: string;
  is_visible?: boolean;
};


type Service = {
  id: string;
  name: string;
  icon?: string | null;
  description?: string | null;
};


type Venue = {
  id: string;
  name: string;
  slug: string;
  status?: string | null;

  description?: string | null;

  province?: string | null;
  city?: string | null;
  public_location?: string | null;

  capacity_min?: number | null;
  capacity_max?: number | null;

  client_price_from?:
    number
    | string
    | null;

  currency?: string | null;

  features?: string[];
  included_services?: string[];
  suitable_for?: string[];

  public_notes?: string | null;

  images?: ImageItem[];
};


function money(
  value:
    number
    | string
    | null
    | undefined,

  currency = "EUR",
) {
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
      Number(
        value
        ?? 0,
      ),
    );
}


function capacityText(
  venue: Venue,
) {
  const min =
    venue.capacity_min;

  const max =
    venue.capacity_max;

  if (
    min
    && max
    && min !== max
  ) {
    return `${min} - ${max} invitados`;
  }

  if (max) {
    return `Hasta ${max} invitados`;
  }

  if (min) {
    return `Desde ${min} invitados`;
  }

  return null;
}


export default function VenueDetailPage() {
  const params =
    useParams<{
      slug: string;
    }>();

  const [
    venue,
    setVenue,
  ] =
    useState<
      Venue | null
    >(
      null,
    );

  const [
    services,
    setServices,
  ] =
    useState<
      Service[]
    >(
      [],
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

  const [
    isPreview,
    setIsPreview,
  ] =
    useState(
      false,
    );


  useEffect(
    () => {
      if (
        !params.slug
      ) {
        return;
      }

      void (
        async () => {
          try {
            setError(
              null,
            );

            const previewId =
              new URLSearchParams(
                window.location.search,
              )
                .get(
                  "preview",
                );

            /*
             * PREVIEW ADMINISTRATIVO
             *
             * Usa el endpoint CRM autenticado, por lo que podemos
             * mostrar espacios draft sin hacerlos públicos.
             */
            if (previewId) {
              setIsPreview(
                true,
              );

              const [
                venueResponse,
                publicResponse,
              ] =
                await Promise.all([
                  fetch(
                    `/api/crm/venues/${encodeURIComponent(
                      previewId,
                    )}`,
                  ),

                  /*
                   * Solo utilizamos el endpoint público general
                   * para obtener el catálogo de servicios activos.
                   */
                  fetch(
                    "/api/public/venues",
                  ),
                ]);

              const body =
                await venueResponse
                  .json();

              if (
                !venueResponse.ok
              ) {
                throw new Error(
                  body?.error
                  ?? "No se pudo cargar la previsualización.",
                );
              }

              const previewImages:
                ImageItem[] =
                Array.isArray(
                  body.images,
                )
                  ? body.images
                      .filter(
                        (
                          image: ImageItem,
                        ) =>
                          image.is_visible
                          !== false
                          && Boolean(
                            image.url,
                          ),
                      )
                  : [];

              setVenue({
                ...body.venue,

                images:
                  previewImages,
              });

              if (
                publicResponse.ok
              ) {
                const publicBody =
                  await publicResponse
                    .json();

                setServices(
                  publicBody.services
                  ?? [],
                );
              }

              return;
            }

            /*
             * VISITA PUBLICA REAL
             *
             * Sigue utilizando exclusivamente el endpoint que exige
             * status=published.
             */
            setIsPreview(
              false,
            );

            const response =
              await fetch(
                `/api/public/venues/${encodeURIComponent(
                  params.slug,
                )}`,
              );

            const body =
              await response
                .json();

            if (
              !response.ok
            ) {
              throw new Error(
                body?.error
                ?? "No se encontró el espacio.",
              );
            }

            setVenue(
              body.venue,
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
                : "No se encontró el espacio.",
            );
          }
        }
      )();
    },
    [
      params.slug,
    ],
  );


  if (error) {
    return (
      <main
        className={
          styles.page
        }
      >
        <div
          className={
            styles.detail
          }
        >
          <Link
            href="/espacios"
            className={
              styles.back
            }
          >
            ← Volver a espacios
          </Link>

          <div
            className={
              styles.empty
            }
          >
            {error}
          </div>
        </div>
      </main>
    );
  }


  if (!venue) {
    return (
      <main
        className={
          styles.page
        }
      >
        <div
          className={
            styles.detail
          }
        >
          <div
            className={
              styles.empty
            }
          >
            Cargando espacio…
          </div>
        </div>
      </main>
    );
  }



  // EVENTOS_SHARED_OWNER_MEDIA_V1
  const sharedVideos = (
    (venue as unknown as {
      videos?: Array<{ id?: string; url?: string }>;
    }).videos ?? []
  ).filter(video => Boolean(video.url));

  const images =
    venue.images
      ?.filter(
        (
          image,
        ) =>
          Boolean(
            image.url,
          ),
      )
    ?? [];


  const cover =
    images.find(
      (
        image,
      ) =>
        image.role
        === "cover",
    )
    ?? images[0];


  const gallery =
    images.filter(
      (
        image,
      ) =>
        image
        !== cover,
    );


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


  const capacity =
    capacityText(
      venue,
    );


  const hasPrice =
    venue.client_price_from
    !== null
    && venue.client_price_from
    !== undefined
    && Number(
      venue.client_price_from,
    ) > 0;





  return (
    <main
      className={
        styles.page
      }
    >
      <div
        className={
          styles.detail
        }
      >
        {
          isPreview
            ? (
                <div
                  className={
                    styles.previewBanner
                  }
                >
                  <strong>
                    PREVISUALIZACIÓN
                  </strong>

                  <span>
                    Este espacio todavía no está publicado.
                    Esta es la apariencia que tendrá para el cliente.
                  </span>
                </div>
              )
            : null
        }


        <Link
          href={
            isPreview
              ? "/crm/espacios"
              : "/espacios"
          }
          className={
            styles.back
          }
        >
          ← {
            isPreview
              ? "Volver al CRM"
              : "Todos los espacios"
          }
        </Link>


        <section
          className={
            styles.heroMosaic
          }
        >
          <div
            className={
              styles.heroMain
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
          </div>


          {
            gallery.length > 0
              ? (
                  <div
                    className={
                      styles.heroSide
                    }
                  >
                    {
                      gallery
                        .slice(
                          0,
                          2,
                        )
                        .map(
                          (
                            image,
                            index,
                          ) => (
                            <div
                              className={
                                styles.heroTile
                              }
                              key={
                                image.id
                                ?? index
                              }
                            >
                              <img
                                src={
                                  image.url
                                  ?? ""
                                }
                                alt={
                                  `${venue.name} ${index + 2}`
                                }
                              />
                            </div>
                          ),
                        )
                    }
                  </div>
                )
              : null
          }
        </section>


        <div
          className={
            styles.detailGrid
          }
        >
          <section>
            <div
              className={
                styles.eyebrow
              }
            >
              {
                location
                || "Valencia"
              }
            </div>

            <h1>
              {venue.name}
            </h1>


            <div
              className={
                styles.summaryMeta
              }
            >
              {
                capacity
                  ? (
                      <span>
                        👥 {capacity}
                      </span>
                    )
                  : null
              }

              {
                venue.suitable_for
                && venue.suitable_for.length
                  ? (
                      <span>
                        ✦ {
                          venue.suitable_for
                            .slice(
                              0,
                              3,
                            )
                            .join(
                              " · ",
                            )
                        }
                      </span>
                    )
                  : null
              }
            </div>


            {
              venue.description
                ? (
                    <section
                      className={
                        styles.infoBlock
                      }
                    >
                      <h2>
                        Sobre el espacio
                      </h2>

                      <div
                        className={
                          styles.description
                        }
                      >
                        {
                          venue.description
                        }
                      </div>
                    </section>
                  )
                : null
            }


            {
              venue.features
              && venue.features.length
                ? (
                    <section
                      className={
                        styles.infoBlock
                      }
                    >
                      <h2>
                        Lo que ofrece
                      </h2>

                      <div
                        className={
                          styles.infoGrid
                        }
                      >
                        {
                          venue.features
                            .map(
                              (
                                feature,
                              ) => (
                                <div
                                  className={
                                    styles.infoItem
                                  }
                                  key={
                                    feature
                                  }
                                >
                                  <span>
                                    ✓
                                  </span>

                                  {
                                    feature
                                  }
                                </div>
                              ),
                            )
                        }
                      </div>
                    </section>
                  )
                : null
            }


            {
              venue.suitable_for
              && venue.suitable_for.length
                ? (
                    <section
                      className={
                        styles.infoBlock
                      }
                    >
                      <h2>
                        Ideal para
                      </h2>

                      <div
                        className={
                          styles.tags
                        }
                      >
                        {
                          venue.suitable_for
                            .map(
                              (
                                item,
                              ) => (
                                <span
                                  className={
                                    styles.tag
                                  }
                                  key={
                                    item
                                  }
                                >
                                  {item}
                                </span>
                              ),
                            )
                        }
                      </div>
                    </section>
                  )
                : null
            }


            {
              venue.included_services
              && venue.included_services.length
                ? (
                    <section
                      className={
                        styles.infoBlock
                      }
                    >
                      <h2>
                        Incluido con el espacio
                      </h2>

                      <div
                        className={
                          styles.infoGrid
                        }
                      >
                        {
                          venue.included_services
                            .map(
                              (
                                item,
                              ) => (
                                <div
                                  className={
                                    styles.infoItem
                                  }
                                  key={
                                    item
                                  }
                                >
                                  <span>
                                    ✓
                                  </span>

                                  {item}
                                </div>
                              ),
                            )
                        }
                      </div>
                    </section>
                  )
                : null
            }


            {
              venue.public_notes
                ? (
                    <section
                      className={
                        styles.infoBlock
                      }
                    >
                      <h2>
                        Condiciones e información importante
                      </h2>

                      <div
                        className={
                          styles.notes
                        }
                      >
                        {
                          venue.public_notes
                        }
                      </div>
                    </section>
                  )
                : null
            }


            {
              gallery.length > 2
                ? (
                    <section
                      className={
                        styles.infoBlock
                      }
                    >
                      <h2>
                        Galería
                      </h2>

                      <div
                        className={
                          styles.gallery
                        }
                      >
                        {
                          gallery
                            .slice(
                              2,
                            )
                            .map(
                              (
                                image,
                                index,
                              ) => (
                                <img
                                  key={
                                    image.id
                                    ?? index
                                  }
                                  src={
                                    image.url
                                    ?? ""
                                  }
                                  alt={
                                    `${venue.name} ${index + 4}`
                                  }
                                />
                              ),
                            )
                        }
                      </div>
                    </section>
                  )
                : null
            }
          </section>


          <aside
            className={
              styles.side
            }
          >
            <div
              className={
                styles.sideLabel
              }
            >
              {
                hasPrice
                  ? "Precio desde"
                  : "Precio"
              }
            </div>

            <div
              className={
                styles.sidePrice
              }
            >
              {
                hasPrice
                  ? money(
                      venue.client_price_from,
                      venue.currency
                      || "EUR",
                    )
                  : "Consultar"
              }
            </div>


            {
              capacity
                ? (
                    <p>
                      👥 {capacity}
                    </p>
                  )
                : null
            }


            {
              location
                ? (
                    <p>
                      📍 {location}
                    </p>
                  )
                : null
            }


            <ReservaEspacio venue={venue} services={services} />

            <div
              className={
                styles.reserveHint
              }
            >
              Indica fecha, número de invitados y tipo de evento.
              Confirmaremos disponibilidad antes de cerrar la reserva.
            </div>
          </aside>
        </div>


        {
          services.length > 0
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
                    Completa tu evento
                  </div>

                  <h2>
                    Servicios adicionales
                  </h2>

                  <p>
                    Podemos añadir servicios al espacio según las
                    necesidades del evento.
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
                              {
                                service.name
                              }
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
    
        {sharedVideos.length > 0 && (
          <section style={{
            maxWidth: 1160,
            margin: "40px auto",
            padding: "0 20px",
          }}>
            <h2>Vídeos del espacio</h2>
            <div style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(240px,1fr))",
              gap: 16,
              marginTop: 20,
            }}>
              {sharedVideos.map((video, index) => (
                <video
                  key={video.id ?? index}
                  src={video.url}
                  controls
                  playsInline
                  preload="metadata"
                  style={{
                    display: "block",
                    width: "100%",
                    borderRadius: 12,
                    background: "#111",
                  }}
                />
              ))}
            </div>
          </section>
        )}
</main>
  );
}
