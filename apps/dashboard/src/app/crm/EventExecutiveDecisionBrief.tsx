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

export function EventExecutiveDecisionBrief() {
  const {
    data,
    lastUpdatedAt,
    stale,
    refresh,
    refreshing,
  } =
    useEventOperations();

  const brief =
    useMemo(
      () => {
        const risk =
          calculateEventRisk(
            data,
          );

        const top =
          risk.signals
            .slice(
              0,
              3,
            )
            .map(
              item =>
                item.label,
            );

        const nextAction =
          top[0]
          ?? "No hay bloqueos críticos detectados.";

        return {
          risk,
          top,
          nextAction,
        };
      },
      [
        data,
      ],
    );

  return (
    <section>
      <header
        style={{
          display:
            "flex",
          justifyContent:
            "space-between",
          gap:
            12,
          alignItems:
            "center",
        }}
      >
        <div>
          <small>
            DECISION BRIEF
          </small>

          <h3
            style={{
              margin:
                "3px 0",
            }}
          >
            Qué necesita decisión ahora
          </h3>
        </div>

        <button
          type="button"
          disabled={
            refreshing
          }
          onClick={() => {
            void refresh();
          }}
        >
          {
            refreshing
              ? "Actualizando…"
              : "Actualizar"
          }
        </button>
      </header>

      <p>
        Riesgo global:{" "}
        <strong>
          {
            brief.risk
              .score
          }
          /100
          {" · "}
          {
            brief.risk
              .level
              .toUpperCase()
          }
        </strong>
      </p>

      <p>
        Próxima acción:{" "}
        <strong>
          {
            brief
              .nextAction
          }
        </strong>
      </p>

      <div>
        {
          brief.top.map(
            (
              item,
              index,
            ) => (
              <div
                key={
                  item
                }
              >
                {index + 1}.{" "}
                {item}
              </div>
            ),
          )
        }
      </div>

      <small>
        {
          stale
            ? "Datos potencialmente desactualizados"
            : lastUpdatedAt
              ? `Actualizado ${new Date(lastUpdatedAt).toLocaleTimeString("es-ES")}`
              : "Sin sincronización"
        }
      </small>
    </section>
  );
}
