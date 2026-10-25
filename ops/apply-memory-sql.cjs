const fs = require("node:fs");

const rawUrl =
  process.env.SUPABASE_URL ||
  process.env.SUPABASE_REST_URL ||
  process.env.SUPABASE_API_URL;

const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!rawUrl || !token) {
  console.error("ERROR: URL O TOKEN AUSENTE");
  process.exitCode = 1;
} else {
  void main();
}

async function main() {
  try {
    const host = new URL(rawUrl).hostname;

    if (!/^[a-z0-9-]+\.supabase\.co$/.test(host)) {
      throw Error("DOMINIO SUPABASE NO RECONOCIDO");
    }

    const ref = host.split(".")[0];
    const endpoint =
      `https://api.supabase.com/v1/projects/${ref}/database/query`;

    async function sql(query) {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(60000),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      const body = await response.text();

      if (!response.ok) {
        throw Error(
          `SQL HTTP ${response.status}: ${body.slice(0, 350)}`
        );
      }

      return body ? JSON.parse(body) : [];
    }

    async function state() {
      const rows = await sql(`
        SELECT
          to_regclass('public.crm_memory_identities')
            IS NOT NULL AS identities,
          to_regclass('public.crm_memory_cases')
            IS NOT NULL AS cases,
          to_regprocedure(
            'public.cm_memory_try_lease(text,uuid,integer)'
          ) IS NOT NULL AS lease
      `);

      if (!Array.isArray(rows) || !rows[0]) {
        throw Error("RESPUESTA SQL INESPERADA");
      }

      return rows[0];
    }

    async function apply(filename) {
      const query = fs.readFileSync(
        filename,
        "utf8",
      ).trim();

      if (
        query.length < 1000 ||
        !query.startsWith("BEGIN;") ||
        !query.endsWith("COMMIT;")
      ) {
        throw Error(`ARCHIVO SQL INCOMPLETO: ${filename}`);
      }

      console.log("APLICANDO:", filename);

      await sql(query);

      console.log("OK: MIGRACION APLICADA");
    }

    let current = await state();

    if (!current.identities) {
      await apply(
        "supabase/migrations/20261014120000_crm_memory_identity.sql"
      );
    } else {
      console.log("OK: IDENTIDADES YA EXISTEN");
    }

    current = await state();

    if (!current.identities) {
      throw Error("IDENTIDADES NO CREADAS");
    }

    if (current.cases !== current.lease) {
      throw Error("ESQUEMA PARCIAL: REQUIERE CORRECCION");
    }

    if (!current.cases) {
      await apply(
        "supabase/migrations/20261014121000_crm_memory_operations.sql"
      );
    } else {
      console.log("OK: EXPEDIENTES YA EXISTEN");
    }

    current = await state();

    if (
      !current.identities ||
      !current.cases ||
      !current.lease
    ) {
      throw Error("ESQUEMA INCOMPLETO");
    }

    await sql(
      "NOTIFY pgrst, 'reload schema';"
    );

    console.log("=== MIGRACIONES COMPLETADAS ===");
  } catch (error) {
    console.error("ERROR:", error.message);
    process.exitCode = 1;
  }
}
