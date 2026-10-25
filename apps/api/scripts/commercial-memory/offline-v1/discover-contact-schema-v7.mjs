import fs from "node:fs";
import path from "node:path";

const stage = fs.realpathSync(process.argv[2] ?? "");

const base = "/var/backups/eventos-commercial-memory";

if (
  path.dirname(stage) !== base ||
  !path.basename(stage).startsWith("offline-contacts-")
) {
  throw new Error("INVALID_PRIVATE_STAGE");
}

const manifest = JSON.parse(
  fs.readFileSync(
    path.join(stage, "v7", "manifest.json"),
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

if (!company || manifest.company_id !== company) {
  throw new Error("COMPANY_SCOPE_MISMATCH");
}

const tables = [
  "contacts",
  "customers",
  "crm_contacts",
  "crm_customers",
  "crm_memory_identities",
  "crm_leads",
  "crm_clients",
  "clientes",
];

const phoneCandidates = [
  "phone",
  "phone_number",
  "contact_phone",
  "primary_phone",
  "whatsapp_phone",
  "whatsapp",
  "mobile",
  "mobile_phone",
  "normalized_phone",
  "telefono",
  "telephone",
];

const results = [];

console.log("====================================");
console.log("SUPABASE CONTACT SCHEMA DISCOVERY");
console.log("====================================");

for (const table of tables) {
  try {
    const query =
      `?company_id=eq.${encodeURIComponent(company)}` +
      "&select=*" +
      "&limit=1";

    const rows = await supabaseRequest({
      table,
      query,
    });

    if (!Array.isArray(rows)) {
      throw new Error("INVALID_RESPONSE");
    }

    if (rows.length === 0) {
      results.push({
        table,
        status: "empty_or_no_visible_rows",
        columns: [],
        phone_columns: [],
        usable: false,
      });

      console.log("TABLE:", table, "EMPTY");
      continue;
    }

    const row = rows[0];

    if (
      !row ||
      typeof row !== "object" ||
      Array.isArray(row)
    ) {
      throw new Error("INVALID_ROW");
    }

    if (row.company_id !== company) {
      throw new Error("TENANT_SCOPE_VIOLATION");
    }

    const columns = Object.keys(row).sort();

    const phoneColumns = phoneCandidates.filter(
      column => columns.includes(column),
    );

    const usable =
      columns.includes("id") &&
      columns.includes("company_id");

    results.push({
      table,
      status: "available",
      columns,
      phone_columns: phoneColumns,
      usable,
    });

    console.log("");
    console.log("TABLE:", table);
    console.log("STATUS: AVAILABLE");
    console.log("COLUMNS:", columns.join(", "));
    console.log("PHONE_COLUMNS:", phoneColumns.join(", ") || "none");

  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "TENANT_SCOPE_VIOLATION"
    ) {
      throw error;
    }

    results.push({
      table,
      status: "query_unavailable",
      columns: [],
      phone_columns: [],
      usable: false,
    });

    console.log("TABLE:", table, "QUERY_UNAVAILABLE");
  }
}

const usableCount = results.filter(
  item => item.usable,
).length;

const output = {
  schema_version: 7,
  company_id: company,
  mode: "read_only_schema_discovery",
  tables: results,
  usable_tables: usableCount,
  database_writes: 0,
};

const destination = path.join(
  stage,
  "v7",
  "contact-schema.json",
);

fs.writeFileSync(
  destination,
  JSON.stringify(output, null, 2),
  {
    flag: "wx",
    mode: 0o600,
  },
);

console.log("");
console.log("====================================");
console.log("USABLE_TABLES:", usableCount);
console.log("CONTACT_SCHEMA_DISCOVERED");
console.log("NO_DATABASE_WRITES");
console.log("====================================");
