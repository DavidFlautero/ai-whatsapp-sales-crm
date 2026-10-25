import { randomUUID } from "node:crypto";

import {
  loadConfig,
} from "../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../src/modules/commercial-memory/supabase.js";

import {
  resolveCommercialAIConfig,
} from "../../src/modules/commercial-memory/intelligence-provider.js";

import {
  fetchMessages,
} from "../../src/modules/commercial-memory/messages.repository.js";

import {
  processIntelligence,
} from "../../src/modules/commercial-memory/intelligence.processor.js";

import {
  loadIntelCursor,
  saveIntelCursor,
  saveIntelFailure,
} from "../../src/modules/commercial-memory/intelligence.repository.js";

type Counters = {
  processed: number;
  analyzed: number;
  skipped: number;
  unsupported: number;
  failed: number;
};

function positiveInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
): number {
  const parsed = Number(value ?? fallback);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > maximum
  ) {
    throw new Error(
      "CM_INVALID_PROCESSING_LIMIT",
    );
  }

  return parsed;
}

async function main() {
  const cfg = await resolveCommercialAIConfig(
    loadConfig(),
  );

  if (!cfg.writeEnabled || !cfg.aiEnabled) {
    throw new Error(
      "CM_HISTORICAL_AI_NOT_ENABLED",
    );
  }

  const maximum = positiveInteger(
    process.env.CM_HISTORICAL_LIMIT,
    250,
    10000,
  );

  const delayMs = positiveInteger(
    process.env.CM_HISTORICAL_DELAY_MS,
    500,
    60000,
  );

  const db = new Supabase(cfg);

  const owner = randomUUID();

  let acquired = false;

  console.log(
    "CM_HISTORICAL_INITIALIZING",
    {
      company: cfg.companyId,
      model: cfg.openaiModel,
      maximum,
    },
  );

  for (let attempt = 0; attempt < 36; attempt++) {
    acquired = await db.rpc<boolean>(
      "cm_memory_try_lease",
      {
        p_company: cfg.companyId,
        p_owner: owner,
        p_seconds: 300,
      },
    );

    if (acquired) break;

    console.log(
      "CM_HISTORICAL_WAITING_FOR_LEASE",
    );

    await new Promise(resolve =>
      setTimeout(resolve, 10000),
    );
  }

  if (!acquired) {
    throw new Error(
      "CM_HISTORICAL_LEASE_UNAVAILABLE",
    );
  }

  const counters: Counters = {
    processed: 0,
    analyzed: 0,
    skipped: 0,
    unsupported: 0,
    failed: 0,
  };

  let exhausted = false;

  try {
    let cursor = await loadIntelCursor(
      db,
      cfg.companyId,
      cfg.startAt,
    );

    console.log(
      "CM_HISTORICAL_CURSOR",
      {
        time: cursor.time,
        messageId: cursor.id,
      },
    );

    while (
      counters.processed < maximum
    ) {
      const renewed = await db.rpc<boolean>(
        "cm_memory_try_lease",
        {
          p_company: cfg.companyId,
          p_owner: owner,
          p_seconds: 300,
        },
      );

      if (!renewed) {
        throw new Error(
          "CM_HISTORICAL_LEASE_LOST",
        );
      }

      const messages = await fetchMessages(
        db,
        cfg.companyId,
        cursor,
        undefined,
        1,
      );

      if (!messages.length) {
        exhausted = true;
        break;
      }

      const message = messages[0];

      try {
        const result =
          await processIntelligence(
            cfg,
            db,
            message,
          );

        if (result === "analyzed") {
          counters.analyzed++;
        }

        if (result === "skipped") {
          counters.skipped++;
        }

        if (result === "unsupported") {
          counters.unsupported++;
        }

      } catch (error) {
        counters.failed++;

        const code =
          error instanceof Error
            ? error.message.slice(0, 80)
            : "UNKNOWN";

        await saveIntelFailure(
          db,
          cfg.companyId,
          message.id,
          code,
        ).catch(() => undefined);

        console.error(
          "CM_HISTORICAL_MESSAGE_ERROR",
          {
            messageId: message.id,
            code,
          },
        );

        // No avanzamos el cursor sobre un
        // mensaje cuyo procesamiento fallo.
        throw new Error(
          "CM_HISTORICAL_PAUSED_ON_FAILURE",
        );
      }

      cursor = {
        time: message.created_at,
        id: message.id,
      };

      await saveIntelCursor(
        db,
        cfg.companyId,
        cursor,
      );

      counters.processed++;

      if (
        counters.processed % 25 === 0
      ) {
        console.log(
          "CM_HISTORICAL_PROGRESS",
          {
            ...counters,
            cursor: cursor.time,
          },
        );
      }

      await new Promise(resolve =>
        setTimeout(resolve, delayMs),
      );
    }

    console.log(
      "CM_HISTORICAL_COMPLETE",
      {
        ...counters,
        exhausted,
        company: cfg.companyId,
      },
    );

  } finally {
    try {
      const shortened =
        await db.rpc<boolean>(
          "cm_memory_try_lease",
          {
            p_company: cfg.companyId,
            p_owner: owner,
            p_seconds: 30,
          },
        );

      console.log(
        shortened
          ? "CM_HISTORICAL_LEASE_SHORTENED"
          : "CM_HISTORICAL_LEASE_NOT_OWNED",
      );

    } catch {
      console.error(
        "CM_HISTORICAL_LEASE_WARNING",
      );
    }
  }
}

main().catch(error => {
  console.error(
    "CM_HISTORICAL_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
