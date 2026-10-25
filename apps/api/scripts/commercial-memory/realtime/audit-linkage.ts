import {
  loadConfig,
} from "../../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../../src/modules/commercial-memory/supabase.js";

type Row = Record<string, unknown>;

const MESSAGE_FIELDS = [
  "source_message_id",
  "message_id",
  "source_id",
  "whatsapp_message_id",
];

async function main() {
  const cfg = loadConfig();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  console.log(
    "CM_LINKAGE_AUDIT_START",
  );

  const sourceSample = await db.get<Row[]>(
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

  if (!sourceSample.length) {
    console.log(
      "CM_LINKAGE_NO_SOURCE_MESSAGES",
    );

    return;
  }

  const dateField = [
    "created_at",
    "timestamp",
    "received_at",
    "sent_at",
  ].find(
    field => field in sourceSample[0],
  );

  if (!dateField) {
    console.log(
      "CM_LINKAGE_NO_DATE_COLUMN",
    );

    return;
  }

  const source = await db.get<Row[]>(
    "messages",
    [
      ["select", "id"],
      [
        "company_id",
        `eq.${cfg.companyId}`,
      ],
      [
        "order",
        `${dateField}.desc`,
      ],
      ["limit", "500"],
    ],
  );

  const receiptSample = await db.get<Row[]>(
    "crm_memory_receipts",
    [
      ["select", "*"],
      [
        "company_id",
        `eq.${cfg.companyId}`,
      ],
      ["limit", "1"],
    ],
  );

  if (!receiptSample.length) {
    console.log(
      "CM_LINKAGE_NO_RECEIPTS",
    );

    return;
  }

  const foreignKey = MESSAGE_FIELDS.find(
    field => field in receiptSample[0],
  );

  if (!foreignKey) {
    console.log(
      "CM_LINKAGE_KEY_NOT_IDENTIFIED",
    );

    console.log(
      "No se infieren asociaciones",
    );

    return;
  }

  const receiptIdentifiers =
    new Set<string>();

  let receiptRows = 0;
  let truncated = false;

  const pageSize = 500;
  const maxRows = 10000;

  for (
    let offset = 0;
    offset < maxRows;
    offset += pageSize
  ) {
    const receipts = await db.get<Row[]>(
      "crm_memory_receipts",
      [
        ["select", foreignKey],
        [
          "company_id",
          `eq.${cfg.companyId}`,
        ],
        ["limit", String(pageSize)],
        ["offset", String(offset)],
      ],
    );

    receiptRows += receipts.length;

    for (const receipt of receipts) {
      const value = receipt[
        foreignKey
      ];

      if (
        typeof value === "string" &&
        value.trim()
      ) {
        receiptIdentifiers.add(
          value.trim(),
        );
      }
    }

    if (receipts.length < pageSize) {
      break;
    }

    if (
      offset + pageSize >= maxRows
    ) {
      truncated = true;
    }
  }

  let matched = 0;
  let missing = 0;

  for (const row of source) {
    const id = row.id;

    if (typeof id !== "string") {
      continue;
    }

    if (
      receiptIdentifiers.has(id)
    ) {
      matched++;
    } else {
      missing++;
    }
  }

  console.log(
    "CM_SOURCE_RECEIPT_COMPARISON",
    JSON.stringify({
      company: cfg.companyId,

      sourceSampleSize:
        source.length,

      receiptRowsRead:
        receiptRows,

      receiptKey:
        foreignKey,

      exactIdMatches:
        matched,

      exactIdMissing:
        missing,

      receiptScanTruncated:
        truncated,

      interpretation:
        "Coincidencia exacta de identificadores, no validación de vínculos comerciales",
    }, null, 2),
  );

  console.log(
    "CM_LINKAGE_AUDIT_COMPLETE",
  );
}

main().catch(error => {
  console.error(
    "CM_LINKAGE_AUDIT_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
