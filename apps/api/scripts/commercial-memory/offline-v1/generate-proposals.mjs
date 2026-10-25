import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  classifyContact,
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
    "INVALID_PRIVATE_OUTPUT_DIRECTORY"
  );
}

if (!fs.existsSync(outDir)) {
  throw new Error(
    "OUTPUT_DIRECTORY_NOT_FOUND"
  );
}

const directoryInfo = fs.statSync(outDir);

if (!directoryInfo.isDirectory()) {
  throw new Error(
    "OUTPUT_PATH_IS_NOT_DIRECTORY"
  );
}

const {
  env,
} = await import(
  "../../../src/config/env.ts"
);

const {
  isSupabaseConfigured,
  supabaseRequest,
} = await import(
  "../../../src/services/db/supabase-rest.client.ts"
);

if (!isSupabaseConfigured()) {
  throw new Error(
    "SUPABASE_NOT_CONFIGURED"
  );
}

const companyId =
  String(env.DEFAULT_COMPANY_ID ?? "").trim();

if (!companyId) {
  throw new Error(
    "COMPANY_ID_NOT_CONFIGURED"
  );
}

const pageSize = 400;
const maximumMessages = 10000;

const messages = [];
const seenIds = new Set();

let offset = 0;
let pages = 0;

console.log("====================================");
console.log("COMMERCIAL_CONTACTS_OFFLINE");
console.log("====================================");

console.log("SOURCE: SUPABASE");
console.log("COMPANY:", companyId);
console.log("MODE: READ_ONLY");

while (offset < maximumMessages) {
  const query =
    `?company_id=eq.${encodeURIComponent(companyId)}` +
    "&channel=eq.whatsapp" +
    "&select=id,company_id,contact_id,contact_phone," +
    "external_message_id,direction,channel," +
    "message_type,body,occurred_at,created_at" +
    "&order=created_at.asc,id.asc" +
    `&limit=${pageSize}&offset=${offset}`;

  const rows =
    await supabaseRequest({
      table: "messages",
      query,
    });

  if (!Array.isArray(rows)) {
    throw new Error(
      "INVALID_SUPABASE_MESSAGES_RESPONSE"
    );
  }

  pages++;

  console.log(
    "PAGE",
    pages,
    "ROWS",
    rows.length,
  );

  for (const row of rows) {
    if (
      row.company_id !== companyId ||
      row.channel !== "whatsapp"
    ) {
      throw new Error(
        "TENANT_OR_CHANNEL_SCOPE_VIOLATION"
      );
    }

    if (!row.id) {
      throw new Error(
        "MESSAGE_WITHOUT_INTERNAL_ID"
      );
    }

    if (seenIds.has(row.id)) {
      throw new Error(
        "DUPLICATED_SOURCE_ROW_DURING_PAGINATION"
      );
    }

    seenIds.add(row.id);

    messages.push({
      id: row.id,
      contact_id: row.contact_id ?? null,
      contact_phone: row.contact_phone ?? "",
      external_message_id:
        row.external_message_id ?? null,
      direction: row.direction,
      channel: row.channel,
      body:
        typeof row.body === "string"
          ? row.body.slice(0, 4096)
          : "",
      message_type: row.message_type,
      occurred_at: row.occurred_at ?? null,
      created_at: row.created_at ?? null,
    });
  }

  offset += rows.length;

  if (rows.length < pageSize) {
    break;
  }
}

if (
  messages.length >= maximumMessages
) {
  throw new Error(
    "SOURCE_LIMIT_REACHED_REQUIRES_PAGINATION_REVIEW"
  );
}

if (messages.length === 0) {
  throw new Error(
    "NO_WHATSAPP_MESSAGES_FOUND"
  );
}

console.log("");
console.log("TOTAL_MESSAGES:", messages.length);

const grouped = new Map();

for (const message of messages) {
  const key = message.contact_id
    ? `contact:${message.contact_id}`
    : message.contact_phone
      ? `phone:${message.contact_phone}`
      : null;

  if (!key) {
    continue;
  }

  if (!grouped.has(key)) {
    grouped.set(key, {
      contact_id: message.contact_id,
      contact_phone: message.contact_phone,
      messages: [],
    });
  }

  grouped.get(key).messages.push(
    message,
  );
}

const proposals = [];

for (const [key, group] of grouped) {
  const analysis = classifyContact(
    group.messages,
  );

  proposals.push({
    company_id: companyId,

    contact_id:
      group.contact_id ?? null,

    contact_fingerprint:
      fingerprint(
        `${companyId}:whatsapp:${key}`
      ).slice(0, 20),

    ...analysis,

    review_status: "pending_human_review",

    automatically_applied: false,
  });
}

proposals.sort(
  (a, b) =>
    b.message_counts.total -
    a.message_counts.total
);

const externalHashes = [];

for (const message of messages) {
  if (!message.external_message_id) {
    continue;
  }

  externalHashes.push(
    fingerprint(
      `${companyId}\0whatsapp\0${message.external_message_id}`
    )
  );
}

const report = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  company_id: companyId,
  source: "supabase.messages",
  channel: "whatsapp",
  mode: "read_only_proposals",
  message_count: messages.length,
  contact_groups: grouped.size,
  proposals,
};

const sourceIndex = {
  schema_version: 1,
  company_id: companyId,
  source: "supabase.messages",
  message_count: messages.length,
  external_id_hashes: [
    ...new Set(externalHashes),
  ],
};

function writePrivate(name, value) {
  const target = path.join(
    outDir,
    name,
  );

  fs.writeFileSync(
    target,
    JSON.stringify(value, null, 2),
    {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    },
  );
}

writePrivate(
  "contact-proposals.json",
  report,
);

writePrivate(
  "source-index.json",
  sourceIndex,
);

console.log("CONTACT_GROUPS:", grouped.size);
console.log("PROPOSALS:", proposals.length);

console.log("");
console.log("CONTACT_PROPOSALS_GENERATED");
console.log("NO_CRM_CONTACTS_MODIFIED");
console.log("NO_MESSAGES_SENT");
