import {
  supabaseRequest,
} from "../services/db/supabase-rest.client.js";

import {
  readIntegrationSecrets,
} from "../services/integrations/integration-secrets.repository.js";

type Row =
  Record<string, any>;

const COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID;

if (!COMPANY_ID) {
  throw new Error(
    "DEFAULT_COMPANY_ID_NOT_SET",
  );
}

function enc(
  value: string,
) {
  return encodeURIComponent(
    value,
  );
}

async function hydrate() {
  const integrations =
    await readIntegrationSecrets();

  const url =
    integrations.supabase.url?.trim();

  const key =
    integrations.supabase
      .serviceRoleKey?.trim();

  if (!url || !key) {
    throw new Error(
      "SUPABASE_NOT_CONFIGURED",
    );
  }

  process.env.SUPABASE_URL =
    process.env.SUPABASE_URL || url;

  process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY
    || key;
}

async function getVenues() {
  return await supabaseRequest<Row[]>({
    table:
      "crm_venues",

    query:
      `?company_id=eq.${enc(
        COMPANY_ID!,
      )}`
      + "&select=*",
  });
}

async function getHistory(
  venueId: string,
) {
  return await supabaseRequest<Row[]>({
    table:
      "crm_entity_history",

    query:
      `?company_id=eq.${enc(
        COMPANY_ID!,
      )}`
      + `&venue_id=eq.${enc(
        venueId,
      )}`
      + "&select=id"
      + "&limit=1",
  });
}

async function getProvider(
  providerId: string | null,
) {
  if (!providerId) {
    return null;
  }

  const rows =
    await supabaseRequest<Row[]>({
      table:
        "crm_providers",

      query:
        `?id=eq.${enc(
          providerId,
        )}`
        + "&select=*"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}

async function getProfile(
  providerId: string | null,
) {
  if (!providerId) {
    return null;
  }

  const rows =
    await supabaseRequest<Row[]>({
      table:
        "crm_provider_profiles",

      query:
        `?company_id=eq.${enc(
          COMPANY_ID!,
        )}`
        + `&provider_id=eq.${enc(
          providerId,
        )}`
        + "&select=*"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}

async function addBaseline(
  venue: Row,
) {
  const venueId =
    String(
      venue.id,
    );

  const existing =
    await getHistory(
      venueId,
    );

  if (existing.length) {
    console.log(
      "[SKIP HAS HISTORY]",
      venue.name,
    );

    return false;
  }

  const providerId =
    venue.provider_id
      ? String(
          venue.provider_id,
        )
      : null;

  const provider =
    await getProvider(
      providerId,
    );

  const profile =
    await getProfile(
      providerId,
    );

  const sourceMetadata =
    profile?.source_metadata
    ?? {};

  const sourceId =
    sourceMetadata.folder_id
    ?? sourceMetadata.source_id
    ?? sourceMetadata.primary_document_id
    ?? null;

  const sourceName =
    sourceMetadata.source_name
    ?? provider?.name
    ?? "Google Drive";

  const sourcePath =
    sourceMetadata.source_path
    ?? `1-CHALETS / ${provider?.name ?? venue.name}`;

  await supabaseRequest({
    table:
      "crm_entity_history",

    method:
      "POST",

    body: {
      company_id:
        COMPANY_ID,

      entity_type:
        "venue",

      provider_id:
        providerId,

      venue_id:
        venueId,

      event_id:
        null,

      occurred_at:
        null,

      occurred_on:
        null,

      history_type:
        "migration_snapshot",

      title:
        `Estado inicial migrado — ${venue.name}`,

      description:
        "Snapshot creado durante la migración integral de Google Drive para preservar el estado inicial del espacio antes del enriquecimiento histórico completo.",

      old_value:
        null,

      new_value: {
        name:
          venue.name ?? null,

        slug:
          venue.slug ?? null,

        city:
          venue.city ?? null,

        province:
          venue.province ?? null,

        address:
          venue.address ?? null,

        capacity_min:
          venue.capacity_min ?? null,

        capacity_max:
          venue.capacity_max ?? null,

        max_event_guests:
          venue.max_event_guests ?? null,

        max_sleeping_guests:
          venue.max_sleeping_guests ?? null,

        cost_from:
          venue.cost_from ?? null,

        client_price_from:
          venue.client_price_from ?? null,

        status:
          venue.status ?? null,

        events_allowed:
          venue.events_allowed ?? null,

        parties_allowed:
          venue.parties_allowed ?? null,

        owner:
          provider?.name ?? null,

        provider_profile:
          profile?.factual_summary ?? null,

        source_metadata:
          sourceMetadata,
      },

      source:
        "google-drive",

      source_file_id:
        sourceId,

      source_file_name:
        sourceName,

      source_folder_id:
        sourceMetadata.folder_id
        ?? null,

      source_folder_path:
        sourcePath,

      source_modified_at:
        null,

      confidence:
        "derived",

      metadata: {
        migration_batch:
          12,

        snapshot:
          true,

        requires_deep_history_scan:
          true,
      },
    },
  });

  console.log(
    "[BASELINE CREATED]",
    venue.name,
    "source=",
    sourceId ?? "NO_SOURCE_ID",
  );

  return true;
}

async function main() {
  await hydrate();

  console.log(
    "==============================================",
  );

  console.log(
    "VENUE BASELINE BATCH 12",
  );

  console.log(
    "==============================================",
  );

  const venues =
    await getVenues();

  let created = 0;
  let skipped = 0;

  for (const venue of venues) {
    const result =
      await addBaseline(
        venue,
      );

    if (result) {
      created++;
    } else {
      skipped++;
    }
  }

  console.log({
    venues:
      venues.length,

    baseline_created:
      created,

    already_had_history:
      skipped,
  });

  console.log(
    "==============================================",
  );

  console.log(
    "BATCH_12_COMPLETE",
  );

  console.log(
    "==============================================",
  );
}

main().catch(
  error => {
    console.error(
      "BATCH_12_FAILED",
      error,
    );

    process.exitCode = 1;
  },
);
