"use client";

export type MatchingProvider = {
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

  whatsapp?: string | null;
};

export type MatchingService = {
  id: string;

  provider_id: string;
  category_id: string;

  name: string;

  capacity_min?: number | null;
  capacity_max?: number | null;

  lead_time_days?: number | null;

  active?: boolean;
};

type MatchResult = {
  provider:
    MatchingProvider;

  services:
    MatchingService[];

  compatible:
    boolean;

  score:
    number;

  reasons:
    string[];

  warnings:
    string[];
};

type Props = {
  categoryId?: string | null;

  categoryName?: string | null;

  city?: string | null;

  province?: string | null;

  guests?: number | null;

  providers:
    MatchingProvider[];

  services:
    MatchingService[];

  onRequestQuote?: (
    provider:
      MatchingProvider,
  ) => void;

  onSelectProvider?: (
    provider:
      MatchingProvider,
  ) => void;
};

function normalize(
  value?:
    string
    | null,
) {
  return (
    value
      ?.trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
    ?? ""
  );
}

export function ProviderMatchingPanel({
  categoryId,
  categoryName,
  city,
  province,
  guests,
  providers,
  services,
  onRequestQuote,
  onSelectProvider,
}: Props) {
  const results:
    MatchResult[] =
    providers
      .map(
        (
          provider,
        ) => {
          const providerServices =
            services.filter(
              (
                service,
              ) =>
                service.provider_id
                === provider.id
                && service.active
                !== false,
            );

          const matchingServices =
            categoryId
              ? providerServices
                  .filter(
                    (
                      service,
                    ) =>
                      service
                        .category_id
                      === categoryId,
                  )
              : providerServices;

          const reasons:
            string[] = [];

          const warnings:
            string[] = [];

          let score =
            0;

          if (
            categoryId
            && matchingServices
              .length
          ) {
            score +=
              40;

            reasons.push(
              "Ofrece el servicio requerido",
            );
          }

          const targetCity =
            normalize(
              city,
            );

          const providerCity =
            normalize(
              provider.city,
            );

          const coverage =
            normalize(
              provider
                .service_area,
            );

          if (
            targetCity
            && (
              providerCity
                === targetCity
              || coverage.includes(
                targetCity,
              )
            )
          ) {
            score +=
              20;

            reasons.push(
              "Cubre la ciudad del evento",
            );
          } else if (
            targetCity
          ) {
            warnings.push(
              "Cobertura geográfica por confirmar",
            );
          }

          const targetProvince =
            normalize(
              province,
            );

          const providerProvince =
            normalize(
              provider.province,
            );

          if (
            targetProvince
            && targetProvince
              === providerProvince
          ) {
            score +=
              10;

            reasons.push(
              "Misma provincia",
            );
          }

          if (
            guests
            && matchingServices
              .length
          ) {
            const fits =
              matchingServices.some(
                (
                  service,
                ) => {
                  const min =
                    service
                      .capacity_min
                    ?? 0;

                  const max =
                    service
                      .capacity_max
                    ?? Number
                      .MAX_SAFE_INTEGER;

                  return (
                    guests >= min
                    && guests <= max
                  );
                },
              );

            if (fits) {
              score +=
                20;

              reasons.push(
                "Capacidad compatible",
              );
            } else {
              warnings.push(
                "Capacidad no confirmada para este número de invitados",
              );
            }
          }

          const incidents =
            provider
              .incident_count
            ?? 0;

          if (
            incidents === 0
          ) {
            score +=
              5;

            reasons.push(
              "Sin incidencias registradas",
            );
          } else {
            warnings.push(
              `${incidents} incidencia${
                incidents === 1
                  ? ""
                  : "s"
              } registrada${
                incidents === 1
                  ? ""
                  : "s"
              }`,
            );
          }

          const rating =
            Number(
              provider
                .internal_rating
              ?? 0,
            );

          if (
            rating >= 4
          ) {
            score +=
              5;

            reasons.push(
              "Buena valoración interna",
            );
          }

          return {
            provider,
            services:
              matchingServices,
            score,
            reasons,
            warnings,

            compatible:
              !categoryId
              || matchingServices
                .length > 0,
          };
        },
      )
      .filter(
        (
          item,
        ) =>
          item.compatible,
      )
      .sort(
        (
          a,
          b,
        ) =>
          b.score
          - a.score,
      );

  return (
    <section
      style={{
        display:
          "grid",

        gap:
          16,
      }}
    >
      <header>
        <h3
          style={{
            margin:
              0,
          }}
        >
          Proveedores compatibles
        </h3>

        <div
          style={{
            marginTop:
              4,

            color:
              "#6b7280",

            fontSize:
              12,
          }}
        >
          {
            categoryName
            ?? "Servicio"
          }

          {
            city
              ? ` · ${city}`
              : ""
          }

          {
            guests
              ? ` · ${guests} personas`
              : ""
          }
        </div>
      </header>

      <div
        style={{
          display:
            "grid",

          gap:
            10,
        }}
      >
        {results.map(
          (
            result,
            index,
          ) => (
            <article
              key={
                result
                  .provider.id
              }
              style={{
                display:
                  "grid",

                gap:
                  12,

                padding:
                  16,

                border:
                  "1px solid #e5e7eb",

                borderRadius:
                  12,

                background:
                  "#fff",
              }}
            >
              <div
                style={{
                  display:
                    "flex",

                  justifyContent:
                    "space-between",

                  gap:
                    16,

                  alignItems:
                    "flex-start",
                }}
              >
                <div>
                  <div
                    style={{
                      display:
                        "flex",

                      gap:
                        8,

                      alignItems:
                        "center",

                      flexWrap:
                        "wrap",
                    }}
                  >
                    <strong>
                      {
                        result
                          .provider
                          .name
                      }
                    </strong>

                    {index === 0 ? (
                      <span
                        style={{
                          fontSize:
                            10,

                          padding:
                            "3px 7px",

                          borderRadius:
                            999,

                          background:
                            "#111827",

                          color:
                            "#fff",
                        }}
                      >
                        MEJOR MATCH
                      </span>
                    ) : null}
                  </div>

                  <div
                    style={{
                      marginTop:
                        4,

                      color:
                        "#6b7280",

                      fontSize:
                        12,
                    }}
                  >
                    {
                      [
                        result
                          .provider
                          .city,

                        result
                          .provider
                          .province,
                      ]
                        .filter(
                          Boolean,
                        )
                        .join(
                          " · ",
                        )
                    }
                  </div>
                </div>

                <strong
                  style={{
                    fontSize:
                      18,
                  }}
                >
                  {
                    result.score
                  }
                  /100
                </strong>
              </div>

              <div
                style={{
                  display:
                    "flex",

                  flexWrap:
                    "wrap",

                  gap:
                    6,
                }}
              >
                {result.services.map(
                  (
                    service,
                  ) => (
                    <span
                      key={
                        service.id
                      }
                      style={{
                        padding:
                          "4px 8px",

                        borderRadius:
                          999,

                        background:
                          "#f3f4f6",

                        fontSize:
                          11,
                      }}
                    >
                      {
                        service.name
                      }
                    </span>
                  ),
                )}
              </div>

              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(220px,1fr))",

                  gap:
                    10,
                }}
              >
                <div>
                  <strong
                    style={{
                      fontSize:
                        12,
                    }}
                  >
                    Compatible
                  </strong>

                  {result.reasons.map(
                    (
                      reason,
                    ) => (
                      <div
                        key={
                          reason
                        }
                        style={{
                          marginTop:
                            4,

                          fontSize:
                            12,

                          color:
                            "#166534",
                        }}
                      >
                        ✓ {reason}
                      </div>
                    ),
                  )}
                </div>

                {result.warnings.length ? (
                  <div>
                    <strong
                      style={{
                        fontSize:
                          12,
                      }}
                    >
                      Revisar
                    </strong>

                    {result.warnings.map(
                      (
                        warning,
                      ) => (
                        <div
                          key={
                            warning
                          }
                          style={{
                            marginTop:
                              4,

                            fontSize:
                              12,

                            color:
                              "#92400e",
                          }}
                        >
                          ⚠ {warning}
                        </div>
                      ),
                    )}
                  </div>
                ) : null}
              </div>

              <div
                style={{
                  display:
                    "flex",

                  justifyContent:
                    "flex-end",

                  gap:
                    8,

                  flexWrap:
                    "wrap",
                }}
              >
                {onRequestQuote ? (
                  <button
                    type="button"
                    onClick={() =>
                      onRequestQuote(
                        result
                          .provider,
                      )
                    }
                  >
                    Solicitar presupuesto
                  </button>
                ) : null}

                {onSelectProvider ? (
                  <button
                    type="button"
                    onClick={() =>
                      onSelectProvider(
                        result
                          .provider,
                      )
                    }
                  >
                    Seleccionar
                  </button>
                ) : null}
              </div>
            </article>
          ),
        )}

        {!results.length ? (
          <div
            style={{
              padding:
                24,

              textAlign:
                "center",

              border:
                "1px dashed #d1d5db",

              borderRadius:
                10,

              color:
                "#6b7280",
            }}
          >
            No hay proveedores
            compatibles registrados
            para este servicio.
          </div>
        ) : null}
      </div>
    </section>
  );
}
