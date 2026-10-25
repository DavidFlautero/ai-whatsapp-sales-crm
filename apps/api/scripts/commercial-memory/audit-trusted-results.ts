import {
  loadConfig,
} from "../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../src/modules/commercial-memory/supabase.js";

import {
  splitTrustedObservations,
  splitTrustedTasks,
  type EvidenceObservation,
  type EvidenceTask,
} from "../../src/modules/commercial-memory/trusted-results.js";

async function readAll<T>(
  db: Supabase,
  company: string,
  table: string,
  columns: string,
): Promise<T[]> {
  const result: T[] = [];

  for (
    let offset = 0;
    offset < 100000;
    offset += 500
  ) {
    const rows = await db.get<T[]>(
      table,
      [
        ["select", columns],
        ["company_id", `eq.${company}`],
        ["order", "id.asc"],
        ["limit", "500"],
        ["offset", String(offset)],
      ],
    );

    result.push(...rows);

    if (rows.length < 500) {
      return result;
    }
  }

  throw new Error(
    `CM_TRUST_AUDIT_LIMIT:${table}`,
  );
}

function reasons(
  rows: Array<{
    id: string;
    reason: string;
  }>,
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const item of rows) {
    result[item.reason] =
      (result[item.reason] || 0) + 1;
  }

  return result;
}

async function main() {
  const cfg = loadConfig();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  const [
    observations,
    tasks,
  ] = await Promise.all([
    readAll<EvidenceObservation>(
      db,
      cfg.companyId,
      "cm_intel_observations",
      "id,message_id,evidence_quote,observation",
    ),

    readAll<EvidenceTask>(
      db,
      cfg.companyId,
      "cm_intel_tasks",
      "id,source_message_id,evidence",
    ),
  ]);

  const [
    observationQuality,
    taskQuality,
  ] = await Promise.all([
    splitTrustedObservations(
      db,
      cfg.companyId,
      observations,
    ),

    splitTrustedTasks(
      db,
      cfg.companyId,
      tasks,
    ),
  ]);

  console.log(
    "CM_TRUST_AUDIT",
    JSON.stringify({
      company: cfg.companyId,

      observations: {
        total: observations.length,
        trusted:
          observationQuality.trusted.length,
        quarantined:
          observationQuality.quarantined.length,
        reasons: reasons(
          observationQuality.quarantined,
        ),
      },

      tasks: {
        total: tasks.length,
        availableForHumanReview:
          taskQuality.trusted.length,
        quarantined:
          taskQuality.quarantined.length,
        reasons: reasons(
          taskQuality.quarantined,
        ),
      },

      safeguards: {
        recordsDeleted: 0,
        messagesSent: 0,
        bookingsConfirmed: 0,
        paymentsVerified: 0,
      },
    }, null, 2),
  );
}

main().catch(error => {
  console.error(
    "CM_TRUST_AUDIT_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
