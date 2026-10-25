"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventCostAnomalyDetector() {
  const {
    data,
  } =
    useEventOperations();

  const anomalies =
    useMemo(
      () => {
        const rows =
          (
            data?.requirements
            ?? []
          )
            .filter(
              item =>
                Number(
                  item.provider_cost
                  ?? 0,
                )
                > 0,
            )
            .map(
              item => ({
                id:
                  item.id
                  ?? item.service_name
                  ?? "service",

                name:
                  item.service_name
                  ?? "Servicio",

                cost:
                  Number(
                    item.provider_cost
                    ?? 0,
                  ),
              }),
            );

        if (
          rows.length
          < 3
        ) {
          return [];
        }

        const mean =
          rows.reduce(
            (
              sum,
              row,
            ) =>
              sum
              + row.cost,
            0,
          )
          / rows.length;

        const variance =
          rows.reduce(
            (
              sum,
              row,
            ) =>
              sum
              + (
                row.cost
                - mean
              ) ** 2,
            0,
          )
          / rows.length;

        const deviation =
          Math.sqrt(
            variance,
          );

        return rows
          .filter(
            row =>
              deviation > 0
              && Math.abs(
                  row.cost
                  - mean,
                )
                > deviation
                * 1.5,
          )
          .map(
            row => ({
              ...row,
              deviation:
                (
                  row.cost
                  - mean
                )
                / deviation,
            }),
          );
      },
      [
        data,
      ],
    );

  return (
    <section>
      <strong>
        Cost Anomaly Detector
      </strong>

      {
        anomalies.map(
          item => (
            <div
              key={
                item.id
              }
            >
              ⚠{" "}
              {
                item.name
              }
              {" · €"}
              {
                item.cost
                  .toFixed(
                    0,
                  )
              }
              {" · z "}
              {
                item.deviation
                  .toFixed(
                    1,
                  )
              }
            </div>
          ),
        )
      }

      {
        !anomalies.length
          ? (
            <span>
              Sin anomalías estadísticas relevantes.
            </span>
          )
          : null
      }
    </section>
  );
}
