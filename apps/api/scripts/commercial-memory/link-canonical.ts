import {
  loadConfig,
} from "../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../src/modules/commercial-memory/supabase.js";

import {
  buildCanonicalBridge,
} from "../../src/modules/commercial-memory/bridge.service.js";

async function main() {
  const cfg = loadConfig();
  const apply = process.argv.includes("--apply");

  if (apply && !cfg.writeEnabled) {
    throw new Error("CM_WRITE_ENABLED_REQUIRED");
  }

  const db = new Supabase({
    ...cfg,
    writeEnabled: true,
  });

  const result = await buildCanonicalBridge(
    db,
    cfg.companyId,
    apply,
  );

  console.log(
    "CM_CANONICAL_BRIDGE",
    JSON.stringify({
      mode: apply ? "APPLIED" : "PREVIEW",
      ...result,
    }, null, 2),
  );
}

main().catch(error => {
  console.error(
    "CM_BRIDGE_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
