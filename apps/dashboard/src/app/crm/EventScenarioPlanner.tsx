"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventScenarioPlanner() {
  const { data } =
    useEventOperations();

  const [
    costShock,
    setCostShock,
  ] =
    useState(10);

  const [
    lostProviders,
    setLostProviders,
  ] =
    useState(1);

  const result =
    useMemo(() => {
      let revenue = 0;
      let cost = 0;

      const services =
        (
          data?.requirements
          ?? []
        )
          .filter(
            item =>
              item.service_status
              !== "cancelled",
          );

      for (
        const item
        of services
      ) {
        revenue +=
          Number(
            item.client_price
            ?? 0,
          );

        cost +=
          Number(
            item.provider_cost
            ?? 0,
          );
      }

      const stressedCost =
        cost
        * (
          1
          + costShock
            / 100
        );

      const margin =
        revenue
        - stressedCost;

      const providerCoverage =
        Math.max(
          0,
          services.filter(
            item =>
              Boolean(
                item.assigned_provider_id,
              ),
          ).length
          - lostProviders,
        );

      return {
        margin,
        providerCoverage,
        total:
          services.length,
      };
    }, [
      data,
      costShock,
      lostProviders,
    ]);

  return (
    <section>
      <strong>
        Scenario Planner
      </strong>

      <div>
        Sobrecoste:
        <input
          type="range"
          min="0"
          max="50"
          value={costShock}
          onChange={(event) =>
            setCostShock(
              Number(
                event.target.value,
              ),
            )
          }
        />
        {costShock}%
      </div>

      <div>
        Proveedores perdidos:
        <input
          type="number"
          min="0"
          max="10"
          value={lostProviders}
          onChange={(event) =>
            setLostProviders(
              Number(
                event.target.value,
              ),
            )
          }
        />
      </div>

      <p>
        Margen stress:{" "}
        <strong>
          €
          {result.margin.toFixed(0)}
        </strong>
      </p>

      <p>
        Cobertura:{" "}
        {result.providerCoverage}
        /
        {result.total}
      </p>
    </section>
  );
}
