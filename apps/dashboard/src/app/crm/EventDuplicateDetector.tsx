"use client";

import {
  useMemo,
} from "react";

import {
  useEventOperations,
} from "./EventOperationsContext";

function normalize(
  value?:
    | string
    | null,
) {
  return (
    value
    ?? ""
  )
    .normalize(
      "NFD",
    )
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " ",
    );
}

export function EventDuplicateDetector() {
  const {
    data,
  } =
    useEventOperations();

  const duplicates =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            Array<{
              id: string;
              original: string;
            }>
          >();

        for (
          const item
          of data?.requirements
          ?? []
        ) {
          if (
            item.service_status
            === "cancelled"
          ) {
            continue;
          }

          const original =
            item.service_name
            ?? "";

          const normalized =
            normalize(
              original,
            );

          if (
            !normalized
          ) {
            continue;
          }

          const rows =
            map.get(
              normalized,
            )
            ?? [];

          rows.push({
            id:
              item.id
              ?? `${normalized}-${rows.length}`,

            original,
          });

          map.set(
            normalized,
            rows,
          );
        }

        return Array.from(
          map.entries(),
        )
          .filter(
            (
              [
                ,
                rows,
              ],
            ) =>
              rows.length
              > 1,
          )
          .map(
            (
              [
                normalized,
                rows,
              ],
            ) => ({
              normalized,
              rows,
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
        Duplicate Detector
      </strong>

      <div
        style={{
          display:
            "grid",
          gap:
            6,
          marginTop:
            8,
        }}
      >
        {
          duplicates.map(
            group => (
              <article
                key={
                  group.normalized
                }
              >
                ⚠{" "}
                <strong>
                  {
                    group.rows[0]
                      ?.original
                    ?? group.normalized
                  }
                </strong>

                {" · "}

                {
                  group.rows.length
                }
                {" registros similares"}
              </article>
            ),
          )
        }

        {
          !duplicates.length
            ? (
              <span>
                Sin duplicados evidentes.
              </span>
            )
            : null
        }
      </div>
    </section>
  );
}
