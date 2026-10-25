import {
  loadConfig,
} from "../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../src/modules/commercial-memory/supabase.js";

async function count(
  db: Supabase,
  company: string,
  table: string,
  column: string,
): Promise<number> {
  let total = 0;

  for (let offset = 0; offset < 100000; offset += 500) {
    const rows = await db.get<
      Array<Record<string, unknown>>
    >(
      table,
      [
        ["select", column],
        ["company_id", `eq.${company}`],
        ["limit", "500"],
        ["offset", String(offset)],
      ],
    );

    total += rows.length;

    if (rows.length < 500) return total;
  }

  throw new Error(`REPORT_LIMIT:${table}`);
}

async function main() {
  const cfg = loadConfig();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  const targets: Array<[string,string]> = [
    ["crm_memory_identities","id"],
    ["crm_memory_cases","id"],
    ["crm_memory_receipts","message_id"],
    ["cm_bridge_candidates","id"],
    ["cm_operation_partners","id"],
    ["cm_identity_role_evidence","id"],
    ["cm_intel_observations","id"],
    ["cm_intel_receipts","message_id"],
    ["cm_intel_tasks","id"],
    ["cm_intel_memories","id"],
    ["cm_intel_failures","message_id"],
  ];

  const report: Record<string, number> = {};

  for (const [table,column] of targets) {
    report[table] = await count(
      db,
      cfg.companyId,
      table,
      column,
    );
  }

  console.log(
    "CM_STAGE34_REPORT",
    JSON.stringify(report, null, 2),
  );
}

main().catch(error => {
  console.error(
    "CM_STAGE34_REPORT_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
