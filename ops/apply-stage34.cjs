const fs = require("node:fs");

const rawUrl =
  process.env.SUPABASE_URL ||
  process.env.SUPABASE_REST_URL ||
  process.env.SUPABASE_API_URL;

const token = process.env.SUPABASE_ACCESS_TOKEN;

async function main() {
  if (!rawUrl || !token) {
    throw new Error("SUPABASE_URL_OR_ACCESS_TOKEN_MISSING");
  }

  const host = new URL(rawUrl).hostname;

  if (!/^[a-z0-9-]+\.supabase\.co$/.test(host)) {
    throw new Error("INVALID_SUPABASE_HOST");
  }

  const ref = host.split(".")[0];

  const endpoint =
    `https://api.supabase.com/v1/projects/${ref}/database/query`;

  async function sql(query) {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(90000),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    const body = await response.text();

    if (!response.ok) {
      throw new Error(
        `SQL_HTTP_${response.status}:${body.slice(0, 300)}`
      );
    }

    return body ? JSON.parse(body) : [];
  }

  async function exists(table) {
    const result = await sql(
      `SELECT to_regclass('public.${table}') IS NOT NULL AS present`
    );

    return result?.[0]?.present === true;
  }

  const migrations = [
    {
      path:
        "supabase/migrations/20261014123000_cm_bridge_v2.sql",
      main: "cm_bridge_candidates",
      secondary: "cm_operation_partners",
    },
    {
      path:
        "supabase/migrations/20261014124000_cm_intelligence_v2.sql",
      main: "cm_intel_observations",
      secondary: "cm_intel_tasks",
    },
  ];

  for (const migration of migrations) {
    const mainPresent = await exists(migration.main);
    const secondaryPresent = await exists(
      migration.secondary,
    );

    if (mainPresent !== secondaryPresent) {
      throw new Error(
        `PARTIAL_SCHEMA:${migration.main}`,
      );
    }

    if (mainPresent) {
      console.log(
        "YA EXISTE:",
        migration.main,
      );
      continue;
    }

    const query = fs.readFileSync(
      migration.path,
      "utf8",
    ).trim();

    if (
      query.length < 1000 ||
      !query.startsWith("BEGIN;") ||
      !query.endsWith("COMMIT;")
    ) {
      throw new Error(
        `INVALID_MIGRATION:${migration.path}`,
      );
    }

    console.log("APLICANDO:", migration.path);

    await sql(query);

    if (
      !await exists(migration.main) ||
      !await exists(migration.secondary)
    ) {
      throw new Error(
        `MIGRATION_VERIFICATION_FAILED:${migration.path}`,
      );
    }

    console.log("OK:", migration.path);
  }

  await sql(
    "NOTIFY pgrst, 'reload schema';"
  );

  console.log("CM_STAGE34_MIGRATIONS_COMPLETE");
}

main().catch(error => {
  console.error(
    "CM_STAGE34_MIGRATION_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
