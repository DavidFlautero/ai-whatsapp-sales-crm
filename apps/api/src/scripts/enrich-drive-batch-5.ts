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
    "chalet-zoe-monte-vedat";

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
      "Chalet Zoe Monte Vedat",

    slug,

    status:
      "draft",

    description:
      "Chalet para eventos en Monte Vedat con jardín, piscina, barbacoa, zona chill out, iluminación nocturna y capacidad aproximada de hasta 50 personas.",

    province:
      "Valencia",

    city:
      "Torrent",

    address:
      "Monte Vedat, Torrent, Valencia",

    capacity_min:
      20,

    capacity_max:
      50,

    max_event_guests:
      50,

    max_sleeping_guests:
      null,

    cost_from:
      750,

    client_price_from:
      750,

    currency:
      "EUR",

    features: [
      "Jardín con césped",
      "Más de 10 mesas grandes",
      "Iluminación nocturna",
      "Zona de barbacoa",
      "Zona chill out",
      "Piscina",
      "Zona para tomar el sol",
      "Gallinero",
    ],

    rental_modes: [
      "day",
      "event",
    ],

    events_allowed:
      true,

    parties_allowed:
      true,

    suitable_for: [
      "Cumpleaños",
      "Reuniones familiares",
      "Eventos privados",
      "Celebraciones",
    ],

    included_services: [],

    event_types_allowed: [],
  };

  if (existing) {
    const rows =
      await supabaseRequest<Row[]>({
        table:
          "crm_venues",
        method:
          "PATCH",
        query:
          `?id=eq.${enc(
            String(
              existing.id,
            ),
          )}`,
        body,
      });

    console.log(
      "[VENUE UPDATED] Chalet Zoe Monte Vedat",
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

  console.log(
    "[VENUE CREATED] Chalet Zoe Monte Vedat",
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
    occurredOn?: string | null;
    confidence?:
      | "source"
      | "derived"
      | "unverified"
      | "conflict";
    oldValue?: unknown;
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

      occurred_on:
        input.occurredOn
        ?? null,

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
        "1FsJ9dNAGX54w_ibwimc4eZuEF-49cdsY",

      source_folder_path:
        "1-CHALETS / 3-villas grupos por dias / 2-ZOES DUEÑA DE CHALET",

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
      "ZOE_PROFILE_NOT_FOUND",
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
      factual_summary:
        "Zoe figura en Google Drive como propietaria/contacto asociado a un chalet para eventos en Monte Vedat. Un contrato dentro de la misma carpeta identifica a Laura Ballester Fernández como propietaria legal; esta relación requiere verificación antes de fusionar identidades.",

      commercial_relationship:
        "Acuerdo comercial histórico con Eventos Mediterráneo",

      commercial_conditions: {
        current_reference_price:
          750,

        included_hours:
          12,

        extra_hour:
          80,

        venue_commission_percent:
          20,

        catering_commission_percent:
          20,

        older_reference_price:
          450,

        deposit_reference:
          300,

        cleaning_optional:
          50,
      },

      known_preferences: [
        "Acuerdo confirmado el 03/06/2026",
        "Comisión del 20% sobre alquiler",
        "Comisión del 20% sobre catering conseguido",
      ],

      factual_notes:
        "La carpeta usa el nombre Zoe. El contrato identifica a Laura Ballester Fernández como propietaria. Mantener ambas referencias separadas hasta confirmación.",

      source_metadata: {
        source:
          "google-drive",

        folder_id:
          "1FsJ9dNAGX54w_ibwimc4eZuEF-49cdsY",
      },
    },
  });

  console.log(
    "[PROFILE UPDATED] Zoe",
  );
}

