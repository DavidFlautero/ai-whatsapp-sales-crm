import { Supabase } from "./supabase.js";
import type { Role } from "./types.js";

export async function rolesForIdentity(
  db: Supabase,
  company: string,
  identity: string,
): Promise<Set<Role>> {
  const rows = await db.get<
    Array<{
      role: Role;
      status: string;
      confidence: number;
    }>
  >(
    "crm_memory_roles",
    [
      ["select", "role,status,confidence"],
      ["company_id", `eq.${company}`],
      ["identity_id", `eq.${identity}`],
      ["status", "in.(proposed,confirmed)"],
    ],
  );

  return new Set(
    rows
      .filter(row =>
        row.status === "confirmed" ||
        row.confidence >= 0.78,
      )
      .map(row => row.role),
  );
}
