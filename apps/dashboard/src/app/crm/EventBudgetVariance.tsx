"use client";

import { useMemo } from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventBudgetVariance() {
  const { data } =
    useEventOperations();

  const result =
    useMemo(() => {
      const target =
        Number(
          data?.event
            ?.target_budget
          ?? 0,
        );

      let clientPrice = 0;
      let providerCost = 0;

      for (
        const item
        of data?.requirements ?? []
      ) {
        clientPrice +=
          Number(
            item.client_price
            ?? 0,
          );

        providerCost +=
          Number(
            item.provider_cost
            ?? 0,
          );
      }

      return {
        target,
        clientPrice,
        providerCost,
        variance:
          target
          ? clientPrice
            - target
          : 0,
        utilization:
          target
            ? clientPrice
              / target
              * 100
            : 0,
      };
    }, [data]);

  return (
    <section>
      <strong>
        Budget Variance
      </strong>

      <div>
        Presupuesto objetivo:
        {" €"}
        {result.target.toFixed(0)}
      </div>

      <div>
        Venta configurada:
        {" €"}
        {result.clientPrice.toFixed(0)}
      </div>

      <div>
        Coste:
        {" €"}
        {result.providerCost.toFixed(0)}
      </div>

      <div>
        Desviación:
        {" €"}
        {result.variance.toFixed(0)}
      </div>

      <div>
        Utilización:
        {" "}
        {result.utilization.toFixed(1)}
        %
      </div>
    </section>
  );
}
