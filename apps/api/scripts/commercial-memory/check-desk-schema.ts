import {
  loadConfig,
} from "../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../src/modules/commercial-memory/supabase.js";

type Check = {
  table: string;
  columns: string;
};

const checks: Check[] = [
  {
    table: "crm_memory_cases",
    columns:
      "id,state,customer_identity_id,event_date,venue_label,created_at",
  },
  {
    table: "cm_intel_tasks",
    columns:
      "id,case_id,identity_id,source_message_id,title,task_type,priority,status,evidence,created_at",
  },
  {
    table: "cm_bridge_candidates",
    columns:
      "id,identity_id,case_id,target_table,target_id,match_basis,confidence,status,evidence",
  },
  {
    table: "crm_memory_case_messages",
    columns:
      "message_id,case_id",
  },
  {
    table: "crm_memory_identities",
    columns:
      "id,display_name",
  },
  {
    table: "messages",
    columns:
      "id,body,message_type,direction,created_at",
  },
];

async function main() {
  const cfg = loadConfig();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    try {
      const result = await db.get<
        Array<Record<string, unknown>>
      >(
        check.table,
        [
          ["select", check.columns],
          ["company_id", `eq.${cfg.companyId}`],
          ["limit", "1"],
        ],
      );

      console.log("SCHEMA_OK", {
        table: check.table,
        sampledRows: result.length,
      });

      passed++;
    } catch (error) {
      console.error("SCHEMA_FAILED", {
        table: check.table,
        columns: check.columns,
        reason:
          error instanceof Error
            ? error.message.slice(0, 300)
            : "UNKNOWN",
      });

      failed++;
    }
  }

  console.log("CM_SCHEMA_RESULT", {
    passed,
    failed,
    ready: failed === 0,
  });

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(
    "CM_SCHEMA_CHECK_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
