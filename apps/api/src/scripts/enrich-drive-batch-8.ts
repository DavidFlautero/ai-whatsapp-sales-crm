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

  if (!url || !key) {
    throw new Error(
      "SUPABASE_INTEGRATION_NOT_CONFIGURED",
    );
  }

  process.env.SUPABASE_URL =
    process.env.SUPABASE_URL || url;

  process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || key;
}

async function providerByName(
  name: string,
) {
  const rows =
    await supabaseRequest<Row[]>({
      table:
        "crm_providers",
      query:
        `?company_id=eq.${enc(
          COMPANY_ID!,
        )}`
        + `&name=eq.${enc(
          name,
        )}`
        + "&select=*"
        + "&limit=1",
    });

  if (!rows[0]) {
    throw new Error(
      `PROVIDER_NOT_FOUND:${name}`,
    );
  }

  return rows[0];
}

async function resolveRosaVenue(
  providerId: string,
) {
  const byProvider =
    await supabaseRequest<Row[]>({
      table:
        "crm_venues",
      query:
        `?company_id=eq.${enc(
          COMPANY_ID!,
        )}`
        + `&provider_id=eq.${enc(
          providerId,
        )}`
        + "&select=*"
        + "&limit=20",
    });

  if (byProvider.length === 1) {
    console.log(
      "[VENUE RESOLVED BY PROVIDER]",
      byProvider[0].name,
      byProvider[0].slug,
    );

    return byProvider[0];
  }

  const byName =
    await supabaseRequest<Row[]>({
      table:
        "crm_venues",
      query:
        `?company_id=eq.${enc(
          COMPANY_ID!,
        )}`
        + "&name=ilike.*Rosa*"
        + "&select=*"
        + "&limit=20",
    });

  if (byName.length === 1) {
    console.log(
      "[VENUE RESOLVED BY NAME]",
      byName[0].name,
      byName[0].slug,
    );

    return byName[0];
  }

  const byMoncofar =
    await supabaseRequest<Row[]>({
      table:
        "crm_venues",
      query:
        `?company_id=eq.${enc(
          COMPANY_ID!,
        )}`
        + "&or=(name.ilike.*Monco*,city.ilike.*Monco*)"
        + "&select=*"
        + "&limit=20",
    });

  if (byMoncofar.length === 1) {
    console.log(
      "[VENUE RESOLVED BY MONCOFAR]",
      byMoncofar[0].name,
      byMoncofar[0].slug,
    );

    return byMoncofar[0];
  }

  if (
    byProvider.length > 1
    || byName.length > 1
    || byMoncofar.length > 1
  ) {
    console.log(
      "[ROSA VENUE AMBIGUOUS]",
      {
        byProvider:
          byProvider.map(
            r => ({
              id: r.id,
              name: r.name,
              slug: r.slug,
            }),
          ),

        byName:
          byName.map(
            r => ({
              id: r.id,
              name: r.name,
              slug: r.slug,
            }),
          ),

        byMoncofar:
          byMoncofar.map(
            r => ({
              id: r.id,
              name: r.name,
              slug: r.slug,
            }),
          ),
      },
    );

    throw new Error(
      "ROSA_VENUE_AMBIGUOUS",
    );
  }

  const created =
    await supabaseRequest<Row[]>({
      table:
        "crm_venues",
      method:
        "POST",
      body: {
        company_id:
          COMPANY_ID,

        provider_id:
          providerId,

        name:
          "Chalet Rosa Moncófar",

        slug:
          "chalet-rosa-moncofar",

        status:
          "draft",

        province:
          "Castellón",

        city:
          "Moncófar",

        address:
          "Grao de Moncófar, Castellón",

        description:
          "Propiedad de Rosa en Grao de Moncófar / zona Vall d'Uixó, Castellón. La documentación histórica indica una vivienda de 3 plantas y 7 habitaciones.",

        capacity_min:
          null,

        capacity_max:
          null,

        max_event_guests:
          null,

        max_sleeping_guests:
          null,

        cost_from:
          null,

        client_price_from:
          null,

        currency:
          "EUR",

        features: [
          "7 habitaciones",
          "3 plantas",
        ],

        rental_modes: [
          "room_rental",
          "long_stay",
        ],

        suitable_for: [
          "Alojamiento",
          "Estancias",
        ],

        included_services: [],

        event_types_allowed: [],

        events_allowed:
          false,

        parties_allowed:
          false,
      },
    });

  if (!created[0]) {
    throw new Error(
      "ROSA_VENUE_CREATE_FAILED",
    );
  }

  console.log(
    "[VENUE CREATED]",
    created[0].name,
    created[0].slug,
  );

  return created[0];
}

