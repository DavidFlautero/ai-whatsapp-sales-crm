import {
  supabaseRequest,
} from "../services/db/supabase-rest.client.js";

import {
  readIntegrationSecrets,
} from "../services/integrations/integration-secrets.repository.js";

type Row =
  Record<string, unknown>;

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

async function hydrateSupabaseRuntime() {
  const integrations =
    await readIntegrationSecrets();

  const url =
    integrations.supabase.url?.trim();

  const key =
    integrations.supabase.serviceRoleKey?.trim();

  if (
    !url
    || !key
  ) {
    throw new Error(
      "SUPABASE_INTEGRATION_NOT_CONFIGURED",
    );
  }

  process.env.SUPABASE_URL =
    process.env.SUPABASE_URL
    || url;

  process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY
    || key;

  console.log(
    "[RUNTIME] Supabase integration loaded",
  );
}

async function providerByPhone(
  phone: string,
) {
  const rows =
    await supabaseRequest<Row[]>({
      table:
        "crm_providers",
      query:
        `?company_id=eq.${enc(
          COMPANY_ID!,
        )}`
        + `&phone=eq.${enc(
          phone,
        )}`
        + "&select=*"
        + "&limit=1",
    });

  if (!rows[0]) {
    throw new Error(
      `PROVIDER_NOT_FOUND:${phone}`,
    );
  }

  return rows[0];
}

async function venueBySlug(
  slug: string,
) {
  const rows =
    await supabaseRequest<Row[]>({
      table:
        "crm_venues",
      query:
        `?company_id=eq.${enc(
          COMPANY_ID!,
        )}`
        + `&slug=eq.${enc(
          slug,
        )}`
        + "&select=*"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}

async function upsertVenue(
  providerId: string,
) {
  const slug =
    "chalet-nuria-castellon";

  const existing =
    await venueBySlug(
      slug,
    );

  const body = {
    company_id:
      COMPANY_ID,
    provider_id:
      providerId,

    name:
      "Chalet Nuria Castellón",

    slug,

    status:
      "draft",

    description:
      "Casa vacacional en Castellón / zona El Grao, próxima a la playa. Apta para eventos de día de 20 a 50 personas y alojamiento de hasta 10 personas. Alquiler principalmente por semanas, con un máximo indicado de 10 días.",

    province:
      "Castellón",

    city:
      "Castellón de la Plana",

    address:
      "Zona El Grao / El Grau de Castelló",

    capacity_min:
      20,

    capacity_max:
      50,

    max_event_guests:
      50,

    max_sleeping_guests:
      10,

    cost_from:
      650,

    client_price_from:
      1000,

    currency:
      "EUR",

    features: [
      "Piscina privada",
      "Gimnasio",
      "Barbacoa",
      "Cocina equipada",
      "3 habitaciones",
      "Baños",
      "Salón",
      "Televisión",
      "Mesas",
      "Sillas",
      "Pérgola exterior",
      "Baño exterior",
      "Zona exterior",
      "Propiedad amueblada",
    ],

    rental_modes: [
      "day",
      "overnight",
      "week",
      "multi_day",
      "event",
    ],

    included_services: [],

    suitable_for: [
      "Reuniones",
      "Escapadas",
      "Eventos privados",
      "Estancias vacacionales",
    ],

    event_types_allowed: [],

    events_allowed:
      true,

    parties_allowed:
      true,
  };

  if (existing) {
    const rows =
      await supabaseRequest<Row[]>({
        table:
          "crm_venues",
        method:
          "PATCH",
        query:
          `?company_id=eq.${enc(
            COMPANY_ID!,
          )}`
          + `&id=eq.${enc(
            String(
              existing.id,
            ),
          )}`,
        body,
      });

    console.log(
      "[VENUE UPDATED] Chalet Nuria Castellón",
    );

    return rows[0]
      ?? existing;
  }

  const rows =
    await supabaseRequest<Row[]>({
      table:
        "crm_venues",
      method:
        "POST",
      body,
    });

  if (!rows[0]) {
    throw new Error(
      "NURIA_VENUE_CREATE_FAILED",
    );
  }

  console.log(
    "[VENUE CREATED] Chalet Nuria Castellón",
  );

  return rows[0];
}

async function addHistory(
  input: {
    venueId: string;
    historyType: string;
    title: string;
    description: string;
    sourceFileId: string;
    sourceFileName: string;
    sourceModifiedAt?: string | null;
    confidence?:
      | "source"
      | "derived"
      | "unverified"
      | "conflict";
    newValue?: unknown;
    oldValue?: unknown;
  },
) {
  const existing =
    await supabaseRequest<Row[]>({
      table:
        "crm_entity_history",
      query:
        `?company_id=eq.${enc(
          COMPANY_ID!,
        )}`
        + "&entity_type=eq.venue"
        + `&source_file_id=eq.${enc(
          input.sourceFileId,
        )}`
        + `&history_type=eq.${enc(
          input.historyType,
        )}`
        + `&title=eq.${enc(
          input.title,
        )}`
        + "&select=id"
        + "&limit=1",
    });

  if (existing[0]) {
    console.log(
      "[HISTORY EXISTS]",
      input.title,
    );

    return;
  }

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
        null,

      venue_id:
        input.venueId,

      event_id:
        null,

      occurred_at:
        null,

      occurred_on:
        null,

      history_type:
        input.historyType,

      title:
        input.title,

      description:
        input.description,

      old_value:
        input.oldValue
        ?? null,

      new_value:
        input.newValue
        ?? null,

      source:
        "google-drive",

      source_file_id:
        input.sourceFileId,

      source_file_name:
        input.sourceFileName,

      source_folder_id:
        "1sCKIrEUWYHbV_DubBNGmhYjzQwdUON2D",

      source_folder_path:
        "1-CHALETS / 2. ALQUILER POR DIA / 4-NURIA DUEÑA VILLA CASTELLÓN",

      source_modified_at:
        input.sourceModifiedAt
        ?? null,

      confidence:
        input.confidence
        ?? "source",

      metadata: {},
    },
  });

  console.log(
    "[HISTORY ADDED]",
    input.title,
  );
}

