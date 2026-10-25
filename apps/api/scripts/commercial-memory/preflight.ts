import {
  loadConfig,
} from "../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../src/modules/commercial-memory/supabase.js";

async function main() {
  const cfg = loadConfig();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  const tables = [
    "messages",
    "crm_memory_identities",
    "crm_memory_roles",
    "crm_memory_entity_links",
    "crm_memory_cases",
    "crm_memory_case_messages",
    "crm_memory_facts",
    "crm_memory_reviews",
    "crm_memory_receipts",
    "crm_memory_cursors",
    "crm_memory_worker_leases",
  ];

  let ok = true;

  for (const table of tables) {
    try {
      await db.get(
        table,
        [
          ["select", "*"],
          ["limit", "0"],
        ],
      );

      console.log("OK:", table);
    } catch (error) {
      ok = false;

      console.error(
        "MISSING_OR_UNREADABLE:",
        table,
        error instanceof Error
          ? error.message
          : "UNKNOWN",
      );
    }
  }

  console.log(
    "CONFIG:",
    JSON.stringify({
      company: cfg.companyId,
      aiEnabled: cfg.aiEnabled,
      writeEnabled: cfg.writeEnabled,
    }),
  );

  if (!ok) process.exitCode = 2;
}

main().catch(error => {
  console.error(
    "CM_PREFLIGHT_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
