"use client";

import {
  useEffect,
  useState,
} from "react";

import styles from "./event-finance-snapshot.module.css";


type Finance = {
  currency: string;

  saleAmount: number;
  targetBudget: number;

  providerCost:
    number | null;

  directExpenses:
    number | null;

  totalCost:
    number | null;

  grossMargin:
    number | null;

  marginPercent:
    number | null;

  targetMarginPercent:
    number;

  warningMarginPercent:
    number;

  minimumMarginPercent:
    number;

  maximumCost:
    number | null;

  remainingCostCapacity:
    number | null;

  commissionTotal:
    number;

  commissionStatus:
    "estimated"
    | "generated";

  companyResult:
    number | null;

  recommendedSalePrice:
    number | null;

  profitability:
    | "loss"
    | "critical"
    | "warning"
    | "below_target"
    | "healthy"
    | null;

  recommendations:
    string[];

  serviceCount: number;
};


type Props = {
  eventId: string;
};


function money(
  value:
    number
    | null
    | undefined,

  currency =
    "EUR",
) {
  if (
    value === null
    || value === undefined
  ) {
    return "Restringido";
  }

  return new Intl
    .NumberFormat(
      "es-ES",
      {
        style:
          "currency",

        currency,

        minimumFractionDigits:
          2,

        maximumFractionDigits:
          2,
      },
    )
    .format(
      value,
    );
}


const PROFITABILITY_LABEL = {
  loss:
    "OPERACIÓN CON PÉRDIDA",

  critical:
    "RENTABILIDAD CRÍTICA",

  warning:
    "MARGEN AJUSTADO",

  below_target:
    "POR DEBAJO DEL OBJETIVO",

  healthy:
    "RENTABLE",
} as const;


export function EventFinanceSnapshot({
  eventId,
}: Props) {
  const [
    finance,
    setFinance,
  ] =
    useState<
      Finance | null
    >(null);

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
    >(null);


  useEffect(
    () => {
      let cancelled =
        false;

      async function load() {
        try {
          setLoading(
            true,
          );

          setError(
            null,
          );

          const response =
            await fetch(
              `/api/crm/events/${eventId}/finance`,
              {
                cache:
                  "no-store",
              },
            );

          const body =
            await response
              .json();

          if (!response.ok) {
            throw new Error(
              body?.error
              ?? "No se pudo cargar el control financiero.",
            );
          }

          if (!cancelled) {
            setFinance(
              body.finance
              ?? null,
            );
          }

        } catch (
          loadError
        ) {
          if (!cancelled) {
            setError(
              loadError
                instanceof Error
                ? loadError.message
                : "No se pudo cargar el control financiero.",
            );
          }

        } finally {
          if (!cancelled) {
            setLoading(
              false,
            );
          }
        }
      }

      void load();

      return () => {
        cancelled =
          true;
      };
    },
    [
      eventId,
    ],
  );


  if (loading) {
    return (
      <div className={styles.root}>
        Calculando rentabilidad...
      </div>
    );
  }


  if (
    error
    || !finance
  ) {
    return (
      <div className={styles.root}>
        {
          error
          ?? "Sin información financiera."
        }
      </div>
    );
  }


  const currency =
    finance.currency
    || "EUR";

  const statusLabel =
    finance.profitability
      ? PROFITABILITY_LABEL[
          finance
            .profitability
        ]
      : "CONTROL FINANCIERO";


  return (
    <div className={styles.root}>

      <div
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "flex-start",

          gap:
            16,

          flexWrap:
            "wrap",

          marginBottom:
            18,
        }}
      >
        <div>
          <span
            style={{
              fontSize:
                11,

              fontWeight:
                800,

              letterSpacing:
                ".08em",
            }}
          >
            CONTROL DE RENTABILIDAD
          </span>

          <h3
            style={{
              margin:
                "5px 0 0",
            }}
          >
            {
              statusLabel
            }
          </h3>
        </div>

        <div
          style={{
            textAlign:
              "right",
          }}
        >
          <small>
            Margen objetivo
          </small>

          <strong
            style={{
              display:
                "block",

              fontSize:
                22,
            }}
          >
            {
              finance
                .targetMarginPercent
            }
            %
          </strong>
        </div>
      </div>


      <div className={styles.main}>

        <Metric
          label="Venta objetivo"
          value={
            money(
              finance
                .saleAmount,
              currency,
            )
          }
        />

        <Metric
          label="Coste proveedores"
          value={
            money(
              finance
                .providerCost,
              currency,
            )
          }
        />

        <Metric
          label="Gastos directos"
          value={
            money(
              finance
                .directExpenses,
              currency,
            )
          }
        />

        <Metric
          label="Coste total"
          value={
            money(
              finance
                .totalCost,
              currency,
            )
          }
        />

        <Metric
          label="Máximo recomendable de costes"
          value={
            money(
              finance
                .maximumCost,
              currency,
            )
          }
        />

        <Metric
          label="Disponible para nuevos costes"
          value={
            money(
              finance
                .remainingCostCapacity,
              currency,
            )
          }
        />

        <Metric
          label="Margen bruto"
          value={
            money(
              finance
                .grossMargin,
              currency,
            )
          }
          secondary={
            finance.marginPercent
            !== null
              ? `${finance.marginPercent.toFixed(
                  1,
                )}% sobre venta`
              : undefined
          }
        />

        <Metric
          label={
            finance
              .commissionStatus
            === "generated"
              ? "Comisiones"
              : "Comisión estimada"
          }
          value={
            money(
              finance
                .commissionTotal,
              currency,
            )
          }
        />

        <Metric
          label="Resultado empresa"
          value={
            money(
              finance
                .companyResult,
              currency,
            )
          }
        />

      </div>


      {
        finance
          .recommendedSalePrice
        !== null
        && finance
          .recommendedSalePrice
        > finance.saleAmount
          ? (
            <div
              style={{
                marginTop:
                  16,

                padding:
                  16,

                border:
                  "1px solid #f59e0b",

                borderRadius:
                  12,
              }}
            >
              <small>
                PRECIO RECOMENDADO
              </small>

              <strong
                style={{
                  display:
                    "block",

                  marginTop:
                    4,

                  fontSize:
                    24,
                }}
              >
                {
                  money(
                    finance
                      .recommendedSalePrice,
                    currency,
                  )
                }
              </strong>

              <div
                style={{
                  marginTop:
                    5,

                  fontSize:
                    13,
                }}
              >
                Precio mínimo aproximado
                para conservar un margen
                del{" "}
                {
                  finance
                    .targetMarginPercent
                }
                %.
              </div>
            </div>
          )
          : null
      }


      {
        finance
          .recommendations
          .length
          ? (
            <div
              style={{
                display:
                  "grid",

                gap:
                  7,

                marginTop:
                  16,
              }}
            >
              {
                finance
                  .recommendations
                  .map(
                    (
                      recommendation,
                      index,
                    ) => (
                      <div
                        key={
                          `${index}-${recommendation}`
                        }
                        style={{
                          padding:
                            "10px 12px",

                          border:
                            "1px solid #e5e7eb",

                          borderRadius:
                            9,

                          fontSize:
                            13,
                        }}
                      >
                        {
                          recommendation
                        }
                      </div>
                    ),
                  )
              }
            </div>
          )
          : null
      }

    </div>
  );
}


function Metric({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div>
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      {
        secondary
          ? (
            <small>
              {
                secondary
              }
            </small>
          )
          : null
      }
    </div>
  );
}