async function updateProviderProfile(
  providerId: string,
) {
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

  const body = {
    factual_summary:
      "Nuria figura como propietaria de un chalet/casa vacacional en Castellón, zona El Grao, destinado a alojamiento y eventos privados.",

    commercial_relationship:
      "Propietaria histórica vinculada a Eventos Mediterráneo",

    commercial_conditions: {
      full_house_per_night:
        1000,

      exterior_day:
        650,

      booking_percentage:
        20,

      exterior_deposit:
        400,

      interior_deposit:
        800,

      max_event_guests:
        50,

      max_sleeping_guests:
        10,

      rental_period:
        "semanal",

      maximum_days:
        10,

      music:
        "moderada por vecinos próximos",
    },

    known_preferences: [
      "Música moderada por proximidad de vecinos",
      "Reserva mediante anticipo del 20%",
    ],

    service_categories: [
      "venue_owner",
      "accommodation",
      "events",
    ],

    factual_notes:
      "Teléfono registrado: +34 644 64 27 28. Existen valores alternativos dentro del mismo documento; se conservan como conflicto histórico.",

    source_metadata: {
      source:
        "google-drive",

      folder_id:
        "1sCKIrEUWYHbV_DubBNGmhYjzQwdUON2D",

      document_id:
        "1H1hnJa1Mbzhn2Mq-hgoUo_X2TjPpe2peQdbLhC0marU",
    },
  };

  if (!rows[0]) {
    await supabaseRequest({
      table:
        "crm_provider_profiles",
      method:
        "POST",
      body: {
        company_id:
          COMPANY_ID,

        provider_id:
          providerId,

        provider_type:
          "owner",

        ...body,
      },
    });

    console.log(
      "[PROFILE CREATED] Nuria",
    );

    return;
  }

  await supabaseRequest({
    table:
      "crm_provider_profiles",
    method:
      "PATCH",
    query:
      `?id=eq.${enc(
        String(
          rows[0].id,
        ),
      )}`,
    body,
  });

  console.log(
    "[PROFILE UPDATED] Nuria",
  );
}

