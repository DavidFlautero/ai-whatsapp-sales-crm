import {
  loadConfig,
} from "../../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../../src/modules/commercial-memory/supabase.js";

type Row = Record<string, unknown>;

const TABLES = [
  "messages",
  "crm_memory_receipts",
  "crm_memory_case_messages",
  "crm_memory_cases",
  "crm_memory_identities",
  "cm_intel_receipts",
  "cm_intel_tasks",
  "cm_bridge_candidates",
];

function describe(value: unknown): string {
  if (value === null) return "null";

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}

async function main() {
  const cfg = loadConfig();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  console.log(
    "===================================",
  );

  console.log(
    "COMMERCIAL_REALTIME_SCHEMA",
  );

  console.log(
    "===================================",
  );

  for (const table of TABLES) {
    try {
      const result = await db.get<Row[]>(
        table,
        [
          ["select", "*"],
          [
            "company_id",
            `eq.${cfg.companyId}`,
          ],
          ["limit", "1"],
        ],
      );

      const sample = result[0];

      if (!sample) {
        console.log({
          table,
          status: "SCOPED_EMPTY",
          note:
            "Sin filas para esta empresa",
        });

        continue;
      }

      const columns = Object.entries(
        sample,
      ).map(([name, value]) => ({
        name,
        type: describe(value),
      }));

      console.log(
        JSON.stringify({
          table,
          status: "SCOPED_OK",
          columns,
        }, null, 2),
      );
    } catch (error) {
      console.log({
        table,
        status: "SCOPED_QUERY_FAILED",
        reason:
          error instanceof Error
            ? error.message.slice(0, 250)
            : "UNKNOWN",
      });
    }
  }

  console.log(
    "CM_REALTIME_SCHEMA_INSPECTED",
  );
}

main().catch(error => {
  console.error(
    "CM_SCHEMA_FATAL",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
