import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const stage = fs.realpathSync(process.argv[2] ?? "");
const base = "/var/backups/eventos-commercial-memory";

if (
  path.dirname(stage) !== base ||
  !path.basename(stage).startsWith("offline-contacts-")
) {
  throw new Error("INVALID_PRIVATE_STAGE");
}

const v4 = path.join(stage, "v4");
const v5 = path.join(stage, "v5");

const pilot = JSON.parse(
  fs.readFileSync(
    path.join(v4, "semantic-pilot-five.json"),
    "utf8",
  ),
);

const historical = JSON.parse(
  fs.readFileSync(
    path.join(stage, "source-index.json"),
    "utf8",
  ),
);

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

if (
  !company ||
  company !== pilot.company_id ||
  company !== historical.company_id
) {
  throw new Error("COMPANY_MISMATCH");
}

function digest(value) {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function sanitize(value) {
  return String(value ?? "")
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
    .slice(0, 1500);
}

const wanted = new Set(
  pilot.cases.map(item => item.contact_fingerprint),
);

if (
  wanted.size !== 5 ||
  pilot.cases.length !== 5
) {
  throw new Error("INVALID_PILOT_SELECTION");
}

const groups = new Map();
const internalIds = new Set();
const externalHashes = new Set();

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
    throw new Error("INVALID_SUPABASE_RESPONSE");
  }

  for (const row of rows) {
    if (
      row.company_id !== company ||
      row.channel !== "whatsapp" ||
      !row.id ||
      internalIds.has(row.id)
    ) {
      throw new Error("INVALID_SOURCE_ROW");
    }

    internalIds.add(row.id);
    total++;

    if (row.external_message_id) {
      externalHashes.add(
        digest(
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

    const contactHash = digest(
      `${company}:whatsapp:${key}`,
    ).slice(0, 20);

    if (!wanted.has(contactHash)) {
      continue;
    }

    if (!groups.has(contactHash)) {
      groups.set(contactHash, []);
    }

    groups.get(contactHash).push({
      message_id: String(row.id),
      direction: row.direction,
      message_type: row.message_type,
      occurred_at:
        row.occurred_at ?? row.created_at,
      text: sanitize(row.body),
    });
  }

  offset += rows.length;

  if (rows.length < 400) break;
}

if (offset >= 10000 || total !== 2115) {
  throw new Error("SOURCE_SNAPSHOT_CHANGED");
}

const knownExternal = new Set(
  historical.external_id_hashes,
);

if (
  externalHashes.size !== knownExternal.size ||
  [...knownExternal].some(
    hash => !externalHashes.has(hash),
  )
) {
  throw new Error("EXTERNAL_ID_SNAPSHOT_CHANGED");
}

const cases = [];

for (const selected of pilot.cases) {
  const messages = groups.get(
    selected.contact_fingerprint,
  );

  if (!messages) {
    throw new Error("SELECTED_CONTACT_MISSING");
  }

  if (messages.length !== selected.total_messages) {
    throw new Error("CONTACT_MESSAGE_COUNT_CHANGED");
  }

  messages.sort(
    (a, b) =>
      String(a.occurred_at).localeCompare(
        String(b.occurred_at),
      ) ||
      a.message_id.localeCompare(b.message_id),
  );

  const messageIds = new Set(
    messages.map(item => item.message_id),
  );

  if (
    selected.messages.some(
      item => !messageIds.has(item.message_id),
    )
  ) {
    throw new Error("PILOT_MESSAGE_LINKAGE_MISMATCH");
  }

  cases.push({
    contact_fingerprint: selected.contact_fingerprint,
    total_messages: messages.length,
    selected_messages: messages.length,
    omitted_messages: 0,
    messages,
    status: "offline_review_only",
    external_transfer_approved: false,
  });
}

const output = {
  schema_version: 5,
  company_id: company,
  source_messages_checked: total,
  case_count: cases.length,
  privacy: "partially_redacted_not_anonymous",
  external_ai_calls: 0,
  cases,
};

fs.writeFileSync(
  path.join(v5, "semantic-pilot-full.json"),
  JSON.stringify(output, null, 2),
  {
    mode: 0o600,
    flag: "wx",
  },
);

console.log("SOURCE_MESSAGES_CHECKED:", total);
console.log("PILOT_CASES:", cases.length);
console.log(
  "PILOT_FULL_MESSAGES:",
  cases.reduce(
    (sum, item) => sum + item.messages.length,
    0,
  ),
);
console.log("OMITTED_PILOT_MESSAGES:", 0);
console.log("FULL_PILOT_READY");
console.log("NO_EXTERNAL_AI_CALLS");
console.log("NO_DATABASE_WRITES");
