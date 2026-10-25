import type {
  Identity,
  Role,
} from "./types.js";

import { Supabase } from "./supabase.js";
import { confidence } from "./keys.js";

export async function findIdentity(
  db: Supabase,
  company: string,
  phone: string,
): Promise<Identity | null> {
  const rows = await db.get<Identity[]>(
    "crm_memory_identities",
    [
      [
        "select",
        "id,company_id,primary_phone,display_name,identity_status",
      ],
      ["company_id", `eq.${company}`],
      ["primary_phone", `eq.${phone}`],
      ["limit", "1"],
    ],
  );

  return rows[0] || null;
}

export async function ensureIdentity(
  db: Supabase,
  company: string,
  phone: string,
): Promise<Identity> {
  await db.insertIgnore(
    "crm_memory_identities",
    {
      company_id: company,
      primary_phone: phone,
      identity_status: "provisional",
    },
    "company_id,primary_phone",
  );

  const identity = await findIdentity(
    db,
    company,
    phone,
  );

  if (!identity) {
    throw new Error("IDENTITY_UPSERT_READ_FAILED");
  }

  return identity;
}

export async function recordProposedRole(
  db: Supabase,
  company: string,
  identityId: string,
  role: Role,
  score: number,
  messageId: string,
  direction: string,
  explanation: string,
): Promise<void> {
  await db.insertIgnore(
    "crm_memory_roles",
    {
      company_id: company,
      identity_id: identityId,
      role,
      confidence: confidence(score),
      status: "proposed",
      evidence_message_id: messageId,
      evidence_direction: direction,
      explanation: explanation.slice(0, 240),
    },
    "company_id,identity_id,role",
  );
}
