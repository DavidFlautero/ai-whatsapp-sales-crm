import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { analyzeContactSignals } from "./role-signals.mjs";

const stage = process.argv[2];
const prefix =
  "/var/backups/eventos-commercial-memory/offline-contacts-";

if (
  !stage?.startsWith(prefix) ||
  !fs.statSync(stage).isDirectory()
) {
  throw new Error("INVALID_STAGE");
}

const { env } = await import("../../../src/config/env.ts");
const {
  supabaseRequest,
  isSupabaseConfigured,
} = await import(
  "../../../src/services/db/supabase-rest.client.ts"
);

if (!isSupabaseConfigured()) {
  throw new Error("SUPABASE_NOT_CONFIGURED");
}

const company = String(env.DEFAULT_COMPANY_ID ?? "");
if (!company) throw new Error("MISSING_COMPANY");

const previous = JSON.parse(
  fs.readFileSync(
    path.join(stage, "contact-proposals.json"),
    "utf8",
  ),
);

if (previous.company_id !== company) {
  throw new Error("COMPANY_SCOPE_MISMATCH");
}

const grouped = new Map();
const sourceIds = new Set();
const types = new Map();

let offset = 0;
let inbound = 0;
let outbound = 0;
let inboundWithBody = 0;
let messagesRead = 0;

function count(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

while (offset < 10000) {
  const query =
    `?company_id=eq.${encodeURIComponent(company)}` +
    "&channel=eq.whatsapp" +
    "&select=id,company_id,contact_id,contact_phone," +
    "direction,channel,message_type,body,occurred_at,created_at" +
    "&order=created_at.asc,id.asc" +
    `&limit=400&offset=${offset}`;

  const rows = await supabaseRequest({
    table: "messages",
    query,
  });

  if (!Array.isArray(rows)) throw new Error("INVALID_RESPONSE");

  for (const row of rows) {
    if (row.company_id !== company || row.channel !== "whatsapp") {
      throw new Error("TENANT_SCOPE_VIOLATION");
    }

    if (!row.id || sourceIds.has(row.id)) {
      throw new Error("INVALID_OR_DUPLICATE_SOURCE_ID");
    }

    sourceIds.add(row.id);
    messagesRead++;

    count(types, row.message_type ?? "unknown");

    if (row.direction === "inbound") {
      inbound++;
      if (typeof row.body === "string" && row.body.trim()) {
        inboundWithBody++;
      }
    } else if (row.direction === "outbound") {
      outbound++;
    }

    const key = row.contact_id
      ? `contact:${row.contact_id}`
      : row.contact_phone
        ? `phone:${row.contact_phone}`
        : null;

    if (!key) continue;

    if (!grouped.has(key)) grouped.set(key, []);

    grouped.get(key).push({
      id: row.id,
      body: row.body,
      direction: row.direction,
    });
  }

  offset += rows.length;
  if (rows.length < 400) break;
}

if (offset >= 10000) throw new Error("SOURCE_LIMIT_REACHED");

if (
  messagesRead !== previous.message_count ||
  grouped.size !== previous.contact_groups
) {
  throw new Error("SOURCE_SNAPSHOT_CHANGED_OR_GROUP_MISMATCH");
}

const results = [];

for (const [key, messages] of grouped) {
  const hash = createHash("sha256")
    .update(`${company}:whatsapp:${key}`)
    .digest("hex")
    .slice(0, 20);

  const analysis = analyzeContactSignals(messages);

  results.push({
    contact_fingerprint: hash,
    ...analysis,
  });
}

const distribution = {};
for (const result of results) {
  const role = result.proposed_role;
  distribution[role] = (distribution[role] ?? 0) + 1;
}

const output = {
  schema_version: 2,
  generated_at: new Date().toISOString(),
  company_id: company,
  mode: "read_only_human_review",
  messages_read: messagesRead,
  contact_groups: grouped.size,
  inbound,
  outbound,
  inbound_with_body: inboundWithBody,
  message_types: Object.fromEntries(types),
  role_distribution: distribution,
  results,
};

fs.writeFileSync(
  path.join(stage, "role-review-v2.json"),
  JSON.stringify(output, null, 2),
  { flag: "wx", mode: 0o600 },
);

console.log("MESSAGES_READ:", messagesRead);
console.log("CONTACT_GROUPS:", grouped.size);
console.log("INBOUND:", inbound);
console.log("OUTBOUND:", outbound);
console.log("INBOUND_WITH_BODY:", inboundWithBody);
console.log("ROLE_DISTRIBUTION:", distribution);
console.log("SECOND_PASS_CONTACT_REVIEW_COMPLETE");
console.log("NO_CRM_WRITES");
