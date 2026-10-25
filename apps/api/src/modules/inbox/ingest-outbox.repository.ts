import {
  mkdir,
  chmod,
  open,
  link,
  unlink,
  readFile,
  readdir,
  rename,
  stat,
  statfs,
} from "node:fs/promises";

import {
  dirname,
  join,
  resolve,
} from "node:path";

import {
  randomUUID,
} from "node:crypto";

import type {
  saveMessage as originalSaveMessage,
} from "../../services/conversations/conversation.repository.js";

import {
  getIngestKey,
} from "./ingest-dedup.service.js";

type MessageInput =
  Parameters<typeof originalSaveMessage>[0];

export type IngestRecord = {
  version: 1;
  key: string;
  companyId: string;
  message: MessageInput;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
};

export const INGEST_ROOT = resolve(
  process.env.CRM_INGEST_SPOOL_DIR ||
  "/var/lib/eventos-mediterraneo/whapi-ingest",
);

export const INGEST_FOLDERS = [
  "pending",
  "processing",
  "dead",
] as const;

export async function ensureIngestFolders() {
  for (const folder of INGEST_FOLDERS) {
    const path = join(INGEST_ROOT, folder);

    await mkdir(path, {
      recursive: true,
      mode: 0o700,
    });

    await chmod(path, 0o700);
  }
}

export function ingestPath(
  folder: typeof INGEST_FOLDERS[number],
  key: string,
) {
  if (!/^[a-f0-9]{64}$/.test(key)) {
    throw new Error("INVALID_INGEST_KEY");
  }

  return join(INGEST_ROOT, folder, `${key}.json`);
}

function errorCode(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error
  ) {
    return String(error.code);
  }

  return "";
}

async function writeUnique(
  destination: string,
  record: IngestRecord,
) {
  const temporary = join(
    dirname(destination),
    `.${record.key}.${randomUUID()}.tmp`,
  );

  const handle = await open(
    temporary,
    "wx",
    0o600,
  );

  try {
    await handle.writeFile(
      JSON.stringify(record),
    );

    await handle.sync();
  } finally {
    await handle.close();
  }

  try {
    await link(temporary, destination);
  } catch (error) {
    if (errorCode(error) !== "EEXIST") {
      throw error;
    }
  } finally {
    await unlink(temporary).catch(() => undefined);
  }

  const directory = await open(
    dirname(destination),
    "r",
  );

  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}

export async function stageIngestMessage(
  companyId: string,
  message: MessageInput,
) {
  const externalMessageId =
    message.external_message_id;

  if (!externalMessageId) {
    throw new Error("INGEST_MESSAGE_ID_REQUIRED");
  }

  const key = getIngestKey({
    companyId,
    provider: "whapi",
    externalMessageId,
  });

  await ensureIngestFolders();

  const record: IngestRecord = {
    version: 1,
    key,
    companyId,
    message,
    createdAt: Date.now(),
    attempts: 0,
    nextAttemptAt: Date.now(),
  };

  const bytes = Buffer.byteLength(
    JSON.stringify(record),
  );

  if (bytes > 8 * 1024 * 1024) {
    throw new Error("INGEST_PAYLOAD_TOO_LARGE");
  }

  const filesystem = await statfs(INGEST_ROOT);

  const freeBytes =
    Number(filesystem.bavail) *
    Number(filesystem.bsize);

  if (freeBytes < 128 * 1024 * 1024) {
    throw new Error("INGEST_DISK_SPACE_LOW");
  }

  await writeUnique(
    ingestPath("pending", key),
    record,
  );

  return key;
}

export async function readIngestRecord(
  folder: typeof INGEST_FOLDERS[number],
  key: string,
): Promise<IngestRecord> {
  const raw = await readFile(
    ingestPath(folder, key),
    "utf8",
  );

  const value = JSON.parse(raw) as IngestRecord;

  if (
    value.version !== 1 ||
    value.key !== key ||
    !value.companyId ||
    !value.message?.external_message_id
  ) {
    throw new Error("INVALID_INGEST_RECORD");
  }

  return value;
}

export async function claimIngestRecord(
  key: string,
): Promise<boolean> {
  try {
    await link(
      ingestPath("pending", key),
      ingestPath("processing", key),
    );

    await unlink(
      ingestPath("pending", key),
    );

    return true;
  } catch (error) {
    if (
      errorCode(error) === "ENOENT" ||
      errorCode(error) === "EEXIST"
    ) {
      return false;
    }

    throw error;
  }
}

export async function completeIngestRecord(
  key: string,
) {
  await unlink(
    ingestPath("processing", key),
  );
}

export async function failIngestRecord(
  key: string,
  record: IngestRecord,
) {
  const attempts = record.attempts + 1;

  const next: IngestRecord = {
    ...record,
    attempts,
    nextAttemptAt:
      Date.now() +
      Math.min(
        30 * 60 * 1000,
        2000 * 2 ** Math.min(attempts, 12),
      ),
  };

  const folder =
    attempts >= 24
      ? "dead"
      : "pending";

  await writeUnique(
    ingestPath(folder, key),
    next,
  );

  await completeIngestRecord(key);

  return folder;
}

export async function recoverStaleIngestRecords() {
  await ensureIngestFolders();

  const names = await readdir(
    join(INGEST_ROOT, "processing"),
  );

  let recovered = 0;

  for (const name of names) {
    const match = /^([a-f0-9]{64})\.json$/.exec(name);

    if (!match) continue;

    const key = match[1];
    const source = ingestPath("processing", key);

    try {
      const information = await stat(source);

      if (Date.now() - information.mtimeMs < 600000) {
        continue;
      }

      const record = await readIngestRecord(
        "processing",
        key,
      );

      await writeUnique(
        ingestPath("pending", key),
        record,
      );

      await unlink(source);
      recovered++;
    } catch {
      // Conservar para revisión.
    }
  }

  return recovered;
}
