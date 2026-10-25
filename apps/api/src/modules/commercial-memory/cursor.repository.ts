import { Supabase } from "./supabase.js";

export type Cursor = {
  time: string;
  id: string;
};

export async function loadCursor(
  db: Supabase,
  company: string,
  startAt: string,
): Promise<Cursor> {
  const rows = await db.get<
    Array<{
      last_created_at: string;
      last_message_id: string;
    }>
  >(
    "crm_memory_cursors",
    [
      [
        "select",
        "last_created_at,last_message_id",
      ],
      ["company_id", `eq.${company}`],
      ["limit", "1"],
    ],
  );

  return rows[0]
    ? {
        time: rows[0].last_created_at,
        id: rows[0].last_message_id,
      }
    : {
        time: startAt,
        id: "00000000-0000-0000-0000-000000000000",
      };
}

export async function saveCursor(
  db: Supabase,
  company: string,
  cursor: Cursor,
): Promise<void> {
  await db.upsert(
    "crm_memory_cursors",
    {
      company_id: company,
      last_created_at: cursor.time,
      last_message_id: cursor.id,
      updated_at: new Date().toISOString(),
    },
    "company_id",
  );
}
