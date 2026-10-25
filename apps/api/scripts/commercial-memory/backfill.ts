import {
  loadConfig,
} from "../../src/modules/commercial-memory/config.js";

import {
  runBatch,
} from "../../src/modules/commercial-memory/worker.js";

async function main() {
  const cfg = loadConfig();

  if (!cfg.writeEnabled) {
    throw new Error(
      "SET_CM_WRITE_ENABLED_TRUE_FOR_BACKFILL",
    );
  }

  const max = Number(
    process.env.CM_MAX_BATCHES || "20",
  );

  if (
    !Number.isInteger(max) ||
    max < 1 ||
    max > 2000
  ) {
    throw new Error(
      "INVALID_CM_MAX_BATCHES",
    );
  }

  let processed = 0;

  for (let i = 0; i < max; i++) {
    const result = await runBatch(
      cfg,
      process.env.CM_END_AT || undefined,
    );

    processed += result.processed;

    if (!result.read || result.ended) {
      break;
    }
  }

  console.log(
    "CM_BACKFILL",
    JSON.stringify({
      processed,
      company: cfg.companyId,
    }),
  );
}

main().catch(error => {
  console.error(
    "CM_BACKFILL_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
