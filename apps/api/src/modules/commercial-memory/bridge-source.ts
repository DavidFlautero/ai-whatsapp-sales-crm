import { Supabase } from "./supabase.js";
import type {
  AwaitedTable,
} from "./bridge-types.js";

export type CanonicalRow = {
  id: string;
  phones: string[];
  eventDate: string | null;
};

export async function readCanonicalRows(
  db: Supabase,
  source: AwaitedTable,
  company: string,
): Promise<CanonicalRow[]> {
  const selected = [
    "id",
    ...source.phones,
    ...(source.dateColumn
      ? [source.dateColumn]
      : []),
  ];

  const result: CanonicalRow[] = [];
  const pageSize = 500;
  const maximum = 5000;

  for (let offset = 0; offset < maximum; offset += pageSize) {
    const rows = await db.get<
      Array<Record<string, unknown>>
    >(
      source.table,
      [
        ["select", selected.join(",")],
        ["company_id", `eq.${company}`],
        ["order", "id.asc"],
        ["limit", String(pageSize)],
        ["offset", String(offset)],
      ],
    );

    for (const row of rows) {
      result.push({
        id: String(row.id),
        phones: source.phones
          .map(column => row[column])
          .filter(
            (value): value is string =>
              typeof value === "string",
          ),
        eventDate:
          source.dateColumn &&
          typeof row[source.dateColumn] === "string"
            ? String(row[source.dateColumn]).slice(0, 10)
            : null,
      });
    }

    if (rows.length < pageSize) {
      return result;
    }
  }

  throw new Error(
    `CM_CANONICAL_SOURCE_LIMIT:${source.table}`,
  );
}
