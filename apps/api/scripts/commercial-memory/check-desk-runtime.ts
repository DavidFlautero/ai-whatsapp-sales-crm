import {
  loadConfig,
} from "../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../src/modules/commercial-memory/supabase.js";

import {
  listDeskCases,
  listDeskTasks,
  listDeskLinks,
  readDeskCase,
} from "../../src/modules/commercial-memory/commercial-desk.repository.js";

async function main() {
  const cfg = loadConfig();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  let errors = 0;

  let cases: Array<{ id: string }> = [];

  console.log("CM_DESK_RUNTIME_START");

  try {
    cases = await listDeskCases(
      db,
      cfg.companyId,
    );

    console.log("CASES_OK", {
      total: cases.length,
    });
  } catch (error) {
    errors++;

    console.error(
      "CASES_FAILED",
      error instanceof Error
        ? error.message.slice(0, 300)
        : "UNKNOWN",
    );
  }

  try {
    const result = await listDeskTasks(
      db,
      cfg.companyId,
    );

    console.log("TASKS_OK", {
      visible: result.tasks.length,
      quarantined: result.quarantined,
    });
  } catch (error) {
    errors++;

    console.error(
      "TASKS_FAILED",
      error instanceof Error
        ? error.message.slice(0, 300)
        : "UNKNOWN",
    );
  }

  try {
    const links = await listDeskLinks(
      db,
      cfg.companyId,
    );

    console.log("LINKS_OK", {
      total: links.length,
    });
  } catch (error) {
    errors++;

    console.error(
      "LINKS_FAILED",
      error instanceof Error
        ? error.message.slice(0, 300)
        : "UNKNOWN",
    );
  }

  if (cases.length > 0) {
    try {
      const dossier = await readDeskCase(
        db,
        cfg.companyId,
        cases[0].id,
      );

      if (!dossier) {
        throw new Error(
          "CASE_DOSSIER_NOT_FOUND",
        );
      }

      console.log("DOSSIER_OK", {
        messageCount: dossier.messageCount,
        displayedMessages:
          dossier.messages.length,
        tasks: dossier.tasks.length,
        links: dossier.links.length,
      });
    } catch (error) {
      errors++;

      console.error(
        "DOSSIER_FAILED",
        error instanceof Error
          ? error.message.slice(0, 300)
          : "UNKNOWN",
      );
    }
  }

  console.log("CM_DESK_RUNTIME_COMPLETE", {
    checksFailed: errors,
    ready: errors === 0,
  });

  if (errors > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(
    "CM_DESK_RUNTIME_FATAL",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
