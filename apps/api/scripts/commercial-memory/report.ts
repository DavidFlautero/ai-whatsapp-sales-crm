import {
  loadConfig,
} from "../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../src/modules/commercial-memory/supabase.js";

async function count(
  db: Supabase,
  table: string,
  company: string,
  extra: Array<[string, string]> = [],
): Promise<number> {
  let total = 0;
  let offset = 0;

  while (true) {
    const rows = await db.get<
      Array<{
        id?: string;
        message_id?: string;
      }>
    >(
      table,
      [
        [
          "select",
          (
            table === "crm_memory_receipts" ||
            table === "crm_memory_case_messages"
          )
            ? "message_id"
            : "id",
        ],
        ["company_id", `eq.${company}`],
        ...extra,
        ["limit", "1000"],
        ["offset", String(offset)],
      ],
    );

    total += rows.length;
    offset += rows.length;

    if (rows.length < 1000) {
      return total;
    }
  }
}

async function main() {
  const cfg = loadConfig();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  const output = {
    company: cfg.companyId,

    identities:
      await count(
        db,
        "crm_memory_identities",
        cfg.companyId,
      ),

    proposed_roles:
      await count(
        db,
        "crm_memory_roles",
        cfg.companyId,
        [["status", "eq.proposed"]],
      ),

    cases:
      await count(
        db,
        "crm_memory_cases",
        cfg.companyId,
      ),

    linked_messages:
      await count(
        db,
        "crm_memory_case_messages",
        cfg.companyId,
      ),

    facts:
      await count(
        db,
        "crm_memory_facts",
        cfg.companyId,
      ),

    pending_reviews:
      await count(
        db,
        "crm_memory_reviews",
        cfg.companyId,
        [["status", "eq.open"]],
      ),

    processed_messages:
      await count(
        db,
        "crm_memory_receipts",
        cfg.companyId,
      ),
  };

  console.log(
    "CM_REPORT",
    JSON.stringify(output, null, 2),
  );
}

main().catch(error => {
  console.error(
    "CM_REPORT_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
