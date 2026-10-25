import {
  readdir,
  link,
  unlink,
} from "node:fs/promises";

import {
  join,
} from "node:path";

import {
  INGEST_ROOT,
  ensureIngestFolders,
  ingestPath,
} from "../src/modules/inbox/ingest-outbox.repository.js";

const APPLY =
  process.argv.includes("--requeue-dead");

async function main() {
  await ensureIngestFolders();

  const deadPath = join(
    INGEST_ROOT,
    "dead",
  );

  const names = (
    await readdir(deadPath)
  ).filter(
    name => /^[a-f0-9]{64}\.json$/.test(name),
  );

  console.log("=== INGEST REPLAY ===");
  console.log("Mensajes fallidos:", names.length);
  console.log(
    "Modo:",
    APPLY ? "REPROCESAMIENTO" : "LECTURA"
  );

  if (!APPLY) {
    console.log(
      "Para recuperar: usar --requeue-dead"
    );
    return;
  }

  let recovered = 0;
  let skipped = 0;

  for (const name of names) {
    const key = name.slice(0, -5);

    const source = ingestPath(
      "dead",
      key,
    );

    const target = ingestPath(
      "pending",
      key,
    );

    try {
      await link(source, target);
      await unlink(source);
      recovered++;
    } catch (error) {
      const code =
        error &&
        typeof error === "object" &&
        "code" in error
          ? String(error.code)
          : "";

      if (code === "EEXIST") {
        skipped++;
        continue;
      }

      throw error;
    }
  }

  console.log("Recuperados:", recovered);
  console.log("Omitidos:", skipped);
}

main().catch(error => {
  console.error(
    "REPLAY_ERROR:",
    error instanceof Error
      ? error.message
      : "UNKNOWN"
  );

  process.exitCode = 1;
});
