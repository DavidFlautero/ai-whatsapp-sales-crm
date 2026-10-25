import { randomUUID } from "node:crypto";

import type {
  Config,
} from "./config.js";

import { Supabase } from "./supabase.js";

import {
  fetchMessages,
} from "./messages.repository.js";

import {
  loadCursor,
  saveCursor,
} from "./cursor.repository.js";

import {
  processMessage,
} from "./processor.js";

const workerId = randomUUID();

export type BatchResult = {
  read: number;
  processed: number;
  ended: boolean;
};

export async function runBatch(
  cfg: Config,
  endAt?: string,
): Promise<BatchResult> {
  if (!cfg.writeEnabled) {
    throw new Error("CM_WRITE_DISABLED");
  }

  const db = new Supabase(cfg);

  const lease = await db.rpc<boolean>(
    "cm_memory_try_lease",
    {
      p_company: cfg.companyId,
      p_owner: workerId,
      p_seconds: 180,
    },
  );

  if (!lease) {
    return {
      read: 0,
      processed: 0,
      ended: true,
    };
  }

  let cursor = await loadCursor(
    db,
    cfg.companyId,
    cfg.startAt,
  );

  const messages = await fetchMessages(
    db,
    cfg.companyId,
    cursor,
    endAt,
    100,
  );

  let processed = 0;

  for (const message of messages) {
    if (processed % 5 === 0) {
      const renewed = await db.rpc<boolean>(
        "cm_memory_try_lease",
        {
          p_company: cfg.companyId,
          p_owner: workerId,
          p_seconds: 180,
        },
      );

      if (!renewed) {
        throw new Error("WORKER_LEASE_LOST");
      }
    }

    const result = await processMessage(
      cfg,
      db,
      message,
    );

    cursor = {
      time: message.created_at,
      id: message.id,
    };

    await saveCursor(
      db,
      cfg.companyId,
      cursor,
    );

    processed++;

    if (processed % 25 === 0) {
      console.log(
        "CM_BATCH_PROGRESS",
        JSON.stringify({
          processed,
          result,
        }),
      );
    }
  }

  return {
    read: messages.length,
    processed,
    ended: messages.length < 100,
  };
}

export async function runContinuous(
  cfg: Config,
): Promise<void> {
  if (!cfg.writeEnabled) {
    throw new Error(
      "CM_WRITE_ENABLED_REQUIRED",
    );
  }

  console.log(
    "CM_WORKER_STARTED",
    JSON.stringify({
      company: cfg.companyId,
      ai: cfg.aiEnabled,
      pollMs: cfg.pollMs,
    }),
  );

  while (true) {
    try {
      const result = await runBatch(cfg);

      if (result.processed) {
        console.log(
          "CM_BATCH_COMPLETE",
          JSON.stringify(result),
        );
      }

      if (!result.ended) continue;
    } catch (error) {
      console.error(
        "CM_BATCH_FAILED",
        error instanceof Error
          ? error.message.slice(0, 200)
          : "UNKNOWN",
      );
    }

    await new Promise(resolve =>
      setTimeout(resolve, cfg.pollMs),
    );
  }
}
