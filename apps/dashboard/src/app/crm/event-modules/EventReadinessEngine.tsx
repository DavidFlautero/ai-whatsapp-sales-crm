"use client";

export type ReadinessRequirement = {
  id: string;

  name: string;

  status?: string | null;

  critical?: boolean | null;
  required?: boolean | null;
};

type Props = {
  requirements:
    ReadinessRequirement[];

  clientConfirmed?: boolean;
  dateConfirmed?: boolean;
  venueConfirmed?: boolean;

  quoteAccepted?: boolean;

  paymentsOk?: boolean;

  contractsOk?: boolean;
};

export function EventReadinessEngine({
  requirements,
  clientConfirmed = false,
  dateConfirmed = false,
  venueConfirmed = false,
  quoteAccepted = false,
  paymentsOk = false,
  contractsOk = false,
}: Props) {
  const requirementChecks =
    requirements.map(
      (
        requirement,
      ) => ({
        id:
          requirement.id,

        label:
          requirement.name,

        critical:
          Boolean(
            requirement
              .critical,
          ),

        complete:
          [
            "reserved",
            "confirmed",
          ].includes(
            requirement.status
            ?? "",
          ),
      }),
    );

  const checks = [
    {
      id:
        "client",

      label:
        "Cliente confirmado",

      complete:
        clientConfirmed,

      critical:
        true,
    },
    {
      id:
        "date",

      label:
        "Fecha confirmada",

      complete:
        dateConfirmed,

      critical:
        true,
    },
    {
      id:
        "venue",

      label:
        "Lugar confirmado",

      complete:
        venueConfirmed,

      critical:
        true,
    },
    ...requirementChecks,
    {
      id:
        "quote",

      label:
        "Presupuesto aceptado",

      complete:
        quoteAccepted,

      critical:
        true,
    },
    {
      id:
        "payments",

      label:
        "Pagos al día",

      complete:
        paymentsOk,

      critical:
        false,
    },
    {
      id:
        "contracts",

      label:
        "Contratos completos",

      complete:
        contractsOk,

      critical:
        false,
    },
  ];

  const complete =
    checks.filter(
      (
        item,
      ) =>
        item.complete,
    ).length;

  const percentage =
    checks.length
      ? Math.round(
          (
            complete
            / checks.length
          )
          * 100,
        )
      : 0;

  const criticalPending =
    checks.filter(
      (
        item,
      ) =>
        item.critical
        && !item.complete,
    );

  const ready =
    criticalPending.length
    === 0;

  return (
    <section
      style={{
        display:
          "grid",

        gap:
          16,

        padding:
          18,

        border:
          ready
            ? "1px solid #86efac"
            : "1px solid #fca5a5",

        borderRadius:
          12,

        background:
          ready
            ? "#f0fdf4"
            : "#fff",
      }}
    >
      <header
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "center",

          gap:
            20,
        }}
      >
        <div>
          <div
            style={{
              color:
                "#6b7280",

              fontSize:
                11,

              fontWeight:
                700,
            }}
          >
            PREPARACIÓN DEL EVENTO
          </div>

          <strong
            style={{
              display:
                "block",

              marginTop:
                4,

              fontSize:
                20,
            }}
          >
            {
              ready
                ? "LISTO"
                : "NO LISTO"
            }
          </strong>
        </div>

        <strong
          style={{
            fontSize:
              30,
          }}
        >
          {
            percentage
          }
          %
        </strong>
      </header>

      <div
        style={{
          height:
            10,

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
            width:
              `${percentage}%`,

            height:
              "100%",

            background:
              ready
                ? "#166534"
                : "#111827",
          }}
        />
      </div>

      <div
        style={{
          display:
            "grid",

          gap:
            7,
        }}
      >
        {checks.map(
          (
            check,
          ) => (
            <div
              key={
                check.id
              }
              style={{
                display:
                  "flex",

                justifyContent:
                  "space-between",

                gap:
                  10,

                fontSize:
                  13,
              }}
            >
              <span>
                {
                  check.complete
                    ? "✓"
                    : "○"
                }
                {" "}
                {
                  check.label
                }

                {
                  check.critical
                    ? " *"
                    : ""
                }
              </span>

              <strong>
                {
                  check.complete
                    ? "OK"
                    : "Pendiente"
                }
              </strong>
            </div>
          ),
        )}
      </div>

      {criticalPending.length ? (
        <div
          style={{
            padding:
              12,

            borderRadius:
              9,

            background:
              "#fef2f2",

            color:
              "#991b1b",
          }}
        >
          <strong>
            Bloqueos críticos
          </strong>

          {criticalPending.map(
            (
              item,
            ) => (
              <div
                key={
                  item.id
                }
                style={{
                  marginTop:
                    4,

                  fontSize:
                    12,
                }}
              >
                • {
                  item.label
                }
              </div>
            ),
          )}
        </div>
      ) : null}
    </section>
  );
}
