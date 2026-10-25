import fs from "node:fs";
import path from "node:path";

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
  throw new Error("INVALID_PRIVATE_STAGE");
}

const v7 = path.join(stage, "v7");

function load(name) {
  return JSON.parse(
    fs.readFileSync(
      path.join(v7, name),
      "utf8",
    ),
  );
}

const manifest = load("manifest.json");
const discovery = load("contact-schema.json");
const anchors = load("contact-anchors.json");

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

if (
  !company ||
  company !== manifest.company_id ||
  company !== discovery.company_id ||
  company !== anchors.company_id
) {
  throw new Error("COMPANY_SCOPE_MISMATCH");
}

if (
  anchors.contact_groups !== 95 ||
  anchors.source_messages !== 2115
) {
  throw new Error("HISTORICAL_BASELINE_CHANGED");
}

const allowedTables = new Set([
  "crm_contacts",
  "crm_memory_identities",
]);

const tables = discovery.tables.filter(
  item => item.usable && allowedTables.has(item.table),
);

if (tables.length !== 2) {
  throw new Error("EXPECTED_CONTACT_TABLES_NOT_FOUND");
}

const records = [];
const tableCounts = {};

for (const info of tables) {
  const table = info.table;

  const columns = [
    "id",
    "company_id",
    ...info.phone_columns,
  ];

  const selected = [...new Set(columns)];

  for (const column of selected) {
    if (!/^[a-z][a-z0-9_]*$/.test(column)) {
      throw new Error("UNSAFE_COLUMN_NAME");
    }
  }

  let count = 0;
  let completed = false;

  for (let offset = 0; offset < 6000; offset += 250) {
    const query =
      `?company_id=eq.${encodeURIComponent(company)}` +
      `&select=${selected.join(",")}` +
      "&order=id.asc" +
      `&limit=250&offset=${offset}`;

    const rows = await supabaseRequest({
      table,
      query,
    });

    if (!Array.isArray(rows)) {
      throw new Error("INVALID_DATABASE_RESPONSE");
    }

    for (const row of rows) {
      if (row.company_id !== company) {
        throw new Error("CROSS_TENANT_RECORD");
      }

      if (
        row.id === null ||
        row.id === undefined ||
        String(row.id).length === 0
      ) {
        throw new Error("RECORD_WITHOUT_ID");
      }

      const tokens = new Set();

      for (const column of info.phone_columns) {
        const token = phoneToken(
          secret,
          company,
          row[column],
        );

        if (token) {
          tokens.add(token);
        }
      }

      records.push({
        table,
        id: String(row.id),
        phone_tokens: [...tokens].sort(),
      });

      count++;
    }

    if (rows.length < 250) {
      completed = true;
      break;
    }
  }

  if (!completed) {
    throw new Error(`TABLE_READ_LIMIT_${table}`);
  }

  tableCounts[table] = count;

  console.log(
    "OFFICIAL_TABLE:",
    table,
    "RECORDS:",
    count,
  );
}

const identifiers = new Set();

for (const row of records) {
  const key = `${row.table}\0${row.id}`;

  if (identifiers.has(key)) {
    throw new Error("DUPLICATE_OFFICIAL_ID");
  }

  identifiers.add(key);
}

const result = {
  schema_version: 7,
  company_id: company,
  mode: "read_only_official_registry",
  generated_at: new Date().toISOString(),
  table_counts: tableCounts,
  total_records: records.length,
  records,
  database_writes: 0,
};

const target = path.join(
  v7,
  "official-contact-registry.json",
);

fs.writeFileSync(
  target,
  JSON.stringify(result, null, 2),
  {
    flag: "wx",
    mode: 0o600,
  },
);

console.log("");
console.log("OFFICIAL_RECORDS:", records.length);
console.log("TABLES_READ:", tables.length);
console.log("OFFICIAL_CONTACT_REGISTRY_READY");
console.log("NO_PLAIN_PHONE_NUMBERS_SAVED");
console.log("NO_DATABASE_WRITES");
