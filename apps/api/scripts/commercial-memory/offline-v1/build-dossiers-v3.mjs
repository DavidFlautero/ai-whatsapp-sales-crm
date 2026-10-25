import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import {
  makeDossierEvidence,
} from "./context-core-v3.mjs";

const stage = fs.realpathSync(process.argv[2] ?? "");

const base =
  "/var/backups/eventos-commercial-memory/";

if (
  !stage.startsWith(base + "offline-contacts-") ||
  path.dirname(stage) !== base.slice(0, -1)
) {
  throw new Error("INVALID_PRIVATE_STAGE");
}

const { env } = await import(
  "../../../src/config/env.ts"
);

const {
  supabaseRequest,
  isSupabaseConfigured,
} = await import(
  "../../../src/services/db/supabase-rest.client.ts"
);

if (!isSupabaseConfigured()) {
  throw new Error("SUPABASE_NOT_CONFIGURED");
}

const company = String(
  env.DEFAULT_COMPANY_ID ?? "",
).trim();

if (!company) {
  throw new Error("COMPANY_NOT_CONFIGURED");
}

const initial = JSON.parse(
  fs.readFileSync(
    path.join(stage, "contact-proposals.json"),
    "utf8",
  ),
);

const second = JSON.parse(
  fs.readFileSync(
    path.join(stage, "role-review-v2.json"),
    "utf8",
  ),
);

const sourceIndex = JSON.parse(
  fs.readFileSync(
    path.join(stage, "source-index.json"),
    "utf8",
  ),
);

if (
  initial.company_id !== company ||
  second.company_id !== company ||
  sourceIndex.company_id !== company
) {
  throw new Error("TENANT_SCOPE_MISMATCH");
}

const oldRoles = new Map(
  initial.proposals.map(
    (item) => [
      item.contact_fingerprint,
      item.proposed_role,
    ],
  ),
);

const secondRoles = new Map(
  second.results.map(
    (item) => [
      item.contact_fingerprint,
      item.proposed_role,
    ],
  ),
);

const originalIds = new Set(
  sourceIndex.external_id_hashes,
);

const currentIds = new Set();
const internalIds = new Set();
const groups = new Map();

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
    throw new Error("INVALID_SOURCE_RESPONSE");
  }

  for (const row of rows) {
    if (
      row.company_id !== company ||
      row.channel !== "whatsapp"
    ) {
      throw new Error("TENANT_SCOPE_VIOLATION");
    }

    if (!row.id || internalIds.has(row.id)) {
      throw new Error("DUPLICATE_INTERNAL_MESSAGE_ID");
    }

    internalIds.add(row.id);
    total++;

    if (row.external_message_id) {
      const digest = createHash("sha256")
        .update(
          `${company}\0whatsapp\0${row.external_message_id}`,
        )
        .digest("hex");

      currentIds.add(digest);
    }

    const key = row.contact_id
      ? `contact:${row.contact_id}`
      : row.contact_phone
        ? `phone:${row.contact_phone}`
        : null;

    if (!key) continue;

    if (!groups.has(key)) {
      groups.set(key, {
        contact_id: row.contact_id ?? null,
        messages: [],
      });
    }

    groups.get(key).messages.push({
      id: row.id,
      direction: row.direction,
      body: row.body ?? "",
      occurred_at: row.occurred_at,
      created_at: row.created_at,
    });
  }

  offset += rows.length;

  if (rows.length < 400) break;
}

if (
  offset >= 10000 ||
  total !== initial.message_count ||
  groups.size !== initial.contact_groups
) {
  throw new Error("SOURCE_SNAPSHOT_MISMATCH");
}

if (
  currentIds.size !== originalIds.size ||
  [...originalIds].some(
    (id) => !currentIds.has(id),
  )
) {
  throw new Error(
    "EXTERNAL_MESSAGE_SNAPSHOT_CHANGED",
  );
}

const dossiers = [];

for (const [key, group] of groups) {
  const fingerprint = createHash("sha256")
    .update(`${company}:whatsapp:${key}`)
    .digest("hex")
    .slice(0, 20);

  if (
    !oldRoles.has(fingerprint) ||
    !secondRoles.has(fingerprint)
  ) {
    throw new Error("CONTACT_LINKAGE_MISMATCH");
  }

  dossiers.push({
    contact_fingerprint: fingerprint,
    contact_id: group.contact_id,
    initial_role: oldRoles.get(fingerprint),
    second_pass_role: secondRoles.get(fingerprint),
    ...makeDossierEvidence(group.messages),
    automatically_applied: false,
  });
}

dossiers.sort((a, b) => {
  const aCount = a.evidence.length;
  const bCount = b.evidence.length;
  return bCount - aCount;
});

const categories = {};

for (const dossier of dossiers) {
  for (const [kind, count] of Object.entries(
    dossier.candidate_counts,
  )) {
    categories[kind] =
      (categories[kind] ?? 0) + count;
  }
}

const output = {
  schema_version: 3,
  company_id: company,
  generated_at: new Date().toISOString(),
  mode: "offline_human_review",
  source_message_count: total,
  source_contact_count: groups.size,
  candidate_categories: categories,
  dossiers,
  automatic_updates: 0,
  messages_sent: 0,
};

fs.writeFileSync(
  path.join(stage, "contact-dossiers-v3.json"),
  JSON.stringify(output, null, 2),
  {
    flag: "wx",
    mode: 0o600,
  },
);

console.log("SOURCE_MESSAGES:", total);
console.log("CONTACT_DOSSIERS:", dossiers.length);
console.log("CANDIDATE_CATEGORIES:", categories);
console.log("DOSSIERS_V3_CREATED");
console.log("NO_DATABASE_WRITES");
