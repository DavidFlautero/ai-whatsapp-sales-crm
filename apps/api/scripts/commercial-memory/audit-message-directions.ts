import {
  loadConfig,
} from "../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../src/modules/commercial-memory/supabase.js";

type MessageRow = {
  id: string;
  direction: string | null;
};

async function main() {
  const cfg = loadConfig();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  const counts: Record<string, number> = {};

  let total = 0;

  for (
    let offset = 0;
    offset < 100000;
    offset += 500
  ) {
    const messages = await db.get<MessageRow[]>(
      "messages",
      [
        ["select", "id,direction"],
        ["company_id", `eq.${cfg.companyId}`],
        ["order", "id.asc"],
        ["limit", "500"],
        ["offset", String(offset)],
      ],
    );

    for (const message of messages) {
      const direction =
        message.direction || "unknown";

      counts[direction] =
        (counts[direction] || 0) + 1;

      total++;
    }

    if (messages.length < 500) {
      break;
    }
  }

  console.log(
    "CM_MESSAGE_DIRECTIONS",
    JSON.stringify({
      company: cfg.companyId,
      total,
      byDirection: counts,
    }, null, 2),
  );
}

main().catch(error => {
  console.error(
    "CM_DIRECTION_AUDIT_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
