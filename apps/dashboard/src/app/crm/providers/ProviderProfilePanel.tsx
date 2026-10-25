"use client";

type DbId = string;

export type ProviderProfile = {
  id: DbId;
  name: string;

  legal_name?: string | null;
  contact_name?: string | null;

  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;

  tax_id?: string | null;

  city?: string | null;
  province?: string | null;
  address?: string | null;
  service_area?: string | null;

  status?: string | null;

  internal_rating?:
    | number
    | string
    | null;

  times_used?: number | null;
  incident_count?: number | null;

  notes?: string | null;
};

export type ProviderProfileService = {
  id: DbId;
  provider_id: DbId;
  category_id: DbId;

  name: string;
  description?: string | null;

  capacity_min?: number | null;
  capacity_max?: number | null;
  lead_time_days?: number | null;

  active?: boolean;
};

type Props = {
  provider:
    | ProviderProfile
    | null;

  services:
    ProviderProfileService[];

  onClose?: () => void;

  onEdit?: (
    provider:
      ProviderProfile,
  ) => void;

  onAddService?: (
    provider:
      ProviderProfile,
  ) => void;
};

function value(
  input:
    | string
    | number
    | null
    | undefined,
) {
  if (
    input === null
    || input === undefined
    || input === ""
  ) {
    return "—";
  }

  return String(input);
}

