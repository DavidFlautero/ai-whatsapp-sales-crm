import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import {
  phoneToken,
} from "./identity-match-core-v7.mjs";

const stage = fs.realpathSync(
  process.argv[2] ?? "",
);

const base =
  "/var/backups/eventos-commercial-memory";

if (
  path.dirname(stage) !== base ||
  !path.basename(stage).startsWith("offline-contacts-")
) {
  throw new Error("INVALID_STAGE");
}

const v7 = path.join(stage, "v7");

const secret = fs.readFileSync(
  path.join(v7, "identity-hmac.key"),
);

if (secret.length !== 32) {
  throw new Error("INVALID_HMAC_KEY");
}

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

const dossiers = JSON.parse(
  fs.readFileSync(
    path.join(stage, "contact-dossiers-v3.json"),
    "utf8",
  ),
);

const index = JSON.parse(
  fs.readFileSync(
    path.join(stage, "source-index.json"),
    "utf8",
  ),
);

if (
  dossiers.company_id !== company ||
  index.company_id !== company
) {
  throw new Error("TENANT_SCOPE_MISMATCH");
}

const groups = new Map();

const ids = new Set();
const externalHashes = new Set();

let total = 0;
let offset = 0;

function digest(value) {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

while (offset < 10000) {
  const query =
    `?company_id=eq.${encodeURIComponent(company)}` +
    "&channel=eq.whatsapp" +
    "&select=id,company_id,contact_id,contact_phone," +
    "external_message_id,channel,created_at" +
    "&order=created_at.asc,id.asc" +
    `&limit=400&offset=${offset}`;

  const rows = await supabaseRequest({
    table: "messages",
    query,
  });

  if (!Array.isArray(rows)) {
    throw new Error("INVALID_MESSAGES_RESPONSE");
  }

  for (const row of rows) {
    if (
      row.company_id !== company ||
      row.channel !== "whatsapp"
    ) {
      throw new Error("SOURCE_TENANT_VIOLATION");
    }

    if (!row.id || ids.has(row.id)) {
      throw new Error("DUPLICATE_SOURCE_MESSAGE");
    }

    ids.add(row.id);
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

    if (!key) {
      continue;
    }

    const fingerprint = digest(
      `${company}:whatsapp:${key}`,
    ).slice(0, 20);

    if (!groups.has(fingerprint)) {
      groups.set(fingerprint, {
        fingerprint,
        contact_ids: new Set(),
        phone_tokens: new Set(),
        source_message_count: 0,
      });
    }

    const group = groups.get(fingerprint);

    group.source_message_count++;

    if (row.contact_id) {
      group.contact_ids.add(
        String(row.contact_id),
      );
    }

    if (row.contact_phone) {
      const token = phoneToken(
        secret,
        company,
        row.contact_phone,
      );

      if (token) {
        group.phone_tokens.add(token);
      }
    }
  }

  offset += rows.length;

  if (rows.length < 400) {
    break;
  }
}

if (
  offset >= 10000 ||
  total !== dossiers.source_message_count ||
  groups.size !== dossiers.source_contact_count
) {
  throw new Error("SOURCE_SNAPSHOT_CHANGED");
}

const expectedHashes = new Set(
  index.external_id_hashes,
);

if (
  externalHashes.size !== expectedHashes.size ||
  [...expectedHashes].some(
    hash => !externalHashes.has(hash),
  )
) {
  throw new Error("MESSAGE_IDENTIFIERS_CHANGED");
}

const dossierById = new Map(
  dossiers.dossiers.map(
    item => [
      item.contact_fingerprint,
      item,
    ],
  ),
);

const anchors = [];

for (const group of groups.values()) {
  const original = dossierById.get(
    group.fingerprint,
  );

  if (!original) {
    throw new Error("DOSSIER_NOT_FOUND");
  }

  if (
    original.source_message_count !==
    group.source_message_count
  ) {
    throw new Error("CONTACT_HISTORY_CHANGED");
  }

  if (group.contact_ids.size > 1) {
    throw new Error(
      "MULTIPLE_CONTACT_IDS_IN_ONE_GROUP",
    );
  }

  anchors.push({
    fingerprint: group.fingerprint,
    contact_id:
      [...group.contact_ids][0] ?? null,
    phone_tokens:
      [...group.phone_tokens].sort(),
    source_message_count:
      group.source_message_count,
  });
}

anchors.sort((a, b) =>
  a.fingerprint.localeCompare(
    b.fingerprint,
  ),
);

const output = {
  schema_version: 7,
  company_id: company,
  mode: "read_only_source_anchors",
  source_messages: total,
  contact_groups: anchors.length,
  anchors,
  database_writes: 0,
};

fs.writeFileSync(
  path.join(v7, "contact-anchors.json"),
  JSON.stringify(output, null, 2),
  {
    flag: "wx",
    mode: 0o600,
  },
);

console.log("SOURCE_MESSAGES:", total);
console.log("CONTACT_GROUPS:", anchors.length);

console.log(
  "WITH_INTERNAL_CONTACT_ID:",
  anchors.filter(
    item => Boolean(item.contact_id),
  ).length,
);

console.log(
  "WITH_PHONE_REFERENCE:",
  anchors.filter(
    item => item.phone_tokens.length > 0,
  ).length,
);

console.log("CONTACT_ANCHORS_CREATED");
console.log("NO_PHONE_NUMBERS_EXPORTED");
console.log("NO_CRM_WRITES");