async function updateProfile(
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

  if (!rows[0]) {
    throw new Error(
      "ROSA_PROFILE_NOT_FOUND",
    );
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
    body: {
      provider_type:
        "owner",

      factual_summary:
        "Rosa figura como propietaria de un chalet/casa en la zona de Grao de Moncófar / Vall d'Uixó, Castellón. La propiedad tiene 7 habitaciones y 3 plantas.",

      commercial_relationship:
        "Contacto histórico vinculado a posible colaboración con Eventos Mediterráneo",

      commercial_conditions: {
        room_monthly_price:
          300,

        utilities_included: [
          "luz",
          "agua",
          "internet",
        ],

        bedrooms:
          7,

        floors:
          3,
      },

      known_preferences: [],

      service_categories: [
        "venue_owner",
        "accommodation",
      ],

      factual_notes:
        "La fuente indica alquiler histórico por habitaciones a 300 EUR/mes con suministros incluidos. No se interpreta como tarifa actual de eventos.",

      source_metadata: {
        source:
          "google-drive",

        folder_id:
          "16wtDwut1F6lyv4ziWv-3hMcT4JFyQgLO",

        document_id:
          "11s2gkrexnW9fW3_URrUhp6lO_Uyy9MmGgSbuhv9e4v0",
      },
    },
  });

  console.log(
    "[PROFILE UPDATED] Rosa",
  );
}

async function patchVenue(
  venueId: string,
  providerId: string,
) {
  await supabaseRequest({
    table:
      "crm_venues",
    method:
      "PATCH",
    query:
      `?id=eq.${enc(
        venueId,
      )}`,
    body: {
      provider_id:
        providerId,

      name:
        "Chalet Rosa Moncófar",

      status:
        "draft",

      province:
        "Castellón",

      city:
        "Moncófar",

      address:
        "Grao de Moncófar, Castellón",

      description:
        "Propiedad de Rosa en la zona de Grao de Moncófar / Vall d'Uixó, Castellón. La documentación histórica indica una vivienda de 3 plantas y 7 habitaciones, utilizada en ese momento para alquiler por habitaciones.",

      features: [
        "7 habitaciones",
        "3 plantas",
        "Alojamiento por habitaciones",
        "Internet incluido históricamente",
        "Agua incluida históricamente",
        "Luz incluida históricamente",
      ],

      rental_modes: [
        "room_rental",
        "long_stay",
      ],

      suitable_for: [
        "Alojamiento",
        "Estancias",
      ],
    },
  });

  console.log(
    "[VENUE UPDATED] Chalet Rosa Moncófar",
  );
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
    occurredOn?: string | null;
    confidence?:
      | "source"
      | "derived"
      | "unverified"
      | "conflict";
    newValue?: unknown;
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
        input.occurredOn ?? null,

      history_type:
        input.historyType,

      title:
        input.title,

      description:
        input.description,

      old_value:
        null,

      new_value:
        input.newValue ?? null,

      source:
        "google-drive",

      source_file_id:
        input.sourceFileId,

      source_file_name:
        input.sourceFileName,

      source_folder_id:
        "16wtDwut1F6lyv4ziWv-3hMcT4JFyQgLO",

      source_folder_path:
        "1-CHALETS / 2. ALQUILER POR DIA / ROSA DUEÑA DE CHALET MONCAFOR CASTELLON",

      source_modified_at:
        input.sourceModifiedAt ?? null,

      confidence:
        input.confidence ?? "source",

      metadata: {},
    },
  });

  console.log(
    "[HISTORY ADDED]",
    input.title,
  );
}

