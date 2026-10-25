import {
  loadConfig,
} from "../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../src/modules/commercial-memory/supabase.js";

import {
  calculateMemoryCoverage,
} from "../../src/modules/commercial-memory/coverage.service.js";

async function main() {
  const cfg = loadConfig();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  console.log(
    "======================================",
  );

  console.log(
    "EVENTOS MEDITERRANEO - AUDITORIA GLOBAL",
  );

  console.log(
    "======================================",
  );

  const report = await calculateMemoryCoverage(
    db,
    cfg.companyId,
  );

  console.log(
    "CM_COVERAGE_REPORT",
    JSON.stringify(report, null, 2),
  );

  const c = report.coverage;

  const percentage = (
    numerator: number,
    denominator: number,
  ) => {
    if (denominator === 0) {
      return "0.00%";
    }

    return (
      (
        numerator /
        denominator *
        100
      ).toFixed(2) + "%"
    );
  };

  console.log(
    "\n=== COBERTURA REAL ===",
  );

  console.log(
    "Mensajes originales:",
    c.totalMessages,
  );

  console.log(
    "Mensajes con texto:",
    c.withReadableText,
  );

  console.log(
    "Elegibles para IA:",
    c.eligibleForAI,
  );

  console.log(
    "Recibos analizados:",
    c.analyzedReceipts,
  );

  console.log(
    "Observaciones:",
    c.observations,
  );

  console.log(
    "Sin recibo de IA:",
    c.eligibleWithoutReceipt,
  );

  console.log(
    "Cobertura IA sobre elegibles:",
    percentage(
      c.analyzedReceipts,
      c.eligibleForAI,
    ),
  );

  console.log(
    "Vinculados a expedientes:",
    c.linkedToCases,
  );

  console.log(
    "Cobertura de expedientes:",
    percentage(
      c.linkedToCases,
      c.totalMessages,
    ),
  );

  console.log(
    "\n=== INCONSISTENCIAS ===",
  );

  console.log(
    "Analizados sin observacion:",
    c.analyzedWithoutObservation,
  );

  console.log(
    "Recibos sin mensaje original:",
    c.receiptMissingOriginalMessage,
  );

  console.log(
    "Omitidos:",
    c.skippedReceipts,
  );

  console.log(
    "No interpretables:",
    c.unsupportedReceipts,
  );

  console.log(
    "\n=== ESTADO ===",
  );

  if (
    c.eligibleWithoutReceipt === 0 &&
    c.skippedReceipts === 0 &&
    c.analyzedWithoutObservation === 0
  ) {
    console.log(
      "CM_AI_ELIGIBLE_MESSAGES_COVERED",
    );
  } else {
    console.log(
      "CM_AI_HISTORICAL_WORK_PENDING",
    );
  }

  console.log(
    "NOTA: La cobertura de mensajes no implica",
    "que todos los eventos esten confirmados.",
  );
}

main().catch(error => {
  console.error(
    "CM_COVERAGE_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
