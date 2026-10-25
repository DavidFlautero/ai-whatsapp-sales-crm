import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import {
  fingerprint,
} from "./classifier.mjs";

const outDir = process.argv[2];

if (
  !outDir ||
  !outDir.startsWith(
    "/var/backups/eventos-commercial-memory/offline-contacts-"
  )
) {
  throw new Error(
    "INVALID_OUTPUT_DIRECTORY"
  );
}

const indexPath = path.join(
  outDir,
  "source-index.json",
);

if (!fs.existsSync(indexPath)) {
  throw new Error(
    "SUPABASE_SOURCE_INDEX_NOT_FOUND"
  );
}

const sourceIndex = JSON.parse(
  fs.readFileSync(
    indexPath,
    "utf8",
  ),
);

const companyId =
  sourceIndex.company_id;

const known = new Set(
  sourceIndex.external_id_hashes,
);

const webhookFile =
  "/var/www/control/apps/api/data/whapi-webhook.jsonl";

if (!fs.existsSync(webhookFile)) {
  throw new Error(
    "WHAPI_HISTORY_FILE_NOT_FOUND"
  );
}

const input = fs.createReadStream(
  webhookFile,
  {
    encoding: "utf8",
  },
);

const reader = readline.createInterface({
  input,
  crlfDelay: Infinity,
});

let events = 0;
let messageEvents = 0;
let messages = 0;
let missingIdentifiers = 0;
let invalidJson = 0;

const unique = new Set();
const candidates = new Set();

const types = new Map();
const directions = new Map();

function increment(map, value) {
  map.set(
    value,
    (map.get(value) ?? 0) + 1,
  );
}

for await (const line of reader) {
  if (!line.trim()) {
    continue;
  }

  let record;

  try {
    record = JSON.parse(line);
  } catch {
    invalidJson++;
    continue;
  }

  const payload = record?.payload;

  if (
    !payload ||
    typeof payload !== "object"
  ) {
    continue;
  }

  events++;

  const items =
    Array.isArray(payload.messages)
      ? payload.messages
      : [];

  if (items.length) {
    messageEvents++;
  }

  for (const item of items) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      continue;
    }

    messages++;

    const type =
      typeof item.type === "string"
        ? item.type
        : "unknown";

    increment(types, type);

    const direction =
      item.from_me === true
        ? "outbound"
        : item.from_me === false
          ? "inbound"
          : "unknown";

    increment(directions, direction);

    const externalId =
      typeof item.id === "string"
        ? item.id.trim()
        : typeof item.message_id === "string"
          ? item.message_id.trim()
          : "";

    if (!externalId) {
      missingIdentifiers++;
      continue;
    }

    const digest = fingerprint(
      `${companyId}\0whatsapp\0${externalId}`
    );

    unique.add(digest);

    if (!known.has(digest)) {
      candidates.add(digest);
    }
  }
}

let matchedUnique = 0;

for (const digest of unique) {
  if (known.has(digest)) {
    matchedUnique++;
  }
}

const result = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  company_id: companyId,

  source_files: {
    whatsapp_history: webhookFile,
    crm: "supabase.messages",
  },

  historical_events: events,
  historical_message_events: messageEvents,
  historical_message_entries: messages,

  historical_unique_message_ids:
    unique.size,

  crm_unique_external_ids:
    known.size,

  matched_unique_external_ids:
    matchedUnique,

  potential_unmatched_external_ids:
    candidates.size,

  entries_without_external_id:
    missingIdentifiers,

  invalid_json_lines:
    invalidJson,

  message_types:
    Object.fromEntries(types),

  directions:
    Object.fromEntries(directions),

  warning:
    "Los identificadores no coincidentes son candidatos a revisión. " +
    "No representan automáticamente mensajes perdidos.",

  automatically_recovered: 0,
  database_modified: false,
};

const target = path.join(
  outDir,
  "history-reconciliation.json",
);

fs.writeFileSync(
  target,
  JSON.stringify(result, null, 2),
  {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  },
);

console.log("====================================");
console.log("WHAPI HISTORICAL RECONCILIATION");
console.log("====================================");

console.log(
  "EVENTS:",
  events,
);

console.log(
  "MESSAGE_ENTRIES:",
  messages,
);

console.log(
  "UNIQUE_MESSAGE_IDS:",
  unique.size,
);

console.log(
  "MATCHED_WITH_CRM:",
  matchedUnique,
);

console.log(
  "POTENTIAL_UNMATCHED:",
  candidates.size,
);

console.log(
  "INVALID_JSON:",
  invalidJson,
);

console.log("");
console.log("HISTORY_RECONCILIATION_COMPLETE");
console.log("NO_DATABASE_WRITES");
console.log("NO_MESSAGE_REPLAY");
