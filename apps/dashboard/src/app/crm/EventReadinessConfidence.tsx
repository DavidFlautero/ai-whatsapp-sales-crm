"use client";

import { useMemo } from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventReadinessConfidence() {
  const { data } =
    useEventOperations();

  const result =
    useMemo(() => {
      const readiness =
        Number(
          data?.readiness
            ?.readiness_percent
          ?? 0,
        );

      const services =
        data?.requirements
        ?? [];

      let evidence = 0;
      let possible = 0;

      for (
        const item
        of services
      ) {
        if (
          item.service_status
          === "cancelled"
        ) {
          continue;
        }

        possible += 4;

        if (
          item.service_status
        ) {
          evidence += 1;
        }

        if (
          item.assigned_provider_id
        ) {
          evidence += 1;
        }

        if (
          item.responsible_team_member_id
        ) {
          evidence += 1;
        }

        if (
          item.provider_cost
          != null
        ) {
          evidence += 1;
        }
      }

      const confidence =
        possible
          ? Math.round(
              evidence
              / possible
              * 100,
            )
          : 100;

      return {
        readiness,
        confidence,
        trustedReadiness:
          Math.round(
            readiness
            * confidence
            / 100,
          ),
      };
    }, [data]);

  return (
    <section>
      <strong>
        Readiness Confidence
      </strong>

      <div>
        Readiness:
        {" "}
        {result.readiness}%
      </div>

      <div>
        Confianza datos:
        {" "}
        {result.confidence}%
      </div>

      <div>
        Readiness ajustado:
        {" "}
        <strong>
          {result.trustedReadiness}%
        </strong>
      </div>
    </section>
  );
}
