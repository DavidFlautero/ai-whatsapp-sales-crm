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

export function EventQuoteHealthPanel() {
  const {
    data,
  } =
    useEventOperations();

  const analysis =
    useMemo(
      () => {
        let cost =
          0;

        let price =
          0;

        let missingPrices =
          0;

        let missingCosts =
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

          const itemCost =
            n(
              item
                .provider_cost,
            );

          const itemPrice =
            n(
              item
                .client_price,
            );

          cost +=
            itemCost;

          price +=
            itemPrice;

          if (
            itemCost <= 0
          ) {
            missingCosts +=
              1;
          }

          if (
            itemPrice <= 0
          ) {
            missingPrices +=
              1;
          }
        }

        const margin =
          price
          - cost;

        const marginPct =
          price > 0
            ? (
                margin
                / price
              )
              * 100
            : 0;

        const health =
          missingPrices > 0
            ? "incomplete"
            : marginPct < 10
              ? "critical"
              : marginPct < 20
                ? "warning"
                : "healthy";

        return {
          cost,
          price,
          margin,
          marginPct,
          missingCosts,
          missingPrices,
          health,
        };
      },
      [
        data,
      ],
    );

  return (
    <section>
      <strong>
        Salud comercial
      </strong>

      <div
        style={{
          marginTop:
            8,
        }}
      >
        Estado:{" "}
        <strong>
          {
            analysis
              .health
              .toUpperCase()
          }
        </strong>
      </div>

      <div>
        Margen:{" "}
        {
          analysis
            .marginPct
            .toFixed(
              1,
            )
        }
        %
      </div>

      <div>
        Servicios sin coste:{" "}
        {
          analysis
            .missingCosts
        }
      </div>

      <div>
        Servicios sin precio:{" "}
        {
          analysis
            .missingPrices
        }
      </div>
    </section>
  );
}
