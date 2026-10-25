import type {
  Message,
  Identity,
  Role,
} from "./types.js";

import { normalizePhone } from "./phone.js";
import { Supabase } from "./supabase.js";

import {
  ensureIdentity,
  recordProposedRole,
} from "./identity.repository.js";

import {
  detectRole,
} from "./role-classifier.js";

export async function identifyPeer(
  db: Supabase,
  message: Message,
): Promise<Identity | null> {
  const phone = normalizePhone(
    message.contact_phone,
  );

  if (!phone) return null;

  return ensureIdentity(
    db,
    message.company_id,
    phone,
  );
}

export async function proposeRole(
  db: Supabase,
  message: Message,
  identity: Identity,
  role?: Role,
  score?: number,
): Promise<void> {
  const result = role
    ? {
        role,
        score: score ?? 0.7,
        why: "ai_and_conversation",
      }
    : detectRole(message);

  if (!result || result.score < 0.72) {
    return;
  }

  await recordProposedRole(
    db,
    message.company_id,
    identity.id,
    result.role,
    result.score,
    message.id,
    message.direction,
    result.why,
  );
}
