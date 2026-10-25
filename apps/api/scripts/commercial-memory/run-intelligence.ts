import { resolveCommercialAIConfig } from "../../src/modules/commercial-memory/intelligence-provider.js";
import { randomUUID } from "node:crypto";

import {
  loadConfig,
} from "../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../src/modules/commercial-memory/supabase.js";

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

import {
  INTEL_VERSION,
} from "../../src/modules/commercial-memory/intelligence.types.js";

async function main() {
  const cfg = await resolveCommercialAIConfig(
    loadConfig(),
  );

  if (
    !cfg.writeEnabled ||
    !cfg.aiEnabled ||
    !cfg.openaiKey
  ) {
    throw new Error(
      "CM_WRITE_AND_AI_MUST_BE_ENABLED",
    );
  }

  const limit = Number(
    process.env.CM_INTEL_LIMIT || "100",
  );

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 1000
  ) {
    throw new Error("INVALID_CM_INTEL_LIMIT");
  }

  const db = new Supabase(cfg);
  const workerId = randomUUID();

  let granted = false;

  // Esperar un bloqueo anterior sin eliminarlo
  // ni interferir con otro trabajador activo.
  for (let attempt = 0; attempt <= 24; attempt++) {
    granted = await db.rpc<boolean>(
      "cm_memory_try_lease",
      {
        p_company: cfg.companyId,
        p_owner: workerId,
        p_seconds: 300,
      },
    );

    if (granted) break;

    if (attempt === 24) {
      throw new Error(
        "CM_INTEL_LEASE_BUSY_AFTER_6_MINUTES",
      );
    }

    if (attempt % 4 === 0) {
      console.log("CM_INTEL_WAITING_FOR_LEASE");
    }

    await new Promise(resolve =>
      setTimeout(resolve, 15000),
    );
  }

  try {

  let cursor = await loadIntelCursor(
    db,
    cfg.companyId,
    cfg.startAt,
  );

  let analyzed = 0;
  let unsupported = 0;
  let skipped = 0;
  let processed = 0;

  console.log("CM_INTELLIGENCE_STARTED", {
    version: INTEL_VERSION,
    model: cfg.openaiModel,
    maximumMessages: limit,
  });

  while (processed < limit) {
    if (processed % 5 === 0) {
      const renewed = await db.rpc<boolean>(
        "cm_memory_try_lease",
        {
          p_company: cfg.companyId,
          p_owner: workerId,
          p_seconds: 300,
        },
      );

      if (!renewed) {
        throw new Error("CM_INTEL_LEASE_LOST");
      }
    }

    const messages = await fetchMessages(
      db,
      cfg.companyId,
      cursor,
      undefined,
      1,
    );

    if (!messages.length) break;

    const message = messages[0];

    try {
      const result = await processIntelligence(
        cfg,
        db,
        message,
      );

      if (result === "analyzed") analyzed++;
      if (result === "unsupported") unsupported++;
      if (result === "skipped") skipped++;
    } catch (error) {
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

      throw new Error(
        `CM_INTEL_MESSAGE_FAILED:${message.id}:${code}`,
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

    processed++;

    if (processed % 25 === 0) {
      console.log("CM_INTEL_PROGRESS", {
        processed,
        analyzed,
        unsupported,
        skipped,
      });
    }
  }

  console.log("CM_INTELLIGENCE_COMPLETE", {
    processed,
    analyzed,
    unsupported,
    skipped,
    company: cfg.companyId,
    version: INTEL_VERSION,
  });
  } finally {
    // El dueño actual acorta su propio bloqueo
    // para no retenerlo cinco minutos al terminar.
    try {
      const released = await db.rpc<boolean>(
        "cm_memory_try_lease",
        {
          p_company: cfg.companyId,
          p_owner: workerId,
          p_seconds: 30,
        },
      );

      console.log(
        released
          ? "CM_INTEL_LEASE_SHORTENED_30S"
          : "CM_INTEL_LEASE_NOT_OWNED",
      );
    } catch {
      console.error(
        "CM_INTEL_LEASE_SHORTEN_FAILED",
      );
    }
  }
}

main().catch(error => {
  console.error(
    "CM_INTELLIGENCE_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
