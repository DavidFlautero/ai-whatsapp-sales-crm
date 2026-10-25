"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

import {
  buildNextActions,
} from "./event-next-action-engine";

export function EventNextActionPanel() {
  const {
    data,
  } =
    useEventOperations();

  const actions =
    useMemo(
      () =>
        buildNextActions(
          data,
        ),
      [
        data,
      ],
    );

  const first =
    actions[0];

  return (
    <section>
      <small>
        NEXT BEST ACTION
      </small>

      {first ? (
        <>
          <h3>
            {
              first.title
            }
          </h3>

          <p>
            {
              first.reason
            }
          </p>

          <strong>
            {
              first.priority
            }
            {" · score "}
            {
              Math.round(
                first.score,
              )
            }
          </strong>
        </>
      ) : (
        <p>
          No hay acciones prioritarias detectadas.
        </p>
      )}

      <div
        style={{
          marginTop:
            12,
        }}
      >
        {
          actions
            .slice(
              1,
              6,
            )
            .map(
              item => (
                <div
                  key={
                    item.id
                  }
                >
                  {
                    item.priority
                  }
                  {" · "}
                  {
                    item.title
                  }
                </div>
              ),
            )
        }
      </div>
    </section>
  );
}
