"use client";

import { useMemo } from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

export function EventProviderConcentration() {
  const { data } =
    useEventOperations();

  const result =
    useMemo(() => {
      const map =
        new Map<
          string,
          number
        >();

      for (
        const item
        of data?.requirements ?? []
      ) {
        if (
          !item.assigned_provider_id
        ) {
          continue;
        }

        const id =
          item.assigned_provider_id;

        map.set(
          id,
          (
            map.get(id)
            ?? 0
          )
          + 1,
        );
      }

      const total =
        Array.from(
          map.values(),
        )
          .reduce(
            (a, b) =>
              a + b,
            0,
          );

      const ranking =
        Array.from(
          map.entries(),
        )
          .map(
            ([id, count]) => ({
              id,
              count,
              share:
                total
                  ? count
                    / total
                    * 100
                  : 0,
            }),
          )
          .sort(
            (a, b) =>
              b.count
              - a.count,
          );

      return {
        total,
        ranking,
      };
    }, [data]);

  return (
    <section>
      <strong>
        Provider Concentration
      </strong>

      {result.ranking
        .slice(0, 8)
        .map((item) => (
          <div key={item.id}>
            {item.id.slice(0, 8)}
            {" · "}
            {item.count}
            {" servicios · "}
            {item.share.toFixed(1)}
            %
          </div>
        ))}
    </section>
  );
}
