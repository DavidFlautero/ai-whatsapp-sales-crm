"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

import {
  calculateEventRisk,
} from "./event-risk-engine";

export function EventRiskCommandPanel() {
  const {
    data,
  } =
    useEventOperations();

  const risk =
    useMemo(
      () =>
        calculateEventRisk(
          data,
        ),
      [
        data,
      ],
    );

  return (
    <section>
      <div
        style={{
          display:
            "grid",
          gridTemplateColumns:
            "160px 1fr",
          gap:
            16,
          alignItems:
            "center",
        }}
      >
        <div>
          <small>
            RIESGO OPERATIVO
          </small>

          <strong
            style={{
              display:
                "block",
              fontSize:
                42,
              lineHeight:
                1,
            }}
          >
            {risk.score}
          </strong>

          <span>
            {risk.level.toUpperCase()}
          </span>
        </div>

        <div>
          <div>
            Presión ruta crítica:{" "}
            <strong>
              {
                risk
                  .criticalPathPressure
              }
              %
            </strong>
          </div>

          <div>
            Días al evento:{" "}
            <strong>
              {
                risk
                  .daysUntilEvent
                ?? "—"
              }
            </strong>
          </div>

          <div>
            Exposición financiera:{" "}
            <strong>
              €
              {
                risk
                  .financialExposure
                  .toFixed(0)
              }
            </strong>
          </div>
        </div>
      </div>

      <div
        style={{
          display:
            "grid",
          gap:
            7,
          marginTop:
            14,
        }}
      >
        {
          risk.signals
            .slice(
              0,
              10,
            )
            .map(
              signal => (
                <article
                  key={`${signal.code}-${signal.requirementId ?? signal.label}`}
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    gap:
                      10,
                  }}
                >
                  <span>
                    {signal.label}
                  </span>

                  <strong>
                    +{signal.impact}
                  </strong>
                </article>
              ),
            )
        }

        {
          !risk.signals
            .length
            ? (
              <span>
                Sin señales relevantes de riesgo.
              </span>
            )
            : null
        }
      </div>
    </section>
  );
}
