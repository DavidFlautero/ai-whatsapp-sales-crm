import { Supabase } from "./supabase.js";

import {
  readDossier,
} from "./dossier.repository.js";

export async function readUnifiedDossier(
  db: Supabase,
  company: string,
  caseId: string,
) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(caseId)
  ) {
    throw new Error("INVALID_CASE_ID");
  }

  const [original, links, partners, tasks] =
    await Promise.all([
      readDossier(db, company, caseId),

      db.get(
        "cm_bridge_candidates",
        [
          ["select", "*"],
          ["company_id", `eq.${company}`],
          ["case_id", `eq.${caseId}`],
        ],
      ),

      db.get(
        "cm_operation_partners",
        [
          ["select", "*"],
          ["company_id", `eq.${company}`],
          ["case_id", `eq.${caseId}`],
        ],
      ),

      db.get(
        "cm_intel_tasks",
        [
          ["select", "*"],
          ["company_id", `eq.${company}`],
          ["case_id", `eq.${caseId}`],
          ["order", "created_at.desc"],
          ["limit", "100"],
        ],
      ),
    ]);

  return {
    original,
    canonicalLinks: links,
    partners,
    tasks,
  };
}