async function main() {
  await hydrateSupabaseRuntime();

  console.log(
    "==============================================",
  );
  console.log(
    "DRIVE ENRICHMENT BATCH 5",
  );
  console.log(
    "==============================================",
  );

  const provider =
    await providerByName(
      "Zoe",
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

  await updateProfile(
    providerId,
  );

  await addHistory({
    venueId,

    historyType:
      "information_update",

    title:
      "Ficha Chalet Zoe Monte Vedat",

    sourceFileId:
      "1AHQLC4wmq3e-uaucfFzSARIZXaJZm5ctNVMFO2gQOK4",

    sourceFileName:
      "Información para la WB",

    description:
      "Ficha comercial del chalet en Monte Vedat con ubicación, capacidad, jardín, piscina, barbacoa, chill out e instalaciones.",

    newValue: {
      maps:
        "https://maps.google.com/?q=39.395679,-0.569483",

      capacity:
        50,

      facilities: [
        "jardín",
        "barbacoa",
        "chill out",
        "piscina",
        "iluminación nocturna",
        "gallinero",
      ],
    },
  });

  await addHistory({
    venueId,

    historyType:
      "commercial_agreement",

    title:
      "Acuerdo inicial Chalet Zoe",

    sourceFileId:
      "1_NaE2yq0wY6ClxmZRmnH5zze-VoOOhLx-riEM0VKZe0",

    sourceFileName:
      "Zoe chale información",

    occurredOn:
      "2026-02-26",

    description:
      "Condiciones iniciales documentadas para el alquiler del chalet.",

    newValue: {
      price:
        450,

      hours:
        "08:00-03:00",

      deposit:
        300,

      optional_cleaning:
        50,

      max_guests:
        50,

      payment_deadline:
        "48h antes",

      deposit_return:
        "48h tras revisión",
    },
  });

  await addHistory({
    venueId,

    historyType:
      "commercial_agreement",

    title:
      "Actualización acuerdo comercial Zoe 20%",

    sourceFileId:
      "1_NaE2yq0wY6ClxmZRmnH5zze-VoOOhLx-riEM0VKZe0",

    sourceFileName:
      "Zoe chale información",

    occurredOn:
      "2026-05-19",

    description:
      "Se documenta actualización del acuerdo comercial con comisión del 20% sobre el precio total del chalet y 20% sobre catering conseguido.",

    newValue: {
      venue_commission_percent:
        20,

      catering_commission_percent:
        20,
    },
  });

  await addHistory({
    venueId,

    historyType:
      "price_change",

    title:
      "Precio confirmado 750 € por 12 horas",

    sourceFileId:
      "1_NaE2yq0wY6ClxmZRmnH5zze-VoOOhLx-riEM0VKZe0",

    sourceFileName:
      "Zoe chale información",

    occurredOn:
      "2026-06-03",

    description:
      "El documento confirma que ambos chalets vinculados al acuerdo pasan a 750 € por 12 horas y 80 € por hora extra.",

    oldValue: {
      price:
        450,
    },

    newValue: {
      price:
        750,

      included_hours:
        12,

      extra_hour:
        80,
    },
  });

  await addHistory({
    venueId,

    historyType:
      "identity_note",

    title:
      "Contrato identifica a Laura Ballester Fernández como propietaria",

    sourceFileId:
      "1_VPr0aigxs9UdcfmGgovoDBlwl4aq1BGo_aXD7vJmxo",

    sourceFileName:
      "Nuevo contrato",

    confidence:
      "unverified",

    description:
      "El contrato alojado en la carpeta de Zoe identifica a Laura Ballester Fernández como propietaria legal. No se fusiona automáticamente con el perfil Zoe hasta verificar la relación entre ambos nombres.",
  });

  await addHistory({
    venueId,

    historyType:
      "reservation_history",

    title:
      "Reserva Celia Serrano",

    sourceFileId:
      "1JITUWHHGfWm1EZoEXePb0d3YJD2v0YOMtW8a2wkNGy4",

    sourceFileName:
      "FECHAS RESERVADAS",

    description:
      "Reserva histórica para cumpleaños, 20-25 personas, de 13:00 a 23:00/00:00, con pago de 300 € para reserva. La fuente no especifica el año junto a la fecha del 1 de mayo.",

    newValue: {
      client:
        "Celia Serrano",

      celebration:
        "Cumpleaños",

      guests:
        "20-25",

      start:
        "13:00",

      end:
        "23:00/00:00",

      requested_date:
        "1 de mayo",

      reservation_payment:
        300,
    },

    confidence:
      "source",
  });

  await addHistory({
    venueId,

    historyType:
      "reservation_history",

    title:
      "Reserva Andrés 9 mayo 2026",

    sourceFileId:
      "1JITUWHHGfWm1EZoEXePb0d3YJD2v0YOMtW8a2wkNGy4",

    sourceFileName:
      "FECHAS RESERVADAS",

    occurredOn:
      "2026-05-09",

    description:
      "Registro histórico de cumpleaños de cliente Andrés, marcado como pagado.",

    newValue: {
      client:
        "Andrés",

      event:
        "Cumpleaños",

      status:
        "paid",

      recorded_profit:
        200,
    },
  });

  await addHistory({
    venueId,

    historyType:
      "reservation_history",

    title:
      "Reserva Antonio 1 agosto 2026",

    sourceFileId:
      "1JITUWHHGfWm1EZoEXePb0d3YJD2v0YOMtW8a2wkNGy4",

    sourceFileName:
      "FECHAS RESERVADAS",

    occurredOn:
      "2026-08-01",

    description:
      "Registro histórico de reserva de Antonio para 40 personas.",

    newValue: {
      client:
        "Antonio",

      guests:
        40,

      charged:
        555,

      deposit:
        200,

      advance_paid:
        375,

      recorded_profit:
        150,
    },
  });

  await addHistory({
    venueId,

    historyType:
      "reservation_history",

    title:
      "Evento Rosa 9 agosto 2026",

    sourceFileId:
      "1JITUWHHGfWm1EZoEXePb0d3YJD2v0YOMtW8a2wkNGy4",

    sourceFileName:
      "FECHAS RESERVADAS",

    occurredOn:
      "2026-08-09",

    description:
      "Registro histórico de evento de Rosa con servicios adicionales.",

    newValue: {
      client:
        "Rosa",

      guests:
        70,

      sound_dj_animation:
        400,

      services: [
        "catering",
        "DJ",
        "animación",
      ],

      service_total:
        1400,
    },
  });

  console.log(
    "==============================================",
  );
  console.log(
    "BATCH_5_COMPLETE",
  );
  console.log(
    "==============================================",
  );
}

main().catch(
  error => {
    console.error(
      "BATCH_5_FAILED",
      error,
    );

    process.exitCode = 1;
  },
);
