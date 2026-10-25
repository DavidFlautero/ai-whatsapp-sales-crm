"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventContractGapPanel() {
  const {
    data,
  } =
    useEventOperations();

  const gaps =
    useMemo(
      () =>
        (
          data?.requirements
          ?? []
        )
          .filter(
            item =>
              item.service_status
              !== "cancelled",
          )
          .filter(
            item =>
              Boolean(
                item
                  .assigned_provider_id,
              )
              && ![
                "signed",
                "not_required",
              ].includes(
                item
                  .contract_status
                ?? "",
              ),
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

              status:
                item.contract_status
                ?? "pending",

              critical:
                Boolean(
                  item.is_critical,
                ),
            }),
          )
          .sort(
            (
              left,
              right,
            ) =>
              Number(
                right.critical,
              )
              - Number(
                  left.critical,
                ),
          ),
      [
        data,
      ],
    );

  return (
    <section>
      <strong>
        Contract Gap
      </strong>

      <div
        style={{
          marginTop:
            8,
        }}
      >
        {
          gaps.length
        }
        {" contratos por cerrar"}
      </div>

      {
        gaps
          .slice(
            0,
            10,
          )
          .map(
            item => (
              <div
                key={
                  item.id
                }
              >
                {
                  item.critical
                    ? "⚠ "
                    : ""
                }
                {
                  item.name
                }
                {" · "}
                {
                  item.status
                }
              </div>
            ),
          )
      }
    </section>
  );
}
