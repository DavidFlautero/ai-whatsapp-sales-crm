"use client";

export type AssistantAction = {
  id: string;

  priority:
    | "low"
    | "normal"
    | "high"
    | "critical";

  title: string;

  reason?:
    string
    | null;

  action_label?:
    string
    | null;
};

export type OperationsAnalysis = {
  summary:
    string;

  readiness?:
    number
    | null;

  event_days_remaining?:
    number
    | null;

  risks:
    string[];

  actions:
    AssistantAction[];

  generated_at?:
    string
    | null;
};

type Props = {
  analysis:
    OperationsAnalysis
    | null;

  loading?:
    boolean;

  onRefresh?: () => void;

  onAction?: (
    action:
      AssistantAction,
  ) => void;
};

export function EventOperationsAssistant({
  analysis,
  loading = false,
  onRefresh,
  onAction,
}: Props) {
  if (
    loading
  ) {
    return (
      <section
        style={{
          padding:
            20,

          border:
            "1px solid #e5e7eb",

          borderRadius:
            12,
        }}
      >
        Analizando operación…
      </section>
    );
  }

  if (
    !analysis
  ) {
    return (
      <section
        style={{
          display:
            "grid",

          gap:
            12,

          padding:
            20,

          border:
            "1px solid #e5e7eb",

          borderRadius:
            12,
        }}
      >
        <strong>
          Asistente operativo
        </strong>

        <span
          style={{
            color:
              "#6b7280",

            fontSize:
              13,
          }}
        >
          Todavía no existe un
          análisis del evento.
        </span>

        {onRefresh ? (
          <button
            type="button"
            onClick={
              onRefresh
            }
          >
            Analizar evento
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section
      style={{
        display:
          "grid",

        gap:
          18,

        padding:
          20,

        border:
          "1px solid #d1d5db",

        borderRadius:
          12,

        background:
          "#fff",
      }}
    >
      <header
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "flex-start",

          gap:
            16,
        }}
      >
        <div>
          <div
            style={{
              fontSize:
                11,

              fontWeight:
                800,

              letterSpacing:
                ".08em",

              color:
                "#6b7280",
            }}
          >
            ASISTENTE DE OPERACIONES
          </div>

          <h3
            style={{
              margin:
                "5px 0 0",
            }}
          >
            Situación del evento
          </h3>
        </div>

        {onRefresh ? (
          <button
            type="button"
            onClick={
              onRefresh
            }
          >
            Actualizar análisis
          </button>
        ) : null}
      </header>

      <p
        style={{
          margin:
            0,

          fontSize:
            15,

          lineHeight:
            1.55,
        }}
      >
        {
          analysis.summary
        }
      </p>

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(auto-fit,minmax(160px,1fr))",

          gap:
            10,
        }}
      >
        <Metric
          label="Preparación"
          value={
            analysis.readiness
            !== null
            && analysis.readiness
            !== undefined
              ? `${analysis.readiness}%`
              : "—"
          }
        />

        <Metric
          label="Días restantes"
          value={
            analysis
              .event_days_remaining
            !== null
            && analysis
              .event_days_remaining
            !== undefined
              ? String(
                  analysis
                    .event_days_remaining,
                )
              : "—"
          }
        />

        <Metric
          label="Riesgos"
          value={
            String(
              analysis
                .risks
                .length,
            )
          }
        />

        <Metric
          label="Acciones"
          value={
            String(
              analysis
                .actions
                .length,
            )
          }
        />
      </div>

      {analysis.risks.length ? (
        <section
          style={{
            padding:
              14,

            borderRadius:
              10,

            background:
              "#fef2f2",
          }}
        >
          <strong>
            Riesgos detectados
          </strong>

          <div
            style={{
              display:
                "grid",

              gap:
                5,

              marginTop:
                8,
            }}
          >
            {analysis.risks.map(
              (
                risk,
              ) => (
                <div
                  key={
                    risk
                  }
                  style={{
                    fontSize:
                      13,
                  }}
                >
                  • {risk}
                </div>
              ),
            )}
          </div>
        </section>
      ) : null}

      <section
        style={{
          display:
            "grid",

          gap:
            8,
        }}
      >
        <strong>
          Siguientes acciones
        </strong>

        {analysis.actions.map(
          (
            action,
            index,
          ) => (
            <article
              key={
                action.id
              }
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "30px minmax(0,1fr) auto",

                gap:
                  10,

                alignItems:
                  "center",

                padding:
                  12,

                border:
                  action.priority
                  === "critical"
                    ? "1px solid #fca5a5"
                    : "1px solid #e5e7eb",

                borderRadius:
                  9,
              }}
            >
              <strong>
                {
                  index + 1
                }
              </strong>

              <div>
                <strong>
                  {
                    action.title
                  }
                </strong>

                {action.reason ? (
                  <div
                    style={{
                      marginTop:
                        3,

                      color:
                        "#6b7280",

                      fontSize:
                        12,
                    }}
                  >
                    {
                      action.reason
                    }
                  </div>
                ) : null}
              </div>

              {onAction ? (
                <button
                  type="button"
                  onClick={() =>
                    onAction(
                      action,
                    )
                  }
                >
                  {
                    action
                      .action_label
                    ?? "Abrir"
                  }
                </button>
              ) : null}
            </article>
          ),
        )}
      </section>
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding:
          12,

        border:
          "1px solid #e5e7eb",

        borderRadius:
          9,

        background:
          "#f9fafb",
      }}
    >
      <span
        style={{
          display:
            "block",

          color:
            "#6b7280",

          fontSize:
            11,
        }}
      >
        {label}
      </span>

      <strong
        style={{
          display:
            "block",

          marginTop:
            4,

          fontSize:
            18,
        }}
      >
        {value}
      </strong>
    </div>
  );
}
