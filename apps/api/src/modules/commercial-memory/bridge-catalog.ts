import { Supabase } from "./supabase.js";

export type CanonicalTable = {
  table_name: string;
  columns: string[];
};

const PHONES = [
  "whatsapp",
  "contact_phone",
  "phone",
  "telefono",
  "telephone",
  "mobile",
  "phone_number",
  "owner_whatsapp",
] as const;

export async function readCanonicalCatalog(
  db: Supabase,
): Promise<Array<{
  table: string;
  phones: string[];
  dateColumn: string | null;
}>> {
  const tables = await db.rpc<CanonicalTable[]>(
    "cm_bridge_catalog",
    {},
  );

  return tables
    .filter(table =>
      table.columns.includes("id") &&
      table.columns.includes("company_id"),
    )
    .map(table => ({
      table: table.table_name,
      phones: PHONES.filter(column =>
        table.columns.includes(column),
      ),
      dateColumn:
        [
          "event_date",
          "fecha_evento",
          "requested_date",
          "date",
        ].find(column =>
          table.columns.includes(column),
        ) || null,
    }))
    .filter(table => table.phones.length > 0);
}
