import {
  loadConfig,
} from "../../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../../src/modules/commercial-memory/supabase.js";

type Row = Record<string, unknown>;

const TIME_FIELDS = [
  "created_at",
  "timestamp",
  "received_at",
  "sent_at",
  "message_timestamp",
];

function timestamp(
  value: unknown,
): number | null {
  if (
    typeof value === "number" ||
    (
      typeof value === "string" &&
      /^\d{10,13}$/.test(value)
    )
  ) {
    const number = Number(value);

    const ms =
      number < 100000000000
        ? number * 1000
        : number;

    return Number.isFinite(ms)
      ? ms
      : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

async function main() {
  const cfg = loadConfig();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  const first = await db.get<Row[]>(
    "messages",
    [
      ["select", "*"],
      [
        "company_id",
        `eq.${cfg.companyId}`,
      ],
      ["limit", "1"],
    ],
  );

  if (first.length === 0) {
    console.log(
      "CM_FRESHNESS_NO_MESSAGES",
    );

    return;
  }

  const field = TIME_FIELDS.find(
    key => key in first[0],
  );

  if (!field) {
    console.log(
      "CM_FRESHNESS_NO_TIMESTAMP_COLUMN",
    );

    return;
  }

  const messages = await db.get<Row[]>(
    "messages",
    [
      [
        "select",
        `id,direction,${field}`,
      ],

      [
        "company_id",
        `eq.${cfg.companyId}`,
      ],

      [
        "order",
        `${field}.desc`,
      ],

      ["limit", "1000"],
    ],
  );

  const now = Date.now();

  const last24Hours =
    now - 24 * 60 * 60 * 1000;

  const last7Days =
    now - 7 * 24 * 60 * 60 * 1000;

  const stats = {
    sampled: messages.length,
    inbound: 0,
    outbound: 0,
    unknown: 0,
    last24Hours: 0,
    last7Days: 0,
    invalidTimestamps: 0,
  };

  let newest:
    number | null = null;

  let oldest:
    number | null = null;

  for (const row of messages) {
    const direction = String(
      row.direction ?? "",
    ).toLowerCase();

    if (
      direction === "inbound" ||
      direction === "incoming"
    ) {
      stats.inbound++;
    } else if (
      direction === "outbound" ||
      direction === "outgoing"
    ) {
      stats.outbound++;
    } else {
      stats.unknown++;
    }

    const date = timestamp(
      row[field],
    );

    if (date === null) {
      stats.invalidTimestamps++;
      continue;
    }

    if (date >= last24Hours) {
      stats.last24Hours++;
    }

    if (date >= last7Days) {
      stats.last7Days++;
    }

    newest =
      newest === null
        ? date
        : Math.max(newest, date);

    oldest =
      oldest === null
        ? date
        : Math.min(oldest, date);
  }

  console.log(
    "CM_SOURCE_FRESHNESS",
    JSON.stringify({
      company: cfg.companyId,

      timestampColumn: field,

      ...stats,

      newest:
        newest === null
          ? null
          : new Date(newest).toISOString(),

      oldestInSample:
        oldest === null
          ? null
          : new Date(oldest).toISOString(),

      boundedSample: true,

      note:
        "Solo se consultaron los 1000 mensajes más recientes",
    }, null, 2),
  );

  console.log(
    "CM_FRESHNESS_AUDIT_COMPLETE",
  );
}

main().catch(error => {
  console.error(
    "CM_FRESHNESS_AUDIT_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
