"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type Requirement = {
  id?: string;
  service_name?: string | null;
  service_status?: string | null;
  is_critical?: boolean | null;

  assigned_provider_id?: string | null;
  responsible_team_member_id?: string | null;

  provider_cost?: number | string | null;
  client_price?: number | string | null;

  deposit_required?: number | string | null;
  deposit_paid?: number | string | null;

  contract_status?: string | null;
};

type Summary = {
  requirements?: Requirement[];

  readiness?: {
    readiness_percent?:
      | number
      | string
      | null;

    critical_pending?:
      | number
      | string
      | null;

    without_provider?:
      | number
      | string
      | null;

    payments_pending?:
      | number
      | string
      | null;
  } | null;
};

type Action = {
  id: string;

  priority:
    | "critical"
    | "high"
    | "medium";

  title: string;
  description: string;
};

function number(
  value:
    | number
    | string
    | null
    | undefined,
) {
  const parsed =
    Number(value ?? 0);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}

function money(
  value: number,
) {
  return new Intl.NumberFormat(
    "es-ES",
    {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    },
  ).format(value);
}

export function EventOperations360Panel({
  eventId,
}: {
  eventId: string;
}) {
  const [
    data,
    setData,
  ] =
    useState<
      Summary
      | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  useEffect(
    () => {
      let active =
        true;

      async function load() {
        try {
          const response =
            await fetch(
              `/api/crm/events/${eventId}/360`,
              {
                credentials:
                  "include",

                cache:
                  "no-store",
              },
            );

          if (
            !response.ok
          ) {
            return;
          }

          const body =
            await response.json();

          if (
            active
          ) {
            setData(body);
          }
        } finally {
          if (
            active
          ) {
            setLoading(false);
          }
        }
      }

      void load();

      function refresh() {
        void load();
      }

      window.addEventListener(
        "event-service-updated",
        refresh,
      );

      return () => {
        active =
          false;

        window.removeEventListener(
          "event-service-updated",
          refresh,
        );
      };
    },
    [
      eventId,
    ],
  );

  const derived =
    useMemo(
      () => {
        const requirements =
          (
            data?.requirements
            ?? []
          )
            .filter(
              item =>
                item.service_status
                !== "cancelled",
            );

        let providerCost =
          0;

        let clientPrice =
          0;

        let depositRequired =
          0;

        let depositPaid =
          0;

        let confirmed =
          0;

        let withoutProvider =
          0;

        let withoutResponsible =
          0;

        let criticalOpen =
          0;

        let contractsPending =
          0;

        const actions:
          Action[] =
            [];

        for (
          const requirement
          of requirements
        ) {
          const name =
            requirement.service_name
            ?? "Servicio";

          const id =
            requirement.id
            ?? name;

          const closed =
            [
              "confirmed",
              "completed",
            ].includes(
              requirement
                .service_status
              ?? "",
            );

          if (
            closed
          ) {
            confirmed += 1;
          }

          if (
            !requirement
              .assigned_provider_id
          ) {
            withoutProvider += 1;

            actions.push({
              id:
                `provider-${id}`,

              priority:
                requirement
                  .is_critical
                  ? "critical"
                  : "high",

              title:
                `${name}: sin proveedor`,

              description:
                "Buscar y asignar proveedor.",
            });
          }

          if (
            !requirement
              .responsible_team_member_id
          ) {
            withoutResponsible +=
              1;

            actions.push({
              id:
                `responsible-${id}`,

              priority:
                requirement
                  .is_critical
                  ? "high"
                  : "medium",

              title:
                `${name}: sin responsable`,

              description:
                "Asignar responsable interno.",
            });
          }

          if (
            requirement
              .is_critical
            && !closed
          ) {
            criticalOpen += 1;
          }

          if (
            requirement
              .contract_status
            === "pending"
          ) {
            contractsPending +=
              1;

            actions.push({
              id:
                `contract-${id}`,

              priority:
                "high",

              title:
                `${name}: contrato pendiente`,

              description:
                "Cerrar documentación contractual.",
            });
          }

          const required =
            number(
              requirement
                .deposit_required,
            );

          const paid =
            number(
              requirement
                .deposit_paid,
            );

          if (
            required > paid
          ) {
            actions.push({
              id:
                `payment-${id}`,

              priority:
                "medium",

              title:
                `${name}: anticipo pendiente`,

              description:
                `${money(
                  required - paid,
                )} pendientes.`,
            });
          }

          providerCost +=
            number(
              requirement
                .provider_cost,
            );

          clientPrice +=
            number(
              requirement
                .client_price,
            );

          depositRequired +=
            required;

          depositPaid +=
            paid;
        }

        const weight = {
          critical:
            3,
          high:
            2,
          medium:
            1,
        };

        actions.sort(
          (
            left,
            right,
          ) =>
            weight[
              right.priority
            ]
            - weight[
              left.priority
            ],
        );

        return {
          services:
            requirements.length,

          confirmed,

          withoutProvider,

          withoutResponsible,

          criticalOpen,

          contractsPending,

          providerCost,

          clientPrice,

          margin:
            clientPrice
            - providerCost,

          pendingDeposits:
            Math.max(
              0,
              depositRequired
              - depositPaid,
            ),

          actions,
        };
      },
      [
        data,
      ],
    );

  if (
    loading
    && !data
  ) {
    return (
      <div>
        Cargando control operativo…
      </div>
    );
  }

  if (
    !data
  ) {
    return (
      <div>
        No se pudo cargar el control operativo.
      </div>
    );
  }

  return (
    <section
      style={{
        display:
          "grid",
        gap:
          16,
      }}
    >
      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(auto-fit,minmax(145px,1fr))",

          gap:
            10,
        }}
      >
        <Metric
          label="Preparación"
          value={`${number(
            data.readiness
              ?.readiness_percent,
          )}%`}
        />

        <Metric
          label="Servicios"
          value={`${derived.confirmed}/${derived.services}`}
        />

        <Metric
          label="Críticos abiertos"
          value={String(
            derived
              .criticalOpen,
          )}
        />

        <Metric
          label="Sin proveedor"
          value={String(
            derived
              .withoutProvider,
          )}
        />

        <Metric
          label="Sin responsable"
          value={String(
            derived
              .withoutResponsible,
          )}
        />

        <Metric
          label="Margen previsto"
          value={money(
            derived.margin,
          )}
        />

        <Metric
          label="Anticipos pendientes"
          value={money(
            derived
              .pendingDeposits,
          )}
        />

        <Metric
          label="Contratos pendientes"
          value={String(
            derived
              .contractsPending,
          )}
        />
      </div>

      <div>
        <strong>
          Acciones prioritarias
        </strong>

        <div
          style={{
            display:
              "grid",
            gap:
              8,
            marginTop:
              8,
          }}
        >
          {
            derived.actions
              .slice(
                0,
                12,
              )
              .map(
                action => (
                  <article
                    key={
                      action.id
                    }
                    data-priority={
                      action.priority
                    }
                    style={{
                      border:
                        "1px solid rgba(120,120,120,.18)",

                      borderRadius:
                        10,

                      padding:
                        10,
                    }}
                  >
                    <strong>
                      {
                        action.title
                      }
                    </strong>

                    <div>
                      {
                        action.description
                      }
                    </div>
                  </article>
                ),
              )
          }

          {
            !derived.actions
              .length
              ? (
                <div>
                  Sin acciones operativas pendientes.
                </div>
              )
              : null
          }
        </div>
      </div>
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
    <article
      style={{
        border:
          "1px solid rgba(120,120,120,.15)",

        borderRadius:
          10,

        padding:
          12,
      }}
    >
      <small>
        {label}
      </small>

      <strong
        style={{
          display:
            "block",

          fontSize:
            19,

          marginTop:
            4,
        }}
      >
        {value}
      </strong>
    </article>
  );
}
