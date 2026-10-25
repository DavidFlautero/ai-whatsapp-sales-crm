import {
  readdir,
  rename,
} from "node:fs/promises";

import {
  join,
} from "node:path";

import {
  env,
} from "../../config/env.js";

import {
  saveMessage,
} from "../../services/conversations/conversation.repository.js";

import {
  captureIncomingEvent,
} from "../../services/intake/event-intake-capture.service.js";

import {
  INGEST_ROOT,
  ensureIngestFolders,
  ingestPath,
  readIngestRecord,
  claimIngestRecord,
  completeIngestRecord,
  failIngestRecord,
  recoverStaleIngestRecords,
} from "./ingest-outbox.repository.js";

let started = false;
let running = false;

function shouldCapture(
  direction: string,
  messageType: string | undefined,
  rawPayload: unknown,
): boolean {
  if (
    direction !== "inbound" ||
    messageType !== "text"
  ) {
    return false;
  }

  const payload = rawPayload as {
    message?: { type?: unknown };
  } | null;

  const originalType = payload?.message?.type;

  return (
    originalType === undefined ||
    originalType === "text" ||
    originalType === "chat"
  );
}

async function processIngest(
  key: string,
) {
  const claimed = await claimIngestRecord(key);

  if (!claimed) return;

  let record;

  try {
    record = await readIngestRecord(
      "processing",
      key,
    );
  } catch {
    await rename(
      ingestPath("processing", key),
      ingestPath("dead", key),
    ).catch(() => undefined);

    console.error("[INGEST DEAD] Invalid record");
    return;
  }

  try {
    await saveMessage(
      record.message,
      record.companyId,
    );

    const input = record.message;

    const enabled =
      process.env.CRM_INTAKE_CAPTURE_ENABLED
        ?.trim()
        .toLowerCase() === "true";

    if (
      enabled &&
      shouldCapture(
        input.direction,
        input.message_type,
        input.raw_payload,
      ) &&
      input.body?.trim()
    ) {
      const result = await captureIncomingEvent({
        companyId: record.companyId,
        phone: input.contact_phone,
        sourceMessageId:
          input.external_message_id || "",
        text: input.body,
      });

      if (result.status === "disabled") {
        throw new Error("CRM_INTAKE_DB_DISABLED");
      }

      console.log("[INGEST CAPTURE]", {
        status: result.status,
        key: key.slice(0, 12),
      });
    }

    await completeIngestRecord(key);

    console.log("[INGEST COMPLETE]", {
      key: key.slice(0, 12),
    });
  } catch (error) {
    try {
      const location = await failIngestRecord(
        key,
        record,
      );

      console.error("[INGEST RETRY]", {
        key: key.slice(0, 12),
        attempts: record.attempts + 1,
        location,
        reason:
          error instanceof Error
            ? error.message.slice(0, 100)
            : "UNKNOWN",
      });
    } catch {
      console.error(
        "[INGEST ERROR] Failed to preserve retry",
      );
    }
  }
}

export async function drainIngestQueue() {
  if (running) return;

  running = true;

  try {
    await ensureIngestFolders();
    await recoverStaleIngestRecords();

    const names = await readdir(
      join(INGEST_ROOT, "pending"),
    );

    let processed = 0;

    for (const name of names) {
      if (processed >= 50) break;

      const match =
        /^([a-f0-9]{64})\.json$/.exec(name);

      if (!match) continue;

      const key = match[1];

      let record;

      try {
        record = await readIngestRecord(
          "pending",
          key,
        );
      } catch {
        await rename(
          ingestPath("pending", key),
          ingestPath("dead", key),
        ).catch(() => undefined);

        continue;
      }

      if (
        Date.now() - record.createdAt < 15000 ||
        record.nextAttemptAt > Date.now()
      ) {
        continue;
      }

      await processIngest(key);
      processed++;
    }
  } finally {
    running = false;
  }
}

export function startDurableIngestWorker() {
  if (started) return;

  started = true;

  console.log("[INGEST WORKER READY]", {
    company: env.DEFAULT_COMPANY_ID,
  });

  void drainIngestQueue().catch(() => {
    console.error("[INGEST WORKER ERROR]");
  });

  const timer = setInterval(() => {
    void drainIngestQueue().catch(() => {
      console.error("[INGEST WORKER ERROR]");
    });
  }, 5000);

  timer.unref();
}
