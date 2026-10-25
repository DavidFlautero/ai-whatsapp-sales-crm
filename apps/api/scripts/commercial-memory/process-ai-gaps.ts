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
  processIntelligence,
} from "../../src/modules/commercial-memory/intelligence.processor.js";

import {
  saveIntelFailure,
} from "../../src/modules/commercial-memory/intelligence.repository.js";

import {
  INTEL_VERSION,
} from "../../src/modules/commercial-memory/intelligence.types.js";

import {
  extractCommercialText,
} from "../../src/modules/commercial-memory/commercial-text.js";

import type {
  Message,
} from "../../src/modules/commercial-memory/types.js";

type Receipt = {
  message_id: string;
  result: string;
};

function limitFromEnvironment() {
  const limit = Number(
    process.env.CM_GAP_LIMIT || "100",
  );

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 5000
  ) {
    throw new Error("INVALID_CM_GAP_LIMIT");
  }

  return limit;
}

function sleep(ms: number) {
  return new Promise<void>(resolve =>
    setTimeout(resolve, ms),
  );
}

async function main() {
  const cfg = await resolveCommercialAIConfig(
    loadConfig(),
  );

  if (!cfg.writeEnabled || !cfg.aiEnabled) {
    throw new Error(
      "CM_GAP_PROCESSING_DISABLED",
    );
  }

  const maximum = limitFromEnvironment();

  const db = new Supabase(cfg);

  const owner = randomUUID();

  let acquired = false;

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

    console.log("CM_GAP_WAITING_FOR_LEASE");

    await sleep(10000);
  }

  if (!acquired) {
    throw new Error(
      "CM_GAP_LEASE_UNAVAILABLE",
    );
  }

  const stats = {
    scanned: 0,
    previouslyProcessed: 0,
    analyzed: 0,
    unsupported: 0,
    skipped: 0,
    failed: 0,
    analyzedNow: 0,
  };

  const pageSize = 100;

  try {
    for (
      let offset = 0;
      offset < 100000;
      offset += pageSize
    ) {
      const messages = await db.get<Message[]>(
        "messages",
        [
          ["select", "*"],
          [
            "company_id",
            `eq.${cfg.companyId}`,
          ],
          [
            "order",
            "created_at.asc,id.asc",
          ],
          ["limit", String(pageSize)],
          ["offset", String(offset)],
        ],
      );

      if (!messages.length) break;

      const ids = messages.map(
        item => item.id,
      );

      const receipts = await db.get<Receipt[]>(
        "cm_intel_receipts",
        [
          ["select", "message_id,result"],
          [
            "company_id",
            `eq.${cfg.companyId}`,
          ],
          [
            "processor_version",
            `eq.${INTEL_VERSION}`,
          ],
          [
            "message_id",
            `in.(${ids.join(",")})`,
          ],
          ["limit", "200"],
        ],
      );

      const processed = new Set(
        receipts.map(item =>
          item.message_id,
        ),
      );

      for (const message of messages) {
        stats.scanned++;

        if (processed.has(message.id)) {
          stats.previouslyProcessed++;
          continue;
        }

        const text = extractCommercialText(
          message,
        );

        if (!text) {
          // El mensaje queda reservado para
          // procesamiento multimedia o revisión
          // según su tipo, sin enviarlo como JSON
          // conversacional al modelo textual.
          stats.skipped++;
          continue;
        }

        if (stats.analyzedNow >= maximum) {
          break;
        }

        if (stats.analyzedNow % 5 === 0) {
          const renewed =
            await db.rpc<boolean>(
              "cm_memory_try_lease",
              {
                p_company: cfg.companyId,
                p_owner: owner,
                p_seconds: 300,
              },
            );

          if (!renewed) {
            throw new Error(
              "CM_GAP_LEASE_LOST",
            );
          }
        }

        try {
          const result =
            await processIntelligence(
              cfg,
              db,
              message,
            );

          if (result === "analyzed") {
            stats.analyzed++;
          }

          if (result === "unsupported") {
            stats.unsupported++;
          }

          if (result === "skipped") {
            stats.skipped++;
          }

          stats.analyzedNow++;

        } catch (error) {
          stats.failed++;

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
            "CM_GAP_MESSAGE_FAILED",
            {
              messageId: message.id,
              code,
            },
          );

          throw error;
        }

        if (stats.analyzedNow % 25 === 0) {
          console.log(
            "CM_GAP_PROGRESS",
            stats,
          );
        }

        await sleep(500);
      }

      if (
        stats.analyzedNow >= maximum ||
        messages.length < pageSize
      ) {
        break;
      }
    }

    console.log(
      "CM_GAP_COMPLETE",
      {
        ...stats,
        company: cfg.companyId,
        maximum,
      },
    );

  } finally {
    try {
      await db.rpc<boolean>(
        "cm_memory_try_lease",
        {
          p_company: cfg.companyId,
          p_owner: owner,
          p_seconds: 30,
        },
      );

      console.log(
        "CM_GAP_LEASE_SHORTENED",
      );
    } catch {
      console.error(
        "CM_GAP_LEASE_WARNING",
      );
    }
  }
}

main().catch(error => {
  console.error(
    "CM_GAP_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
