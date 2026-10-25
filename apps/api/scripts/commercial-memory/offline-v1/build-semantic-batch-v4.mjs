import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const stage = fs.realpathSync(process.argv[2] ?? "");

const base = "/var/backups/eventos-commercial-memory";

if (
  path.dirname(stage) !== base ||
  !path.basename(stage).startsWith("offline-contacts-")
) {
  throw new Error("INVALID_STAGE");
}

const outputDir = path.join(stage, "v4");

const { env } = await import(
  "../../../src/config/env.ts"
);

const {
  isSupabaseConfigured,
  supabaseRequest,
} = await import(
  "../../../src/services/db/supabase-rest.client.ts"
);

if (!isSupabaseConfigured()) {
  throw new Error("SUPABASE_NOT_CONFIGURED");
}

const company = String(
  env.DEFAULT_COMPANY_ID ?? "",
).trim();

const source = JSON.parse(
  fs.readFileSync(
    path.join(stage, "source-index.json"),
    "utf8",
  ),
);

const previous = JSON.parse(
  fs.readFileSync(
    path.join(stage, "contact-dossiers-v3.json"),
    "utf8",
  ),
);

if (
  !company ||
  source.company_id !== company ||
  previous.company_id !== company
) {
  throw new Error("COMPANY_MISMATCH");
}

const sourceHashes = new Set(source.external_id_hashes);
const currentHashes = new Set();
const internalIds = new Set();
const groups = new Map();

function hash(value) {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function sanitize(text) {
  return String(text ?? "")
    .replace(/https?:\/\/\S+/gi, "[ENLACE]")
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      "[CORREO]",
    )
    .replace(
      /(?:\+?\d[\d() .-]{7,}\d)/g,
      "[NUMERO_PRIVADO]",
    )
    .replace(/\s+/g, " ")
    .slice(0, 650);
}

let total = 0;
let offset = 0;

while (offset < 10000) {
  const query =
    `?company_id=eq.${encodeURIComponent(company)}` +
    "&channel=eq.whatsapp" +
    "&select=id,company_id,contact_id,contact_phone," +
    "external_message_id,direction,channel,message_type," +
    "body,occurred_at,created_at" +
    "&order=created_at.asc,id.asc" +
    `&limit=400&offset=${offset}`;

  const rows = await supabaseRequest({
    table: "messages",
    query,
  });

  if (!Array.isArray(rows)) {
    throw new Error("INVALID_DB_RESPONSE");
  }

  for (const row of rows) {
    if (
      row.company_id !== company ||
      row.channel !== "whatsapp"
    ) {
      throw new Error("TENANT_SCOPE_VIOLATION");
    }

    if (!row.id || internalIds.has(row.id)) {
      throw new Error("DUPLICATED_SOURCE_MESSAGE");
    }

    internalIds.add(row.id);
    total++;

    if (row.external_message_id) {
      currentHashes.add(
        hash(
          `${company}\0whatsapp\0${row.external_message_id}`,
        ),
      );
    }

    const key = row.contact_id
      ? `contact:${row.contact_id}`
      : row.contact_phone
        ? `phone:${row.contact_phone}`
        : null;

    if (!key) continue;

    if (!groups.has(key)) groups.set(key, []);

    groups.get(key).push({
      message_id: row.id,
      direction: row.direction,
      message_type: row.message_type,
      occurred_at: row.occurred_at ?? row.created_at,
      text: sanitize(row.body),
    });
  }

  offset += rows.length;
  if (rows.length < 400) break;
}

if (
  offset >= 10000 ||
  total !== previous.source_message_count ||
  groups.size !== previous.source_contact_count
) {
  throw new Error("SOURCE_SNAPSHOT_CHANGED");
}

if (
  currentHashes.size !== sourceHashes.size ||
  [...sourceHashes].some(id => !currentHashes.has(id))
) {
  throw new Error("SOURCE_EXTERNAL_ID_MISMATCH");
}

const knownContacts = new Set(
  previous.dossiers.map(
    item => item.contact_fingerprint,
  ),
);

const cases = [];

for (const [key, messages] of groups) {
  const fingerprint = hash(
    `${company}:whatsapp:${key}`,
  ).slice(0, 20);

  if (!knownContacts.has(fingerprint)) {
    throw new Error("CONTACT_LINKAGE_MISMATCH");
  }

  const head = messages.slice(0, 8);
  const tail = messages.slice(-60);

  const selected = new Map();

  for (const message of [...head, ...tail]) {
    selected.set(message.message_id, message);
  }

  const selectedMessages = [...selected.values()];

  selectedMessages.sort((a, b) =>
    String(a.occurred_at).localeCompare(
      String(b.occurred_at),
    ) ||
    String(a.message_id).localeCompare(
      String(b.message_id),
    ),
  );

  cases.push({
    contact_fingerprint: fingerprint,
    total_messages: messages.length,
    selected_messages: selectedMessages.length,
    omitted_messages:
      messages.length - selectedMessages.length,
    messages: selectedMessages,
    status: "not_sent_to_ai",
  });
}

cases.sort((a, b) =>
  b.total_messages - a.total_messages,
);

const payload = {
  schema_version: 4,
  company_id: company,
  mode: "local_semantic_preparation",
  privacy: "partially_redacted_not_anonymous",
  source_messages: total,
  source_contacts: groups.size,
  external_api_calls: 0,
  cases,
};

fs.writeFileSync(
  path.join(outputDir, "semantic-batch.json"),
  JSON.stringify(payload, null, 2),
  {
    flag: "wx",
    mode: 0o600,
  },
);

console.log("SOURCE_MESSAGES:", total);
console.log("CONTACTS:", cases.length);
console.log(
  "SELECTED_MESSAGES:",
  cases.reduce(
    (sum, item) => sum + item.selected_messages,
    0,
  ),
);
console.log(
  "OMITTED_MESSAGES:",
  cases.reduce(
    (sum, item) => sum + item.omitted_messages,
    0,
  ),
);
console.log("SEMANTIC_BATCH_CREATED");
console.log("NO_EXTERNAL_AI_CALLS");
console.log("NO_DATABASE_WRITES");
