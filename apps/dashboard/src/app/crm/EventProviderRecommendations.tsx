"use client";

import styles
  from "./event-provider-recommendations.module.css";


type Provider = {
  id: string;
  name: string;

  city?: string | null;
  province?: string | null;
  service_area?: string | null;

  internal_rating?:
    number
    | string
    | null;

  times_used?: number | null;
  incident_count?: number | null;
};


type ProviderService = {
  id: string;

  provider_id: string;
  category_id: string;

  name: string;

  capacity_min?: number | null;
  capacity_max?: number | null;

  active?: boolean;
};


type Requirement = {
  id: string;

  category_id?:
    string | null;

  service_name?:
    string | null;

  is_required?:
    boolean;

  service_status?:
    string | null;
};


type Props = {
  providers:
    Provider[];

  providerServices:
    ProviderService[];

  requirements:
    Requirement[];

  city?:
    string | null;

  province?:
    string | null;

  guestCount?:
    number | null;
};


function normalize(
  value?:
    string | null,
) {
  return (
    value
      ?.trim()
      .toLocaleLowerCase(
        "es",
      )
    ?? ""
  );
}


export function EventProviderRecommendations({
  providers,
  providerServices,
  requirements,
  city,
  province,
  guestCount,
}: Props) {

  const requiredCategoryIds =
    new Set(
      requirements
        .filter(
          (
            requirement,
          ) =>
            requirement
              .is_required
            !== false
            && Boolean(
              requirement
                .category_id,
            ),
        )
        .map(
          (
            requirement,
          ) =>
            requirement
              .category_id as string,
        ),
    );


  const ranked =
    providers
      .map(
        (
          provider,
        ) => {

          const services =
            providerServices
              .filter(
                (
                  service,
                ) =>
                  service.provider_id
                  === provider.id
                  && service.active
                  !== false,
              );


          const matchingServices =
            services.filter(
              (
                service,
              ) =>
                requiredCategoryIds
                  .has(
                    service
                      .category_id,
                  ),
            );


          const matchedCategories =
            new Set(
              matchingServices
                .map(
                  (
                    service,
                  ) =>
                    service
                      .category_id,
                ),
            );


          const normalizedCity =
            normalize(
              city,
            );

          const normalizedProvince =
            normalize(
              province,
            );

          const providerCity =
            normalize(
              provider.city,
            );

          const providerProvince =
            normalize(
              provider.province,
            );

          const serviceArea =
            normalize(
              provider.service_area,
            );


          const cityMatch =
            Boolean(
              normalizedCity
              && (
                providerCity
                === normalizedCity
                || serviceArea
                  .includes(
                    normalizedCity,
                  )
              ),
            );


          const provinceMatch =
            Boolean(
              normalizedProvince
              && (
                providerProvince
                === normalizedProvince
                || serviceArea
                  .includes(
                    normalizedProvince,
                  )
              ),
            );


          const capacityCompatible =
            guestCount
            ? matchingServices.some(
                (
                  service,
                ) => {

                  const min =
                    Number(
                      service
                        .capacity_min
                      ?? 0,
                    );

                  const max =
                    Number(
                      service
                        .capacity_max
                      ?? 0,
                    );

                  const passesMin =
                    !min
                    || guestCount
                      >= min;

                  const passesMax =
                    !max
                    || guestCount
                      <= max;

                  return (
                    passesMin
                    && passesMax
                  );
                },
              )
            : false;


          const rating =
            Number(
              provider
                .internal_rating
              ?? 0,
            );


          const timesUsed =
            Number(
              provider
                .times_used
              ?? 0,
            );


          const incidents =
            Number(
              provider
                .incident_count
              ?? 0,
            );


          /*
           * Ranking operativo.
           *
           * No representa disponibilidad.
           * Solo prioriza información
           * actualmente almacenada.
           */
          let score =
            matchedCategories
              .size
            * 100;

          if (cityMatch) {
            score += 30;
          } else if (
            provinceMatch
          ) {
            score += 15;
          }

          if (
            capacityCompatible
          ) {
            score += 20;
          }

          score +=
            Math.max(
              0,
              Math.min(
                rating,
                5,
              ),
            )
            * 4;

          score +=
            Math.min(
              timesUsed,
              20,
            );

          score -=
            incidents
            * 10;


          return {
            provider,
            matchingServices,
            matchedCategories:
              matchedCategories.size,
            cityMatch,
            provinceMatch,
            capacityCompatible,
            rating,
            timesUsed,
            incidents,
            score,
          };
        },
      )
      .filter(
        (
          item,
        ) =>
          requiredCategoryIds
            .size
          === 0
          || item
            .matchedCategories
          > 0,
      )
      .sort(
        (
          left,
          right,
        ) =>
          right.score
          - left.score,
      )
      .slice(
        0,
        8,
      );


  return (
    <div
      className={
        styles.root
      }
    >

      <div
        className={
          styles.header
        }
      >
        <div>
          <span>
            MATCHING OPERATIVO
          </span>

          <h3>
            Proveedores compatibles
          </h3>

          <p>
            Recomendación basada
            en servicios,
            ubicación,
            capacidad,
            valoración e
            historial registrado.
          </p>
        </div>
      </div>


      <div
        className={
          styles.grid
        }
      >

        {ranked.map(
          (
            item,
            index,
          ) => {

            const {
              provider,
              matchingServices,
              matchedCategories,
              cityMatch,
              provinceMatch,
              capacityCompatible,
              rating,
              timesUsed,
              incidents,
            } = item;


            return (
              <article
                key={
                  provider.id
                }
                className={
                  styles.card
                }
              >

                <div
                  className={
                    styles.rank
                  }
                >
                  #{index + 1}
                </div>


                <div
                  className={
                    styles.body
                  }
                >

                  <strong>
                    {
                      provider.name
                    }
                  </strong>


                  <small>
                    {
                      [
                        provider.city,
                        provider
                          .province,
                      ]
                        .filter(
                          Boolean,
                        )
                        .join(
                          " · ",
                        )
                      || "Ubicación sin definir"
                    }
                  </small>


                  <div
                    className={
                      styles.tags
                    }
                  >

                    <span>
                      {
                        matchedCategories
                      }
                      {" "}
                      {
                        matchedCategories
                        === 1
                          ? "servicio compatible"
                          : "servicios compatibles"
                      }
                    </span>


                    {cityMatch ? (
                      <span>
                        Misma ciudad
                      </span>
                    ) : null}


                    {!cityMatch
                    && provinceMatch ? (
                      <span>
                        Misma provincia
                      </span>
                    ) : null}


                    {capacityCompatible
                      ? (
                        <span>
                          Capacidad compatible
                        </span>
                      )
                      : null}


                    {
                      Number
                        .isFinite(
                          rating,
                        )
                      && rating > 0
                        ? (
                          <span>
                            ★{" "}
                            {
                              rating
                                .toFixed(
                                  1,
                                )
                            }
                          </span>
                        )
                        : null
                    }


                    <span>
                      {
                        timesUsed
                      }
                      {" "}
                      eventos
                    </span>


                    <span>
                      {
                        incidents
                      }
                      {" "}
                      incidencias
                    </span>

                  </div>


                  {matchingServices
                    .length ? (
                    <small>
                      {
                        matchingServices
                          .map(
                            (
                              service,
                            ) =>
                              service
                                .name,
                          )
                          .filter(
                            (
                              name,
                              index,
                              list,
                            ) =>
                              list
                                .indexOf(
                                  name,
                                )
                              === index,
                          )
                          .slice(
                            0,
                            4,
                          )
                          .join(
                            " · ",
                          )
                      }
                    </small>
                  ) : null}


                  {provider
                    .service_area
                    ? (
                      <small>
                        Cobertura:{" "}
                        {
                          provider
                            .service_area
                        }
                      </small>
                    )
                    : null}

                </div>

              </article>
            );
          },
        )}


        {!ranked.length ? (
          <article
            className={
              styles.empty
            }
          >
            <strong>
              Sin coincidencias
            </strong>

            <p>
              No hay proveedores
              del catálogo vinculados
              a las categorías que
              necesita este evento.
            </p>
          </article>
        ) : null}

      </div>

    </div>
  );
}
