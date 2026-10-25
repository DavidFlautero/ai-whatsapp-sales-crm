"use client";

export type EventNeed = {
  id: string;

  category_id?:
    string
    | null;

  category_name?:
    string
    | null;

  service_name?:
    string
    | null;

  requirement?:
    string
    | null;

  description?:
    string
    | null;

  status?:
    string
    | null;

  priority?:
    string
    | null;

  quantity?:
    number
    | null;

  assigned_provider_id?:
    string
    | null;

  provider_name?:
    string
    | null;

  responsible_name?:
    string
    | null;

  due_date?:
    string
    | null;

  required?:
    boolean
    | null;

  critical?:
    boolean
    | null;
};

type Props = {
  needs:
    EventNeed[];

  onOpenNeed?: (
    need:
      EventNeed,
  ) => void;

  onSearchProviders?: (
    need:
      EventNeed,
  ) => void;

  onAddNeed?: () => void;
};

const STATUS_LABELS:
  Record<string,string> = {
    pending:
      "Pendiente",

    sourcing:
      "Buscando proveedor",

    quoting:
      "Cotizando",

    option_found:
      "Opción encontrada",

    approval:
      "Pendiente cliente",

    reserved:
      "Reservado",

    confirmed:
      "Confirmado",

    cancelled:
      "Cancelado",
  };

function statusLabel(
  status?: string | null,
) {
  if (!status) {
    return "Pendiente";
  }

  return (
    STATUS_LABELS[
      status
    ]
    ?? status
  );
}

function statusSymbol(
  status?: string | null,
) {
  switch (status) {
    case "confirmed":
    case "reserved":
      return "✓";

    case "sourcing":
    case "quoting":
    case "option_found":
    case "approval":
      return "⚠";

    default:
      return "○";
  }
}

export function EventNeedsChecklist({
  needs,
  onOpenNeed,
  onSearchProviders,
  onAddNeed,
}: Props) {
  const criticalPending =
    needs.filter(
      (need) =>
        need.critical
        && ![
          "confirmed",
          "reserved",
        ].includes(
          need.status
          ?? "",
        ),
    );

  const completed =
    needs.filter(
      (need) =>
        [
          "confirmed",
          "reserved",
        ].includes(
          need.status
          ?? "",
        ),
    ).length;

  const readiness =
    needs.length
      ? Math.round(
          (
            completed
            / needs.length
          )
          * 100,
        )
      : 0;

  return (
    <section
      style={{
        display:
          "grid",

        gap:
          16,
      }}
    >
      <header
        style={{
          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "space-between",

          gap:
            16,
        }}
      >
        <div>
          <h3
            style={{
              margin:
                0,
            }}
          >
            Checklist del evento
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
              completed
            }
            /
            {
              needs.length
            }
            {" "}
            necesidades resueltas
          </div>
        </div>

        {onAddNeed ? (
          <button
            type="button"
            onClick={
              onAddNeed
            }
          >
            + Necesidad
          </button>
        ) : null}
      </header>

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "1fr auto",

          gap:
            14,

          alignItems:
            "center",
        }}
      >
        <div
          style={{
            height:
              8,

            borderRadius:
              999,

            overflow:
              "hidden",

            background:
              "#e5e7eb",
          }}
        >
          <div
            style={{
              height:
                "100%",

              width:
                `${readiness}%`,

              background:
                readiness
                === 100
                  ? "#166534"
                  : "#111827",
            }}
          />
        </div>

        <strong>
          {
            readiness
          }
          %
        </strong>
      </div>

      {criticalPending.length ? (
        <div
          style={{
            padding:
              12,

            border:
              "1px solid #fecaca",

            borderRadius:
              10,

            background:
              "#fef2f2",

            fontSize:
              13,
          }}
        >
          <strong>
            {
              criticalPending.length
            }
            {" "}
            necesidad
            {
              criticalPending.length
              === 1
                ? ""
                : "es"
            }
            {" "}
            crítica
            {
              criticalPending.length
                === 1
                ? ""
                : "s"
            }
            {" "}
            pendiente
            {
              criticalPending.length
                === 1
                ? ""
                : "s"
            }
          </strong>
        </div>
      ) : null}

      <div
        style={{
          display:
            "grid",

          gap:
            8,
        }}
      >
        {needs.map(
          (
            need,
          ) => {
            const title =
              need.service_name
              ?? need.category_name
              ?? need.requirement
              ?? "Necesidad";

            return (
              <article
                key={
                  need.id
                }
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "38px minmax(0,1fr) auto",

                  gap:
                    12,

                  alignItems:
                    "center",

                  padding:
                    13,

                  border:
                    need.critical
                      ? "1px solid #fca5a5"
                      : "1px solid #e5e7eb",

                  borderRadius:
                    10,

                  background:
                    "#fff",
                }}
              >
                <div
                  style={{
                    display:
                      "grid",

                    placeItems:
                      "center",

                    width:
                      34,

                    height:
                      34,

                    borderRadius:
                      999,

                    background:
                      "#f3f4f6",

                    fontWeight:
                      800,
                  }}
                >
                  {
                    statusSymbol(
                      need.status,
                    )
                  }
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onOpenNeed?.(
                      need,
                    )
                  }
                  style={{
                    display:
                      "grid",

                    gap:
                      3,

                    padding:
                      0,

                    border:
                      0,

                    background:
                      "transparent",

                    textAlign:
                      "left",

                    cursor:
                      onOpenNeed
                        ? "pointer"
                        : "default",
                  }}
                >
                  <strong>
                    {title}
                  </strong>

                  <span
                    style={{
                      color:
                        "#6b7280",

                      fontSize:
                        12,
                    }}
                  >
                    {
                      statusLabel(
                        need.status,
                      )
                    }

                    {
                      need.provider_name
                        ? ` · ${need.provider_name}`
                        : ""
                    }

                    {
                      need.responsible_name
                        ? ` · Resp. ${need.responsible_name}`
                        : ""
                    }
                  </span>
                </button>

                <div>
                  {!need.assigned_provider_id
                    && onSearchProviders
                    ? (
                      <button
                        type="button"
                        onClick={() =>
                          onSearchProviders(
                            need,
                          )
                        }
                      >
                        Buscar proveedores
                      </button>
                    )
                    : null}
                </div>
              </article>
            );
          },
        )}

        {!needs.length ? (
          <div
            style={{
              padding:
                22,

              border:
                "1px dashed #d1d5db",

              borderRadius:
                10,

              textAlign:
                "center",

              color:
                "#6b7280",
            }}
          >
            El evento todavía no
            tiene necesidades
            registradas.
          </div>
        ) : null}
      </div>
    </section>
  );
}
