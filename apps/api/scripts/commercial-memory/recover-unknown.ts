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
  INTEL_VERSION,
} from "../../src/modules/commercial-memory/intelligence.types.js";

import type {
  Message,
} from "../../src/modules/commercial-memory/types.js";

async function main() {
  const cfg = await resolveCommercialAIConfig(
    loadConfig(),
  );

  if (!cfg.writeEnabled) {
    throw new Error("CM_WRITE_ENABLED_REQUIRED");
  }

  const limit = Number(
    process.env.CM_RECOVER_LIMIT || "25",
  );

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new Error("INVALID_RECOVERY_LIMIT");
  }

  const db = new Supabase(cfg);
  const owner = randomUUID();

  let granted = false;

  for (let attempt = 0; attempt < 13; attempt++) {
    granted = await db.rpc<boolean>(
      "cm_memory_try_lease",
      {
        p_company: cfg.companyId,
        p_owner: owner,
        p_seconds: 300,
      },
    );

    if (granted) break;

    console.log("CM_RECOVERY_WAITING_FOR_LEASE");

    await new Promise(resolve =>
      setTimeout(resolve, 5000),
    );
  }

  if (!granted) {
    throw new Error("CM_RECOVERY_LEASE_BUSY");
  }

  let analyzed = 0;
  let unsupported = 0;
  let skipped = 0;
  let ineligible = 0;

  try {
    const receipts = await db.get<
      Array<{ message_id: string }>
    >(
      "cm_intel_receipts",
      [
        ["select", "message_id"],
        ["company_id", `eq.${cfg.companyId}`],
        [
          "processor_version",
          `eq.${INTEL_VERSION}`,
        ],
        ["result", "eq.skipped"],
        ["order", "created_at.asc"],
        ["limit", String(limit)],
      ],
    );

    console.log("CM_RECOVERY_CANDIDATES", {
      total: receipts.length,
    });

    for (const receipt of receipts) {
      const messages = await db.get<Message[]>(
        "messages",
        [
          ["select", "*"],
          ["company_id", `eq.${cfg.companyId}`],
          ["id", `eq.${receipt.message_id}`],
          ["limit", "1"],
        ],
      );

      const message = messages[0];

      if (
        !message ||
        message.message_type !== "unknown" ||
        typeof message.body !== "string" ||
        !message.body.trim()
      ) {
        ineligible++;
        continue;
      }

      const renewed = await db.rpc<boolean>(
        "cm_memory_try_lease",
        {
          p_company: cfg.companyId,
          p_owner: owner,
          p_seconds: 300,
        },
      );

      if (!renewed) {
        throw new Error("CM_RECOVERY_LEASE_LOST");
      }

      const result = await processIntelligence(
        cfg,
        db,
        message,
      );

      if (result === "analyzed") analyzed++;
      if (result === "unsupported") unsupported++;
      if (result === "skipped") skipped++;

      console.log("CM_RECOVERY_PROGRESS", {
        analyzed,
        unsupported,
        skipped,
        ineligible,
      });
    }

    console.log("CM_RECOVERY_COMPLETE", {
      analyzed,
      unsupported,
      skipped,
      ineligible,
      company: cfg.companyId,
    });
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

      console.log("CM_RECOVERY_LEASE_SHORTENED");
    } catch {
      console.error("CM_RECOVERY_LEASE_WARNING");
    }
  }
}

main().catch(error => {
  console.error(
    "CM_RECOVERY_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
