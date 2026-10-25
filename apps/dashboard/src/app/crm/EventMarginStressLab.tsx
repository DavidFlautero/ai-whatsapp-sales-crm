"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

function n(
  value: unknown,
) {
  const parsed =
    Number(
      value
      ?? 0,
    );

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
      style:
        "currency",
      currency:
        "EUR",
      maximumFractionDigits:
        0,
    },
  ).format(value);
}

export function EventMarginStressLab() {
  const {
    data,
  } =
    useEventOperations();

  const simulation =
    useMemo(
      () => {
        let revenue =
          0;

        let cost =
          0;

        for (
          const item
          of data
            ?.requirements
          ?? []
        ) {
          if (
            item.service_status
            === "cancelled"
          ) {
            continue;
          }

          revenue +=
            n(
              item.client_price,
            );

          cost +=
            n(
              item.provider_cost,
            );
        }

        const scenarios = [
          {
            label:
              "Base",
            multiplier:
              1,
          },
          {
            label:
              "+5% costes",
            multiplier:
              1.05,
          },
          {
            label:
              "+10% costes",
            multiplier:
              1.10,
          },
          {
            label:
              "+20% costes",
            multiplier:
              1.20,
          },
          {
            label:
              "Stress +35%",
            multiplier:
              1.35,
          },
        ];

        return scenarios.map(
          scenario => {
            const stressedCost =
              cost
              * scenario
                .multiplier;

            const margin =
              revenue
              - stressedCost;

            const marginPct =
              revenue > 0
                ? (
                    margin
                    / revenue
                  )
                  * 100
                : 0;

            return {
              ...scenario,
              stressedCost,
              margin,
              marginPct,
            };
          },
        );
      },
      [
        data,
      ],
    );

  return (
    <section>
      <strong>
        Margin Stress Lab
      </strong>

      <div
        style={{
          display:
            "grid",
          gap:
            7,
          marginTop:
            10,
        }}
      >
        {
          simulation.map(
            item => (
              <article
                key={
                  item.label
                }
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "140px 1fr 1fr",
                  gap:
                    12,
                }}
              >
                <strong>
                  {
                    item.label
                  }
                </strong>

                <span>
                  Margen{" "}
                  {
                    money(
                      item.margin,
                    )
                  }
                </span>

                <span>
                  {
                    item.marginPct
                      .toFixed(
                        1,
                      )
                  }
                  %
                </span>
              </article>
            ),
          )
        }
      </div>
    </section>
  );
}
