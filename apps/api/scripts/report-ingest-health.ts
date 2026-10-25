import {
  readdir,
  stat,
} from "node:fs/promises";

import {
  join,
} from "node:path";

import {
  INGEST_ROOT,
  INGEST_FOLDERS,
  ensureIngestFolders,
} from "../src/modules/inbox/ingest-outbox.repository.js";

async function main() {
  await ensureIngestFolders();

  console.log("=== INGEST HEALTH ===");

  let total = 0;
  let dead = 0;

  for (const folder of INGEST_FOLDERS) {
    const path = join(INGEST_ROOT, folder);
    const names = await readdir(path);

    const records = names.filter(
      name => /^[a-f0-9]{64}\.json$/.test(name),
    );

    total += records.length;

    if (folder === "dead") {
      dead = records.length;
    }

    let oldest = 0;

    for (const name of records) {
      const info = await stat(
        join(path, name),
      );

      const age = Date.now() - info.mtimeMs;

      if (age > oldest) {
        oldest = age;
      }
    }

    console.log({
      folder,
      count: records.length,
      oldestMinutes:
        Math.floor(oldest / 60000),
    });
  }

  console.log("Total:", total);

  if (dead > 0) {
    console.log(
      "ATENCION: EXISTEN MENSAJES SIN PROCESAR"
    );
    process.exitCode = 2;
  } else {
    console.log(
      "OK: SIN MENSAJES EN COLA DE ERRORES"
    );
  }
}

main().catch(error => {
  console.error(
    "INGEST_HEALTH_ERROR:",
    error instanceof Error
      ? error.message
      : "UNKNOWN"
  );

  process.exitCode = 1;
});
