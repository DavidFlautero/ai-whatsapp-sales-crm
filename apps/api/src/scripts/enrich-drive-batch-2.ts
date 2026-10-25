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

async function historyExists(
  sourceFileId: string,
  historyType: string,
  title: string,
) {
  const rows =
    await supabaseRequest<Row[]>({
      table:
        "crm_entity_history",
      query:
        `?company_id=eq.${enc(
          COMPANY_ID!,
        )}`
        + "&entity_type=eq.venue"
        + `&source_file_id=eq.${enc(
          sourceFileId,
        )}`
        + `&history_type=eq.${enc(
          historyType,
        )}`
        + `&title=eq.${enc(
          title,
        )}`
        + "&select=id"
        + "&limit=1",
    });

  return Boolean(
    rows[0],
  );
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
  if (
    await historyExists(
      input.sourceFileId,
      input.historyType,
      input.title,
    )
  ) {
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

async function enrichVillaEntreNaranjos() {
  const venue =
    await venueBySlug(
      "villa-entre-naranjos",
    );

  const id =
    String(
      venue.id,
    );

  await patchVenue(
    id,
    {
      name:
        "Villa Entre Naranjos",
      status:
        "draft",
      city:
        "Picassent",
      province:
        "Valencia",
      address:
        "Urbanización Lloma de la Verge, Calle Magnòlia, 12, Picassent, Valencia",
      capacity_min:
        30,
      capacity_max:
        90,
      max_event_guests:
        90,
      max_sleeping_guests:
        16,
      cost_from:
        2500,
      client_price_from:
        3000,
      currency:
        "EUR",
      description:
        "Villa privada en Picassent de aproximadamente 600 m² construidos sobre parcela de 8.000 m². Principalmente orientada a alojamiento, con posibilidad de eventos bajo condiciones específicas. Capacidad de alojamiento hasta 16 personas y eventos hasta 90 personas.",
      features: [
        "Piscina vallada",
        "Jardines",
        "Barbacoa",
        "Campo de fútbol",
        "Zona césped",
        "Carpa exterior",
        "Zona tipo choza",
        "Salón interior",
        "Zona chill out",
        "Espacio DJ",
        "Cocina equipada",
        "2 neveras",
        "Nevera industrial",
        "Paellero",
        "Plancha grande",
        "Chimenea",
        "WiFi",
        "Aire acondicionado",
        "Calefacción",
        "Más de 80 sillas",
        "Hasta 18 mesas",
        "Terrazas",
        "Balcones",
        "Discoteca privada bajo consulta",
      ],
      rental_modes: [
        "overnight",
        "multi_day",
        "event",
      ],
      events_allowed:
        true,
      parties_allowed:
        true,
      suitable_for: [
        "Bodas",
        "Cumpleaños",
        "Bautizos",
        "Comuniones",
        "Eventos corporativos",
        "Reuniones familiares",
        "Celebraciones privadas",
      ],
    },
  );

  console.log(
    "[VENUE UPDATED] Villa Entre Naranjos",
  );

  await addHistory({
    venueId:
      id,
    historyType:
      "information_update",
    title:
      "Ficha detallada Villa Entre Naranjos",
    sourceFileId:
      "1chinEkLzoJ2p8T2-2e9zLT00XMjYfRZE5QNeW_Jtweg",
    sourceFileName:
      "Villa entre información",
    sourceFolderId:
      "1AsOtUjC7VDRWIj8Gjuwz0ipcFCueZeFL",
    sourceModifiedAt:
      "2026-09-15T14:18:59.637Z",
    description:
      "Documento detallado con ubicación, capacidades, instalaciones, normas, precios, logística, música y condiciones.",
    newValue: {
      address:
        "Urbanización Lloma de la Verge, Calle Magnòlia 12",
      maps:
        "https://maps.google.com/?q=39.388111,-0.490266",
      built_area_m2:
        600,
      plot_area_m2:
        8000,
      sleeping_capacity:
        16,
      event_capacity:
        90,
      tent_capacity:
        60,
      hut_capacity:
        30,
      interior_capacity:
        "60 ampliable a 80",
      dj_area_capacity:
        "15-20",
      music_outdoor_until:
        "22:00",
      dj_schedule:
        "18:00-21:00",
      minimum_high_season:
        "2-3 noches",
      one_day_event:
        "solo temporada baja",
      deposit:
        "200-400 EUR; bodas 400 EUR",
      pets:
        "permitidas bajo responsabilidad",
      tennis_court:
        "no operativa",
    },
  });

  await addHistory({
    venueId:
      id,
    historyType:
      "price_change",
    title:
      "Marga comunica mínimo de alquiler de 2.500 €",
    occurredOn:
      "2026-05-24",
    sourceFileId:
      "1chinEkLzoJ2p8T2-2e9zLT00XMjYfRZE5QNeW_Jtweg",
    sourceFileName:
      "Villa entre información",
    sourceFolderId:
      "1AsOtUjC7VDRWIj8Gjuwz0ipcFCueZeFL",
    sourceModifiedAt:
      "2026-09-15T14:18:59.637Z",
    description:
      "Nota fechada en el documento: Marga indicó que no alquilaría por menos de 2.500 € por el trabajo de preparación y limpieza, aunque pide que se consulte siempre.",
    newValue: {
      minimum_price:
        2500,
      currency:
        "EUR",
      instruction:
        "consultar siempre",
    },
  });

  await addHistory({
    venueId:
      id,
    historyType:
      "commercial_document",
    title:
      "Versión comercial para web Villa Entre Naranjos",
    sourceFileId:
      "1dnFNR4I1H4RvlPePiMdsM5VGU5uJ58OJJAJ6IQ_kHwM",
    sourceFileName:
      "Información para la WB 1",
    sourceFolderId:
      "1AsOtUjC7VDRWIj8Gjuwz0ipcFCueZeFL",
    sourceModifiedAt:
      "2026-06-17T08:57:12.054Z",
    description:
      "Documento comercial preparado para web con alojamiento, zonas de eventos, instalaciones y normas.",
  });
}

async function enrichSilvia() {
  const venue =
    await venueBySlug(
      "chalet-silvia-picassent",
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
        "Picassent",
      province:
        "Valencia",
      capacity_max:
        50,
      max_event_guests:
        50,
      max_sleeping_guests:
        0,
      cost_from:
        500,
      client_price_from:
        500,
      currency:
        "EUR",
      description:
        "Chalet para eventos privados en Picassent. Capacidad máxima 50 personas. No permite alojamiento. Dispone de porche, salón/comedor interior de 60 m², barbacoa, mesas y sillas. Música exterior limitada a volumen ambiental; música más fuerte permitida en el salón interior.",
      features: [
        "Mesas",
        "Sillas",
        "Nevera",
        "Barbacoa",
        "Porche amplio",
        "Salón comedor 60 m²",
        "3 sofás grandes",
        "Sofá de dos plazas",
        "Suelo radiante desde octubre",
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
        "Eventos privados tranquilos",
      ],
    },
  );

  console.log(
    "[VENUE UPDATED] Chalet Silvia Picassent",
  );

  await addHistory({
    venueId:
      id,
    historyType:
      "information_update",
    title:
      "Ficha vigente Chalet Silvia",
    sourceFileId:
      "1AWrV2zvoxbRrsogTactxYj0ilXCSeP28DBGq2SZdnJc",
    sourceFileName:
      "Información actual Silvia",
    sourceFolderId:
      "1u-PG8adZ_iA0JevjGj46_O7FbvelSmY-",
    sourceModifiedAt:
      "2026-05-19T19:43:03.552Z",
    description:
      "Ficha actual del chalet con capacidad, horarios, precios, fianza, instalaciones, música, reglas y documentación requerida.",
    newValue: {
      maps:
        "https://maps.app.goo.gl/pNcxEktDdQJjC9c96",
      owner_phone:
        "+34 616 51 87 39",
      event_capacity:
        50,
      standard_hours:
        "10:00-23:00",
      extended_hours:
        "hasta 04:30 bajo consulta",
      standard_price:
        500,
      salon_price:
        600,
      deposit:
        200,
      payment_method:
        "efectivo",
      sleeping_allowed:
        false,
      exterior_music:
        "solo ambiental o volumen bajo",
      interior_music:
        "permitida a mayor volumen",
      contract_requirement:
        "copia DNI ambas caras",
    },
  });
}

async function main() {
  await hydrateSupabaseRuntime();

  console.log(
    "==============================================",
  );
  console.log(
    "DRIVE ENRICHMENT BATCH 2",
  );
  console.log(
    "==============================================",
  );

  await enrichVillaEntreNaranjos();
  await enrichSilvia();

  console.log(
    "==============================================",
  );
  console.log(
    "BATCH_2_COMPLETE",
  );
  console.log(
    "==============================================",
  );
}

main().catch(
  error => {
    console.error(
      "BATCH_2_FAILED",
      error,
    );

    process.exitCode = 1;
  },
);
