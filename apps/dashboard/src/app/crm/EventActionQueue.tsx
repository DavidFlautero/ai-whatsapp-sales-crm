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

export function EventActionQueue() {
  const {
    data,
  } =
    useEventOperations();

  const actions =
    useMemo(
      () => {
        const risk =
          calculateEventRisk(
            data,
          );

        return risk.signals
          .map(
            (
              signal,
              index,
            ) => ({
              id:
                `${signal.code}-${signal.requirementId ?? index}`,

              title:
                signal.label,

              priority:
                signal.impact >= 20
                  ? "P0"
                  : signal.impact >= 12
                    ? "P1"
                    : signal.impact >= 6
                      ? "P2"
                      : "P3",

              impact:
                signal.impact,

              requirementId:
                signal.requirementId,
            }),
          )
          .sort(
            (
              left,
              right,
            ) =>
              right.impact
              - left.impact,
          );
      },
      [
        data,
      ],
    );

  return (
    <section>
      <strong>
        Action Queue
      </strong>

      <div
        style={{
          display:
            "grid",
          gap:
            8,
          marginTop:
            10,
        }}
      >
        {
          actions
            .slice(
              0,
              15,
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
                    display:
                      "grid",
                    gridTemplateColumns:
                      "55px 1fr 50px",
                    gap:
                      10,
                    alignItems:
                      "center",
                  }}
                >
                  <strong>
                    {
                      action.priority
                    }
                  </strong>

                  <span>
                    {
                      action.title
                    }
                  </span>

                  <small>
                    +{
                      action.impact
                    }
                  </small>
                </article>
              ),
            )
        }

        {
          !actions.length
            ? (
              <span>
                Sin acciones prioritarias.
              </span>
            )
            : null
        }
      </div>
    </section>
  );
}
