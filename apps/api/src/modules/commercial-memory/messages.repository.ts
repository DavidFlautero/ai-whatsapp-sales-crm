import type { Message } from "./types.js";
import { Supabase } from "./supabase.js";

export type MessageCursor = {
  time: string;
  id: string;
};

export async function fetchMessages(
  db: Supabase,
  company: string,
  cursor: MessageCursor,
  endAt?: string,
  limit = 150,
): Promise<Message[]> {
  const filter = [
    `created_at.gt.${cursor.time}`,
    `and(created_at.eq.${cursor.time},id.gt.${cursor.id})`,
  ].join(",");

  const params: Array<[string, string]> = [
    [
      "select",
      "id,company_id,contact_phone,body,direction,message_type,occurred_at,created_at,external_message_id",
    ],
    ["company_id", `eq.${company}`],
    ["or", `(${filter})`],
    ["order", "created_at.asc,id.asc"],
    ["limit", String(limit)],
  ];

  if (endAt) {
    params.push(["created_at", `lte.${endAt}`]);
  }

  return db.get<Message[]>(
    "messages",
    params,
  );
}

export async function recentContext(
  db: Supabase,
  company: string,
  phone: string,
  until: string,
  limit = 12,
): Promise<Message[]> {
  const messages = await db.get<Message[]>(
    "messages",
    [
      [
        "select",
        "id,company_id,contact_phone,body,direction,message_type,occurred_at,created_at",
      ],
      ["company_id", `eq.${company}`],
      ["contact_phone", `eq.${phone}`],
      ["created_at", `lte.${until}`],
      ["order", "created_at.desc,id.desc"],
      ["limit", String(limit)],
    ],
  );

  return messages.reverse();
}
