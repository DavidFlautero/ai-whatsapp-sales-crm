import {
  loadConfig,
} from "../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../src/modules/commercial-memory/supabase.js";

import {
  readDossier,
} from "../../src/modules/commercial-memory/dossier.repository.js";

async function main() {
  const caseId = process.argv[2];

  if (!caseId) {
    throw new Error("USE_CASE_ID_ARGUMENT");
  }

  const cfg = loadConfig();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  const dossier = await readDossier(
    db,
    cfg.companyId,
    caseId,
  ) as {
    cases: unknown[];
    facts: unknown[];
    messages: unknown[];
  };

  console.log(
    "CM_DOSSIER_COUNTS",
    JSON.stringify({
      cases: dossier.cases.length,
      facts: dossier.facts.length,
      linkedMessages:
        dossier.messages.length,
    }),
  );
}

main().catch(error => {
  console.error(
    "CM_DOSSIER_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