export function ProviderProfilePanel({
  provider,
  services,
  onClose,
  onEdit,
  onAddService,
}: Props) {
  if (!provider) {
    return null;
  }

  const rating =
    provider.internal_rating
    ? Number(
        provider
          .internal_rating,
      )
    : null;

  return (
    <section
      style={{
        display:
          "grid",

        gap:
          20,

        padding:
          22,

        border:
          "1px solid #e5e7eb",

        borderRadius:
          14,

        background:
          "#fff",
      }}
    >
      <header
        style={{
          display:
            "flex",

          alignItems:
            "flex-start",

          justifyContent:
            "space-between",

          gap:
            20,
        }}
      >
        <div>
          <div
            style={{
              fontSize:
                11,

              fontWeight:
                700,

              letterSpacing:
                ".08em",

              color:
                "#6b7280",
            }}
          >
            PROVEEDOR
          </div>

          <h2
            style={{
              margin:
                "4px 0 2px",

              fontSize:
                24,
            }}
          >
            {
              provider.name
            }
          </h2>

          <div
            style={{
              color:
                "#6b7280",

              fontSize:
                13,
            }}
          >
            {
              [
                provider.city,
                provider.province,
              ]
                .filter(Boolean)
                .join(" · ")
              || "Ubicación pendiente"
            }
          </div>
        </div>

        <div
          style={{
            display:
              "flex",

            gap:
              8,

            flexWrap:
              "wrap",
          }}
        >
          {onEdit ? (
            <button
              type="button"
              onClick={() =>
                onEdit(
                  provider,
                )
              }
            >
              Editar
            </button>
          ) : null}

          {onClose ? (
            <button
              type="button"
              onClick={
                onClose
              }
            >
              Cerrar
            </button>
          ) : null}
        </div>
      </header>

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(auto-fit,minmax(180px,1fr))",

          gap:
            12,
        }}
      >
        <Metric
          label="Valoración"
          value={
            rating !== null
              ? `${rating.toFixed(
                  1,
                )}/5`
              : "Sin valorar"
          }
        />

        <Metric
          label="Eventos realizados"
          value={
            provider
              .times_used
            ?? 0
          }
        />

        <Metric
          label="Incidencias"
          value={
            provider
              .incident_count
            ?? 0
          }
        />

        <Metric
          label="Estado"
          value={
            provider.status
            ?? "active"
          }
        />
      </div>

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(auto-fit,minmax(250px,1fr))",

          gap:
            16,
        }}
      >
        <Card
          title="Contacto"
        >
          <Line
            label="Persona"
            value={
              value(
                provider
                  .contact_name,
              )
            }
          />

          <Line
            label="WhatsApp"
            value={
              value(
                provider
                  .whatsapp,
              )
            }
          />

          <Line
            label="Teléfono"
            value={
              value(
                provider.phone,
              )
            }
          />

          <Line
            label="Email"
            value={
              value(
                provider.email,
              )
            }
          />

          <Line
            label="Web"
            value={
              value(
                provider.website,
              )
            }
          />
        </Card>

        <Card
          title="Ubicación y cobertura"
        >
          <Line
            label="Ciudad"
            value={
              value(
                provider.city,
              )
            }
          />

          <Line
            label="Provincia"
            value={
              value(
                provider
                  .province,
              )
            }
          />

          <Line
            label="Dirección"
            value={
              value(
                provider
                  .address,
              )
            }
          />

          <Line
            label="Cobertura"
            value={
              value(
                provider
                  .service_area,
              )
            }
          />
        </Card>

        <Card
          title="Empresa"
        >
          <Line
            label="Razón social"
            value={
              value(
                provider
                  .legal_name,
              )
            }
          />

          <Line
            label="CIF / NIF"
            value={
              value(
                provider.tax_id,
              )
            }
          />
        </Card>
      </div>

      <div>
        <div
          style={{
            display:
              "flex",

            justifyContent:
              "space-between",

            alignItems:
              "center",

            marginBottom:
              10,
          }}
        >
          <div>
            <strong>
              Servicios
            </strong>

            <div
              style={{
                fontSize:
                  12,

                color:
                  "#6b7280",
              }}
            >
              Capacidades registradas
              para este proveedor.
            </div>
          </div>

          {onAddService ? (
            <button
              type="button"
              onClick={() =>
                onAddService(
                  provider,
                )
              }
            >
              + Servicio
            </button>
          ) : null}
        </div>

        <div
          style={{
            display:
              "grid",

            gap:
              8,
          }}
        >
          {services.map(
            (
              service,
            ) => (
              <article
                key={
                  service.id
                }
                style={{
                  display:
                    "flex",

                  justifyContent:
                    "space-between",

                  gap:
                    20,

                  padding:
                    12,

                  border:
                    "1px solid #e5e7eb",

                  borderRadius:
                    10,
                }}
              >
                <div>
                  <strong>
                    {
                      service.name
                    }
                  </strong>

                  {service.description ? (
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
                        service
                          .description
                      }
                    </div>
                  ) : null}
                </div>

                <div
                  style={{
                    fontSize:
                      12,

                    color:
                      "#4b5563",

                    textAlign:
                      "right",
                  }}
                >
                  {
                    service
                      .capacity_max
                    ? `Hasta ${
                        service
                          .capacity_max
                      } personas`
                    : "Capacidad sin definir"
                  }
                </div>
              </article>
            ),
          )}

          {!services.length ? (
            <div
              style={{
                padding:
                  18,

                border:
                  "1px dashed #d1d5db",

                borderRadius:
                  10,

                color:
                  "#6b7280",

                textAlign:
                  "center",
              }}
            >
              Este proveedor todavía
              no tiene servicios
              configurados.
            </div>
          ) : null}
        </div>
      </div>

      {provider.notes ? (
        <Card
          title="Notas internas"
        >
          <p
            style={{
              margin:
                0,

              whiteSpace:
                "pre-wrap",
            }}
          >
            {
              provider.notes
            }
          </p>
        </Card>
      ) : null}
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value:
    | string
    | number;
}) {
  return (
    <div
      style={{
        padding:
          14,

        border:
          "1px solid #e5e7eb",

        borderRadius:
          10,

        background:
          "#f9fafb",
      }}
    >
      <div
        style={{
          fontSize:
            11,

          color:
            "#6b7280",
        }}
      >
        {label}
      </div>

      <strong
        style={{
          display:
            "block",

          marginTop:
            4,

          fontSize:
            17,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children:
    React.ReactNode;
}) {
  return (
    <section
      style={{
        padding:
          16,

        border:
          "1px solid #e5e7eb",

        borderRadius:
          10,
      }}
    >
      <strong>
        {title}
      </strong>

      <div
        style={{
          display:
            "grid",

          gap:
            8,

          marginTop:
            12,
        }}
      >
        {children}
      </div>
    </section>
  );
}

function Line({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display:
          "flex",

        justifyContent:
          "space-between",

        gap:
          16,

        fontSize:
          13,
      }}
    >
      <span
        style={{
          color:
            "#6b7280",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          textAlign:
            "right",
        }}
      >
        {value}
      </strong>
    </div>
  );
}
