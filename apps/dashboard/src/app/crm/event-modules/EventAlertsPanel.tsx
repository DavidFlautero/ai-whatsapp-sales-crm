"use client";

export type EventAlert = {
  id: string;

  type:
    | "provider"
    | "requirement"
    | "task"
    | "payment"
    | "document"
    | "event";

  severity:
    | "info"
    | "warning"
    | "critical";

  title:
    string;

  message?:
    string
    | null;

  created_at?:
    string
    | null;

  resolved?:
    boolean;
};

type Props = {
  alerts:
    EventAlert[];

  onOpen?: (
    alert:
      EventAlert,
  ) => void;

  onResolve?: (
    alert:
      EventAlert,
  ) => void;
};

const LABELS = {
  info:
    "Información",

  warning:
    "Atención",

  critical:
    "Crítico",
};

export function EventAlertsPanel({
  alerts,
  onOpen,
  onResolve,
}: Props) {
  const active =
    alerts.filter(
      (
        alert,
      ) =>
        !alert.resolved,
    );

  const sorted =
    [...active]
      .sort(
        (
          a,
          b,
        ) => {
          const weight = {
            critical:
              3,

            warning:
              2,

            info:
              1,
          };

          return (
            weight[
              b.severity
            ]
            - weight[
              a.severity
            ]
          );
        },
      );

  return (
    <section
      style={{
        display:
          "grid",

        gap:
          12,
      }}
    >
      <header>
        <h3
          style={{
            margin:
              0,
          }}
        >
          Alertas operativas
        </h3>

        <div
          style={{
            marginTop:
              4,

            fontSize:
              12,

            color:
              "#6b7280",
          }}
        >
          {
            active.length
          }
          {" "}
          alertas activas
        </div>
      </header>

      <div
        style={{
          display:
            "grid",

          gap:
            8,
        }}
      >
        {sorted.map(
          (
            alert,
          ) => (
            <article
              key={
                alert.id
              }
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "minmax(0,1fr) auto",

                gap:
                  12,

                padding:
                  13,

                border:
                  alert.severity
                  === "critical"
                    ? "1px solid #fca5a5"
                    : alert.severity
                    === "warning"
                      ? "1px solid #fde68a"
                      : "1px solid #e5e7eb",

                borderRadius:
                  10,

                background:
                  alert.severity
                  === "critical"
                    ? "#fef2f2"
                    : alert.severity
                    === "warning"
                      ? "#fffbeb"
                      : "#fff",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  onOpen?.(
                    alert,
                  )
                }
                style={{
                  display:
                    "grid",

                  gap:
                    4,

                  padding:
                    0,

                  border:
                    0,

                  background:
                    "transparent",

                  textAlign:
                    "left",
                }}
              >
                <span
                  style={{
                    fontSize:
                      10,

                    fontWeight:
                      800,

                    letterSpacing:
                      ".06em",
                  }}
                >
                  {
                    LABELS[
                      alert.severity
                    ]
                  }
                </span>

                <strong>
                  {
                    alert.title
                  }
                </strong>

                {alert.message ? (
                  <span
                    style={{
                      color:
                        "#4b5563",

                      fontSize:
                        12,
                    }}
                  >
                    {
                      alert.message
                    }
                  </span>
                ) : null}
              </button>

              {onResolve ? (
                <button
                  type="button"
                  onClick={() =>
                    onResolve(
                      alert,
                    )
                  }
                >
                  Resolver
                </button>
              ) : null}
            </article>
          ),
        )}

        {!sorted.length ? (
          <div
            style={{
              padding:
                20,

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
            No hay alertas activas.
          </div>
        ) : null}
      </div>
    </section>
  );
}
