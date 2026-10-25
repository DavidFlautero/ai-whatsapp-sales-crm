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

  if (!rows[0]) {
    throw new Error(
      `VENUE_NOT_FOUND:${slug}`,
    );
  }

  return rows[0];
}

async function patchVenue(
  id: string,
  body:
    Record<
      string,
      unknown
    >,
) {
  await supabaseRequest({
    table:
      "crm_venues",
    method:
      "PATCH",
    query:
      `?company_id=eq.${enc(
        COMPANY_ID!,
      )}`
      + `&id=eq.${enc(
        id,
      )}`,
    body,
  });
}

async function addHistory(
  input: {
    venueId: string;
    historyType: string;
    title: string;
    description: string;
    occurredOn?: string | null;
    sourceFileId: string;
    sourceFileName: string;
    sourceFolderId?: string | null;
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
        input.sourceFolderId
        ?? null,
      source_folder_path:
        null,
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

async function enrichMasiaDelRegal() {
  const venue =
    await venueBySlug(
      "masia-del-regal",
    );

  const id =
    String(
      venue.id,
    );

  await patchVenue(
    id,
    {
      status:
        "draft",
      city:
        "Algemesí",
      province:
        "Valencia",
      address:
        "Rust. Polígono 22 Cotes, 2, 46680 Algemesí, Valencia",
      capacity_min:
        10,
      capacity_max:
        50,
      max_event_guests:
        50,
      max_sleeping_guests:
        11,
      cost_from:
        650,
      client_price_from:
        650,
      currency:
        "EUR",
      description:
        "Masía vacacional en Algemesí, a unos 25 minutos de Valencia. Pensada para escapadas de grupo, celebraciones y fines de semana. Alojamiento máximo 10–11 personas y eventos de hasta 50 personas.",
      features: [
        "4 habitaciones",
        "2 baños",
        "2 salones",
        "Cocina equipada",
        "Jardines",
        "Piscina privada",
        "Billar",
        "Dardos",
        "Chimenea",
        "Parking",
        "Aire acondicionado",
        "Calefacción",
        "TV",
        "WiFi",
        "Barbacoa exterior",
        "Mascotas permitidas",
      ],
      rental_modes: [
        "overnight",
        "weekend",
        "multi_day",
        "event",
      ],
      events_allowed:
        true,
      parties_allowed:
        true,
      suitable_for: [
        "Escapadas",
        "Fines de semana",
        "Eventos privados",
        "Celebraciones",
      ],
    },
  );

  console.log(
    "[VENUE UPDATED] Masía del Regal",
  );

  await addHistory({
    venueId:
      id,
    historyType:
      "information_update",
    title:
      "Ficha actualizada Masía del Regal",
    sourceFileId:
      "1cn3LCLrOOe25dNRfrnDTTD_GWUIPXtitAw8XcIAXq0c",
    sourceFileName:
      "Información actualizada",
    sourceFolderId:
      "1ys3WfFI6G33M_ym8n_wI2cp7ZG1URSVa",
    sourceModifiedAt:
      "2026-05-17T16:27:26.015Z",
    description:
      "Ficha completa con ubicación, alojamiento, eventos, tarifas, extras, pagos, estancias mínimas y contacto.",
    newValue: {
      maps:
        "https://maps.app.goo.gl/BH5qtvER3H7ZgLFcA",
      instagram:
        "@masiadelregal",
      city:
        "Algemesí",
      sleeping_capacity:
        "10-11",
      event_capacity:
        50,
      minimum_stay:
        "2 noches",
      july_august:
        "solo semanas completas de 7 noches",
      weekend_schedule:
        "viernes 17:00 a domingo 18:00",
      weekend_price:
        "650-850 EUR",
      nightly_price_from:
        175,
      extra_bed:
        50,
      pet_fee:
        50,
      early_late:
        50,
      event_with_stay:
        "15-20 EUR por persona",
      event_without_stay:
        "25-30 EUR por persona",
      reservation:
        "25%",
      accommodation_deposit:
        300,
      event_deposit:
        500,
      payment_methods: [
        "transferencia",
        "efectivo",
      ],
      year_end_minimum:
        "3 noches",
      contact:
        "Pablo",
      phone:
        "604998534",
    },
  });

  await addHistory({
    venueId:
      id,
    historyType:
      "commercial_document",
    title:
      "Versión web Masía del Regal",
    sourceFileId:
      "1eKskzpAmbZRQXtpiJD9V-acbswWlPKiGgcXf1n23Hbg",
    sourceFileName:
      "Información De la Villa WB",
    sourceFolderId:
      "1ys3WfFI6G33M_ym8n_wI2cp7ZG1URSVa",
    sourceModifiedAt:
      "2026-05-18T23:49:19.695Z",
    description:
      "Documento comercial preparado para web de Masía del Regal.",
  });
}

async function enrichDaniel() {
  const venue =
    await venueBySlug(
      "chalet-daniel-alginet",
    );

  const id =
    String(
      venue.id,
    );

  await patchVenue(
    id,
    {
      status:
        "draft",
      city:
        "Alginet",
      province:
        "Valencia",
      capacity_min:
        30,
      capacity_max:
        40,
      max_event_guests:
        40,
      cost_from:
        450,
      client_price_from:
        450,
      currency:
        "EUR",
      description:
        "Chalet en zona de Alginet para grupos de 30–40 personas. Fines de semana de 11:00 a 21:00. Piscina, WiFi, altavoz y zona de paellas/barbacoa. Música muy restringida y no se permiten DJs ni equipos externos.",
      features: [
        "Piscina",
        "WiFi",
        "Altavoz USB",
        "Altavoz para móvil",
        "Zona de paellas",
        "Barbacoa",
        "Espacio exterior",
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
        "Reuniones",
        "Celebraciones",
        "Eventos familiares",
      ],
    },
  );

  console.log(
    "[VENUE UPDATED] Chalet Daniel Alginet",
  );

  await addHistory({
    venueId:
      id,
    historyType:
      "information_update",
    title:
      "Ficha completa Chalet Daniel Alginet",
    sourceFileId:
      "1QU0nk0748zJ87tp3wjdrXQ_qI2PwYzhX_MeSem87Uj4",
    sourceFileName:
      "INFO DEL CHALE DANIEL",
    sourceFolderId:
      "19Y6KljuymlfxX6-EgQ_GvJsOW2_T9XN8",
    sourceModifiedAt:
      "2026-05-18T13:29:57.133Z",
    description:
      "Condiciones generales con aforo, horario, precio, fianza, servicios, música, restricciones y contacto.",
    newValue: {
      capacity:
        "30-40",
      schedule:
        "fines de semana 11:00-21:00",
      price:
        450,
      deposit:
        150,
      ambient_music:
        "15:00-17:00",
      dj_allowed:
        false,
      external_sound_systems:
        false,
      microphones:
        false,
      megaphones:
        false,
      bachelor_parties:
        false,
      overnight:
        "puede autorizarse en algunos casos",
      owner_residence:
        "propietario reside en planta superior",
      christmas:
        "reservado",
      new_years_eve:
        "reservado",
      contact:
        "Daniel",
      phone:
        "630558345",
    },
  });

  await addHistory({
    venueId:
      id,
    historyType:
      "availability_note",
    title:
      "Navidad y Nochevieja constaban reservadas",
    sourceFileId:
      "1QU0nk0748zJ87tp3wjdrXQ_qI2PwYzhX_MeSem87Uj4",
    sourceFileName:
      "INFO DEL CHALE DANIEL",
    sourceFolderId:
      "19Y6KljuymlfxX6-EgQ_GvJsOW2_T9XN8",
    sourceModifiedAt:
      "2026-05-18T13:29:57.133Z",
    confidence:
      "source",
    description:
      "El documento indica que Navidad y Nochevieja ya estaban reservadas. Se conserva como antecedente histórico; no se trata como disponibilidad actual sin nueva verificación.",
    newValue: {
      christmas:
        "reserved",
      new_years_eve:
        "reserved",
    },
  });

  await addHistory({
    venueId:
      id,
    historyType:
      "commercial_document",
    title:
      "Versión web Chalet Daniel",
    sourceFileId:
      "1JRHuqydmBm2XRo0uz9vR1A2zkgjXvoevHQ5iMdHnvhY",
    sourceFileName:
      "Información para la WB",
    sourceFolderId:
      "19Y6KljuymlfxX6-EgQ_GvJsOW2_T9XN8",
    sourceModifiedAt:
      "2026-05-19T19:52:26.005Z",
    description:
      "Documento comercial preparado para web del Chalet Daniel.",
  });
}

async function main() {
  await hydrateSupabaseRuntime();

  console.log(
    "==============================================",
  );
  console.log(
    "DRIVE ENRICHMENT BATCH 3",
  );
  console.log(
    "==============================================",
  );

  await enrichMasiaDelRegal();
  await enrichDaniel();

  console.log(
    "==============================================",
  );
  console.log(
    "BATCH_3_COMPLETE",
  );
  console.log(
    "==============================================",
  );
}

main().catch(
  error => {
    console.error(
      "BATCH_3_FAILED",
      error,
    );

    process.exitCode = 1;
  },
);