async function main() {
  await hydrateSupabaseRuntime();

  console.log(
    "==============================================",
  );

  console.log(
    "DRIVE ENRICHMENT BATCH 4",
  );

  console.log(
    "==============================================",
  );

  const provider =
    await providerByPhone(
      "+34644642728",
    );

  const providerId =
    String(
      provider.id,
    );

  const venue =
    await upsertVenue(
      providerId,
    );

  const venueId =
    String(
      venue.id,
    );

  await updateProviderProfile(
    providerId,
  );

  await addHistory({
    venueId,

    historyType:
      "information_update",

    title:
      "Ficha principal Chalet Nuria Castellón",

    sourceFileId:
      "1H1hnJa1Mbzhn2Mq-hgoUo_X2TjPpe2peQdbLhC0marU",

    sourceFileName:
      "INFORMACIÓN CHALET NURIA CASTELLON",

    sourceModifiedAt:
      "2026-03-20T23:48:01.988Z",

    description:
      "Documento con contacto, tarifas, capacidad, alojamiento, reserva, instalaciones y limitación de música por cercanía de vecinos.",

    newValue: {
      phone:
        "+34644642728",

      location:
        "Castellón / El Grao",

      beach_distance:
        "aprox. 1,5 km",

      event_capacity:
        "20-50",

      sleeping_capacity:
        10,

      rental:
        "por semanas",

      maximum_days:
        10,

      full_house_price:
        "1000 EUR/noche",

      exterior_price:
        "650 EUR/día",

      booking:
        "20%",

      exterior_deposit:
        400,

      interior_deposit:
        800,

      facilities: [
        "piscina",
        "gimnasio",
        "barbacoa",
        "cocina",
        "3 habitaciones",
        "baños",
        "mesas",
        "sillas",
        "pérgola",
      ],

      music:
        "moderada",

      neighbors:
        true,
    },
  });

  await addHistory({
    venueId,

    historyType:
      "data_conflict",

    title:
      "Variantes internas de capacidad y tarifa en documento Nuria",

    sourceFileId:
      "1H1hnJa1Mbzhn2Mq-hgoUo_X2TjPpe2peQdbLhC0marU",

    sourceFileName:
      "INFORMACIÓN CHALET NURIA CASTELLON",

    sourceModifiedAt:
      "2026-03-20T23:48:01.988Z",

    confidence:
      "conflict",

    description:
      "El mismo documento contiene una segunda versión comercial con 990 €/noche, capacidad base para 8 personas y 4 baños completos, mientras otras secciones indican 1.000 €/noche, hasta 10 personas y 5 baños. La ficha operativa conserva los datos respaldados también por la hoja general más reciente.",

    oldValue: {
      nightly_price:
        990,

      sleeping_capacity:
        8,

      bathrooms:
        4,
    },

    newValue: {
      nightly_price:
        1000,

      sleeping_capacity:
        10,

      bathrooms:
        "dato no consolidado por conflicto 4/5",
    },
  });

  await addHistory({
    venueId,

    historyType:
      "commercial_document",

    title:
      "Versión para web Chalet Nuria",

    sourceFileId:
      "1e_xkN5907ce8EZQCnJzK-onC_r49wtzByt-PMeCj1vQ",

    sourceFileName:
      "Información para la WB",

    sourceModifiedAt:
      "2026-05-18T23:51:34.009Z",

    description:
      "Documento comercial preparado específicamente para la presentación web del Chalet Nuria.",
  });

  console.log(
    "==============================================",
  );

  console.log(
    "BATCH_4_COMPLETE",
  );

  console.log(
    "==============================================",
  );
}

main().catch(
  error => {
    console.error(
      "BATCH_4_FAILED",
      error,
    );

    process.exitCode = 1;
  },
);