async function main() {
  await hydrateSupabaseRuntime();

  console.log(
    "==============================================",
  );
  console.log(
    "DRIVE ENRICHMENT BATCH 8",
  );
  console.log(
    "==============================================",
  );

  const provider =
    await providerByName(
      "Rosa",
    );

  const providerId =
    String(
      provider.id,
    );

  const venue =
    await resolveRosaVenue(
      providerId,
    );

  const venueId =
    String(
      venue.id,
    );

  await updateProfile(
    providerId,
  );

  await patchVenue(
    venueId,
    providerId,
  );

  await addHistory({
    venueId,

    historyType:
      "property_information",

    title:
      "Ficha histórica Chalet Rosa Moncófar",

    sourceFileId:
      "11s2gkrexnW9fW3_URrUhp6lO_Uyy9MmGgSbuhv9e4v0",

    sourceFileName:
      "Información rosa",

    sourceModifiedAt:
      "2026-02-09T21:42:29.705Z",

    description:
      "Documento histórico que identifica a Rosa como propietaria de una propiedad en Grao de Moncófar / zona Vall d'Uixó, con 7 habitaciones y 3 plantas.",

    newValue: {
      owner:
        "Rosa",

      location:
        "Grao de Moncófar / zona Vall d'Uixó, Castellón",

      bedrooms:
        7,

      floors:
        3,
    },
  });

  await addHistory({
    venueId,

    historyType:
      "rental_reference",

    title:
      "Alquiler histórico por habitaciones 300 €",

    sourceFileId:
      "11s2gkrexnW9fW3_URrUhp6lO_Uyy9MmGgSbuhv9e4v0",

    sourceFileName:
      "Información rosa",

    sourceModifiedAt:
      "2026-02-09T21:42:29.705Z",

    description:
      "La fuente indica que en ese momento las habitaciones se alquilaban a 300 EUR mensuales incluyendo luz, agua e internet. No se trata como tarifa actual sin verificación.",

    newValue: {
      monthly_room_price:
        300,

      currency:
        "EUR",

      included: [
        "luz",
        "agua",
        "internet",
      ],
    },
  });

  await addHistory({
    venueId,

    historyType:
      "commercial_followup",

    title:
      "Posible inicio de colaboración con Rosa",

    sourceFileId:
      "11s2gkrexnW9fW3_URrUhp6lO_Uyy9MmGgSbuhv9e4v0",

    sourceFileName:
      "Información rosa",

    sourceModifiedAt:
      "2026-02-09T21:42:29.705Z",

    confidence:
      "source",

    description:
      "La nota indica que, al llegar el 24 de febrero, se cumplirían tres semanas desde que Rosa había comentado que iba a arreglar una puerta y que empezarían a trabajar juntos. Se conserva como antecedente, no como acuerdo vigente.",

    newValue: {
      collaboration_status:
        "historical_intent",

      pending_item:
        "arreglo de una puerta",
    },
  });

  await addHistory({
    venueId,

    historyType:
      "media_inventory",

    title:
      "Carpeta Rosa contiene material fotográfico y vídeo",

    sourceFileId:
      "11s2gkrexnW9fW3_URrUhp6lO_Uyy9MmGgSbuhv9e4v0",

    sourceFileName:
      "Información rosa",

    sourceModifiedAt:
      "2026-02-09T21:42:29.705Z",

    description:
      "La carpeta del chalet contiene múltiples fotografías y varios vídeos MOV. Quedan inventariados para la fase posterior de migración física de medios.",

    newValue: {
      media_phase:
        "pending_binary_migration",

      folder_id:
        "16wtDwut1F6lyv4ziWv-3hMcT4JFyQgLO",
    },
  });

  console.log(
    "==============================================",
  );
  console.log(
    "BATCH_8_COMPLETE",
  );
  console.log(
    "==============================================",
  );
}

main().catch(
  error => {
    console.error(
      "BATCH_8_FAILED",
      error,
    );

    process.exitCode = 1;
  },
);
