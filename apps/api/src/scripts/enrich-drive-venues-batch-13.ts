import {
  supabaseRequest,
} from "../services/db/supabase-rest.client.js";

import {
  readIntegrationSecrets,
} from "../services/integrations/integration-secrets.repository.js";

type Row = Record<string, any>;

type Hist = {
  slug: string;
  sourceId: string;
  sourceName: string;
  folderId: string;
  folderPath: string;
  type: string;
  title: string;
  description: string;
  confidence?:
    | "source"
    | "derived"
    | "unverified"
    | "conflict";
  occurredOn?: string | null;
  data?: Record<string, unknown> | null;
};

const COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID;

if (!COMPANY_ID) {
  throw new Error(
    "DEFAULT_COMPANY_ID_NOT_SET",
  );
}

function enc(v: string) {
  return encodeURIComponent(v);
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

async function venue(
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
        + `&slug=eq.${enc(slug)}`
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
  slug: string,
  body: Record<string, unknown>,
) {
  const v =
    await venue(slug);

  await supabaseRequest({
    table:
      "crm_venues",

    method:
      "PATCH",

    query:
      `?id=eq.${enc(
        String(v.id),
      )}`,

    body,
  });

  console.log(
    "[VENUE UPDATED]",
    v.name,
  );

  return v;
}

async function addHistory(
  h: Hist,
) {
  const v =
    await venue(h.slug);

  const exists =
    await supabaseRequest<Row[]>({
      table:
        "crm_entity_history",

      query:
        `?company_id=eq.${enc(
          COMPANY_ID!,
        )}`
        + `&venue_id=eq.${enc(
          String(v.id),
        )}`
        + `&source_file_id=eq.${enc(
          h.sourceId,
        )}`
        + `&title=eq.${enc(
          h.title,
        )}`
        + "&select=id"
        + "&limit=1",
    });

  if (exists[0]) {
    console.log(
      "[HISTORY EXISTS]",
      h.title,
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
        v.provider_id ?? null,

      venue_id:
        v.id,

      event_id:
        null,

      occurred_at:
        null,

      occurred_on:
        h.occurredOn ?? null,

      history_type:
        h.type,

      title:
        h.title,

      description:
        h.description,

      old_value:
        null,

      new_value:
        h.data ?? null,

      source:
        "google-drive",

      source_file_id:
        h.sourceId,

      source_file_name:
        h.sourceName,

      source_folder_id:
        h.folderId,

      source_folder_path:
        h.folderPath,

      source_modified_at:
        null,

      confidence:
        h.confidence ?? "source",

      metadata: {
        migration_batch:
          13,
        deep_venue_scan:
          true,
      },
    },
  });

  console.log(
    "[HISTORY ADDED]",
    h.title,
  );
}

async function main() {
  await hydrate();

  console.log(
    "==============================================",
  );
  console.log(
    "DEEP VENUE ENRICHMENT BATCH 13",
  );
  console.log(
    "==============================================",
  );


  // ==================================================
  // ADRIANA
  // ==================================================

  await addHistory({
    slug:
      "chalet-adriana-valencia",

    sourceId:
      "1iyOcDBRR0qbFNI2LiOAThpPUTsprc_pEbM1ys5QPtgk",

    sourceName:
      "Adriana Chalet Valencia",

    folderId:
      "1kQhoAQZIxe11e0HoQGJg3_nN52mCXWSn",

    folderPath:
      "1-CHALETS / Adriana",

    type:
      "commercial_conflict",

    title:
      "Adriana indica que no alquila chalet como alojamiento",

    description:
      "La fuente indica expresamente que no alquila el chalet como tal y que trabaja con discomóvil, decoración, terreno, DJ y servicios asociados. Se conserva como conflicto respecto a la clasificación actual del CRM.",

    confidence:
      "conflict",

    data: {
      source_statement:
        "NO ALQUILA CHALET, SOLO DISCOMOVIL, DECORACION",

      packages: {
        "12-24":
          500,
        "12-20":
          400,
      },

      reservation_reference:
        "150-200 EUR",

      decoration_minimum:
        250,

      event_capacity_reference:
        "100-150",

      location_reference:
        "zona Sueca / Polinyà del Xúquer",
    },
  });

  await addHistory({
    slug:
      "chalet-adriana-valencia",

    sourceId:
      "1iyOcDBRR0qbFNI2LiOAThpPUTsprc_pEbM1ys5QPtgk",

    sourceName:
      "Adriana Chalet Valencia",

    folderId:
      "1kQhoAQZIxe11e0HoQGJg3_nN52mCXWSn",

    folderPath:
      "1-CHALETS / Adriana",

    type:
      "pricing_reference",

    title:
      "Tarifas históricas Adriana — terreno, DJ y discomóvil",

    description:
      "Referencias históricas de paquetes con terreno, DJ y discomóvil.",

    data: {
      package_full_day:
        500,
      package_until_20:
        400,
      currency:
        "EUR",
      includes: [
        "terreno",
        "DJ",
        "discomóvil",
      ],
    },
  });


  // ==================================================
  // DANIYIL MONTSERRAT
  // ==================================================

  await patchVenue(
    "chalet-montserrat-daniyil",
    {
      city:
        "Montserrat",

      province:
        "Valencia",

      max_sleeping_guests:
        6,

      cost_from:
        270,

      client_price_from:
        270,

      features: [
        "Piscina",
        "Baño exterior",
        "Cocina exterior",
        "Camping",
        "Pista de tenis",
        "Zona de fogata",
        "Parking",
        "Barbacoa",
        "Mesas",
        "Sillas",
        "Nevera",
      ],
    },
  );

  await addHistory({
    slug:
      "chalet-montserrat-daniyil",

    sourceId:
      "1oHRKJsWR8wyxcHt3X8SuGd2EZP1RXWQGe9dbthnwgGY",

    sourceName:
      "INFORMACIÓN CHALET DANIYIL MONSERRAT",

    folderId:
      "1c17bqqObWgEqOuzRuB5zqwVMHW3E_cCt",

    folderPath:
      "1-CHALETS / Daniyil",

    type:
      "information_update",

    title:
      "Ficha completa Chalet Daniyil Montserrat",

    description:
      "Ficha fuente con ubicación, tarifas, capacidad, fianza, limpieza, horarios e instalaciones.",

    data: {
      base_daily_price:
        270,
      included_people:
        6,
      additional_person:
        15,
      cleaning:
        50,
      deposit:
        270,
      sleeping_max:
        6,
      checkin:
        "16:00",
      checkout:
        "11:00",
    },
  });


  // ==================================================
  // FER PICASSENT
  // ==================================================

  await patchVenue(
    "chalet-fer-picassent",
    {
      city:
        "Picassent",

      province:
        "Valencia",

      max_event_guests:
        16,

      max_sleeping_guests:
        8,

      client_price_from:
        230,

      features: [
        "Piscina",
        "Jardín",
        "Paellero",
        "Zona de fuegos",
        "Terraza",
        "4 dormitorios",
        "2 baños",
      ],
    },
  );

  await addHistory({
    slug:
      "chalet-fer-picassent",

    sourceId:
      "1Ag5d7DaPI3OPo0LBMu8dlSalpSpZHBjGz23suOtxWFA",

    sourceName:
      "fer chalet info",

    folderId:
      "1fMOS-quSAwEMLF3BF6BwUDeV5jvHSG77",

    folderPath:
      "1-CHALETS / Fer",

    type:
      "information_update",

    title:
      "Ficha Chalet Fer Picassent",

    description:
      "Información de alquiler temporal, capacidades, reserva, precio de agosto y servicios.",

    data: {
      august_price_day:
        230,
      day_capacity:
        "15-16",
      sleeping_capacity:
        8,
      reservation_percent:
        20,
      rental_modes: [
        "día",
        "semana",
        "mes",
      ],
    },
  });

  await addHistory({
    slug:
      "chalet-fer-picassent",

    sourceId:
      "1Ag5d7DaPI3OPo0LBMu8dlSalpSpZHBjGz23suOtxWFA",

    sourceName:
      "fer chalet info",

    folderId:
      "1fMOS-quSAwEMLF3BF6BwUDeV5jvHSG77",

    folderPath:
      "1-CHALETS / Fer",

    type:
      "availability_note",

    title:
      "Julio constaba completamente reservado — Chalet Fer",

    description:
      "La fuente indica JULIO: TODO RESERVADO.",

    data: {
      month:
        "julio",
      status:
        "fully_reserved",
    },
  });


  // ==================================================
  // IVAN
  // ==================================================

  await addHistory({
    slug:
      "chalet-gandia-ivan",

    sourceId:
      "1t5q-Qj3_0ix-_J06pupywRoNIWQn4CHz5IKI_bhF-kI",

    sourceName:
      "CHALETS IVAN XATIVA",

    folderId:
      "1zhMxVd_8E0Vihycsm_0fupmthcm_2kA-",

    folderPath:
      "1-CHALETS / Iván",

    type:
      "location_conflict",

    title:
      "Conflicto ubicación Iván — CRM Gandía / fuente Xàtiva",

    description:
      "El registro importado se denomina Chalet Iván Gandía, pero la fuente específica del propietario identifica el chalet en Xàtiva. No se cambia automáticamente hasta resolver la identidad.",

    confidence:
      "conflict",

    data: {
      crm_location:
        "Gandía",
      source_location:
        "Xàtiva",
      source_phone:
        "+34651990031",
    },
  });

  await addHistory({
    slug:
      "chalet-gandia-ivan",

    sourceId:
      "1t5q-Qj3_0ix-_J06pupywRoNIWQn4CHz5IKI_bhF-kI",

    sourceName:
      "CHALETS IVAN XATIVA",

    folderId:
      "1zhMxVd_8E0Vihycsm_0fupmthcm_2kA-",

    folderPath:
      "1-CHALETS / Iván",

    type:
      "rule_update",

    title:
      "Reglas fuente Chalet Iván Xàtiva",

    description:
      "La fuente prohíbe dormir y documenta comedor de 60 m² donde puede utilizarse música fuerte.",

    data: {
      sleeping_allowed:
        false,
      dining_room:
        "60 m2",
      dining_room_price:
        600,
      strong_music_inside:
        true,
      contract_requires:
        "copia DNI ambas caras",
    },
  });


  // ==================================================
  // JUAN SOLÉ
  // ==================================================

  await patchVenue(
    "chalet-lliria-juan-sole",
    {
      city:
        "Llíria",

      province:
        "Valencia",

      max_sleeping_guests:
        11,

      cost_from:
        250,

      client_price_from:
        250,

      features: [
        "Piscina",
        "Barbacoa argentina",
        "Paellero",
        "Horno de leña",
        "Gimnasio",
        "Garaje",
        "Aire acondicionado",
        "Sistema de sonido",
        "Iluminación",
      ],
    },
  );

  await addHistory({
    slug:
      "chalet-lliria-juan-sole",

    sourceId:
      "1SbLmbM2NWuVkuC35pjoz7eyd18j6MCZQ_tFGG9y4iFo",

    sourceName:
      "Info chalet juan Sole Llíria",

    folderId:
      "1fyubPign91_I25X_c-hbxIxiDOr0Z8eO",

    folderPath:
      "1-CHALETS / Juan Solé",

    type:
      "information_update",

    title:
      "Ficha comercial Chalet Juan Solé Llíria",

    description:
      "Ficha con precios, capacidad, reserva, fianza, horarios, instalaciones y restricciones.",

    data: {
      nightly:
        250,
      weekend:
        500,
      minimum_nights:
        2,
      sleeping:
        "10-11",
      extra_event_guest:
        15,
      cleaning:
        120,
      reservation_percent:
        25,
      deposit_percent:
        25,
      outdoor_music_until:
        "01:00",
    },
  });

  await addHistory({
    slug:
      "chalet-lliria-juan-sole",

    sourceId:
      "1JSAElzkURZpqAHtVkNpneedbEdZ7Z0ZJ1o5I6M8un-0",

    sourceName:
      "Condiciones",

    folderId:
      "1RQbdpWDi-Iz_RU0VJuSLR9CusZGsdPrj",

    folderPath:
      "1-CHALETS / Juan Solé / JUAN NUEVO ACUERDO",

    type:
      "rule_update",

    title:
      "Nuevo acuerdo y condiciones Juan Solé agosto 2026",

    occurredOn:
      "2026-08-01",

    description:
      "Condiciones posteriores: normas de fuego, basura, tabaco, música dominical, mobiliario, pirotecnia y decoración.",

    data: {
      sunday_music:
        "10:00-22:00",
      smoking_inside:
        false,
      fireworks:
        false,
      decoration_must_be_removed:
        true,
      fire_restrictions:
        true,
    },
  });


  // ==================================================
  // SALVADOR MAS CAMARENA
  // ==================================================

  await patchVenue(
    "chalet-mas-camarena",
    {
      province:
        "Valencia",

      max_event_guests:
        100,

      max_sleeping_guests:
        2,

      cost_from:
        500,

      client_price_from:
        500,

      features: [
        "Piscina",
        "Jardines",
        "Pista de tenis",
        "Frontón",
        "Barbacoa",
        "Paelleros",
        "Neveras",
        "Mesas",
        "Sillas",
      ],
    },
  );

  await addHistory({
    slug:
      "chalet-mas-camarena",

    sourceId:
      "1TXe7ctx5_84qNhkIqaKeaBXnhBQHstAVA5xExc0c4us",

    sourceName:
      "Información Salvador actual",

    folderId:
      "1pnX5-SMaftspW-9oYyRevB3GTUN-6_SZ",

    folderPath:
      "1-CHALETS / Salvador",

    type:
      "information_update",

    title:
      "Ficha actual Chalet Salvador",

    description:
      "Información actual con tarifas escalonadas por número de personas, instalaciones, normas y reserva mínima.",

    data: {
      pricing: [
        "5-15 personas: 500 EUR",
        "30-40 personas: 1000 EUR",
        "70-80 personas: 1500 EUR",
        "90-100 personas: 2000-3000 EUR",
      ],
      reservation_signal:
        300,
      use_until:
        "00:00",
      sleeping:
        "1 pareja en zona La Viña",
    },
  });


  // ==================================================
  // NIKO SILLA
  // ==================================================

  await patchVenue(
    "chalet-silla-niko",
    {
      city:
        "Silla",

      province:
        "Valencia",

      max_event_guests:
        100,

      max_sleeping_guests:
        10,

      cost_from:
        200,

      client_price_from:
        200,

      events_allowed:
        true,

      features: [
        "Piscina",
        "Barbacoa",
        "4 habitaciones",
        "2 sofás cama",
        "Mesas",
        "Sillas",
        "Catering",
        "Paellas",
        "Sonido",
        "DJ",
      ],
    },
  );

  await addHistory({
    slug:
      "chalet-silla-niko",

    sourceId:
      "1kxKQdMvoc8EAVUFSkAFuiqdoUFV4K5IF2_i8B63pNzg",

    sourceName:
      "NIKI Y LIDIA DUEÑO INFORMACION",

    folderId:
      "116arzwuvKr7sDIh9Icbe-NgzRSiFTHFp",

    folderPath:
      "1-CHALETS / Niko",

    type:
      "information_update",

    title:
      "Ficha Chalet Niko Silla junio 2026",

    description:
      "Información fuente con horarios, precios, capacidades, servicios y reglas.",

    data: {
      day_rental:
        200,
      day_deposit:
        50,
      accommodation:
        300,
      accommodation_deposit:
        100,
      sleeping:
        "8-10",
      exterior_day_capacity_reference:
        100,
      interior_limit:
        25,
      reservation_signal:
        50,
    },
  });

  await addHistory({
    slug:
      "chalet-silla-niko",

    sourceId:
      "1kxKQdMvoc8EAVUFSkAFuiqdoUFV4K5IF2_i8B63pNzg",

    sourceName:
      "NIKI Y LIDIA DUEÑO INFORMACION",

    folderId:
      "116arzwuvKr7sDIh9Icbe-NgzRSiFTHFp",

    folderPath:
      "1-CHALETS / Niko",

    type:
      "availability_note",

    title:
      "Disponibilidad contradictoria junio-julio-agosto Chalet Niko",

    description:
      "La misma fuente contiene varias notas consecutivas sobre reservas y disponibilidad de junio, julio y agosto que no son totalmente coherentes. Se conserva como histórico conflictivo.",

    confidence:
      "conflict",

    data: {
      statements: [
        "junio completo",
        "20,23,24,27,30 junio reservados",
        "primeras semanas julio disponibles",
        "agosto reservado",
        "junio julio agosto completos",
      ],
    },
  });


  // ==================================================
  // RAQUEL CULLERA
  // ==================================================

  await patchVenue(
    "chalet-cullera-raquel",
    {
      city:
        "Cullera",

      province:
        "Valencia",

      max_sleeping_guests:
        10,

      cost_from:
        350,

      client_price_from:
        350,

      features: [
        "Piscina",
        "Paellero",
        "3 habitaciones matrimonio",
        "4 camas individuales",
        "2 literas",
        "Ducha exterior",
        "Parking 5 coches",
      ],
    },
  );

  await addHistory({
    slug:
      "chalet-cullera-raquel",

    sourceId:
      "18qky4kVwPixv-A7JPqizPzqYAnFCYAsgrLL2FLE4K5w",

    sourceName:
      "Información de chalets",

    folderId:
      "1xHy-eVBoCSrbOzt8kimZR5OuymDA_3Ae",

    folderPath:
      "1-CHALETS / Raquel",

    type:
      "information_update",

    title:
      "Ficha Chalet Raquel Cullera",

    description:
      "Información histórica de alquiler, capacidad, instalaciones, limpieza y fianza.",

    data: {
      weekend:
        350,
      august_month:
        5000,
      cleaning:
        60,
      deposit:
        100,
      sleeping_max:
        10,
      distance_beach_reference:
        "300 metros",
    },
  });

  await addHistory({
    slug:
      "chalet-cullera-raquel",

    sourceId:
      "18qky4kVwPixv-A7JPqizPzqYAnFCYAsgrLL2FLE4K5w",

    sourceName:
      "Información de chalets",

    folderId:
      "1xHy-eVBoCSrbOzt8kimZR5OuymDA_3Ae",

    folderPath:
      "1-CHALETS / Raquel",

    type:
      "availability_conflict",

    title:
      "Conflicto disponibilidad julio/agosto Raquel",

    description:
      "La fuente primero indica julio y agosto reservados y posteriormente registra un mensaje de Raquel indicando agosto disponible y julio no.",

    confidence:
      "conflict",

    data: {
      earlier:
        "julio y agosto reservado",
      later:
        "agosto disponible / julio no",
    },
  });


  // ==================================================
  // VICTOR MONTSERRAT
  // ==================================================

  await addHistory({
    slug:
      "chalet-victor-montserrat",

    sourceId:
      "1uooL1VNRhoCytyTLkFYRGfWyCuzWs2b8G1y8yj1XObk",

    sourceName:
      "Untitled document",

    folderId:
      "1YAdXkGc4j5PQ2td81OJMMcIT_yccsQ-_",

    folderPath:
      "1-CHALETS / Víctor",

    type:
      "identity_note",

    title:
      "Víctor consta con tres chalets en la misma zona",

    description:
      "La fuente indica que Víctor dispone de tres chalets en la misma zona. El CRM actualmente tiene un registro principal, por lo que no se crean tres propiedades sin identificar cada una.",

    confidence:
      "unverified",

    data: {
      properties_reference:
        3,
    },
  });

  await addHistory({
    slug:
      "chalet-victor-montserrat",

    sourceId:
      "1uooL1VNRhoCytyTLkFYRGfWyCuzWs2b8G1y8yj1XObk",

    sourceName:
      "Untitled document",

    folderId:
      "1YAdXkGc4j5PQ2td81OJMMcIT_yccsQ-_",

    folderPath:
      "1-CHALETS / Víctor",

    type:
      "rule_update",

    title:
      "Condiciones generales chalets Víctor",

    description:
      "En julio y agosto se alquila por semana. No se permiten altavoces exteriores, DJ, artistas ni músicos externos.",

    data: {
      summer_mode:
        "weekly",
      external_speaker:
        false,
      dj:
        false,
      artists:
        false,
      musicians:
        false,
      cleaning_buffer_hours:
        8,
      sleeping_deposit:
        500,
      day_deposit:
        200,
    },
  });


  // ==================================================
  // VICENTE Y HUGO ALBORAYA
  // ==================================================

  await patchVenue(
    "chalet-alboraya-vicente-hugo",
    {
      city:
        "Alboraya",

      province:
        "Valencia",

      max_event_guests:
        50,

      events_allowed:
        true,

      features: [
        "Piscina",
        "Baño",
        "Ducha exterior",
        "Paellero",
        "Asador",
        "Carpa",
        "Zonas verdes",
        "Parking",
        "Neveras",
      ],
    },
  );

  await addHistory({
    slug:
      "chalet-alboraya-vicente-hugo",

    sourceId:
      "1KmyAu49__ArG_muLZlSkxiz6hJBpQnIqa0wYpTLr0zQ",

    sourceName:
      "Información para la WB",

    folderId:
      "1ht0wirlTZkTwmZm2nVpP-v7jDaiylyFK",

    folderPath:
      "1-CHALETS / Vicente y Hugo",

    type:
      "commercial_document",

    title:
      "Versión web Rancho Vicente y Hugo Alboraya",

    description:
      "Documento comercial con capacidad máxima 50 personas e instalaciones disponibles.",

    data: {
      capacity:
        50,
      food_drinks_external:
        true,
    },
  });


  // ==================================================
  // JOAQUIN MANISES
  // ==================================================

  await patchVenue(
    "villa-manises-joaquin",
    {
      max_event_guests:
        20,

      max_sleeping_guests:
        20,

      cost_from:
        1200,

      client_price_from:
        1200,

      events_allowed:
        true,

      parties_allowed:
        false,
    },
  );

  await addHistory({
    slug:
      "villa-manises-joaquin",

    sourceId:
      "171xK_zVOPMiDIGREQWIteugUAY3mfwGc2Ob6oegHPU0",

    sourceName:
      "Información",

    folderId:
      "195MRLYAVrsdfkD7xuACCcHCcTI_71tJ7",

    folderPath:
      "1-CHALETS / Joaquín",

    type:
      "information_update",

    title:
      "Ficha Villa Joaquín",

    description:
      "Información de capacidad, estancia mínima, precio, fianza y reglas de convivencia.",

    data: {
      capacity:
        20,
      minimum_days:
        5,
      christmas_new_year_minimum:
        4,
      day_price:
        1200,
      deposit_cleaning:
        500,
      music:
        "moderada",
      quiet_from:
        "22:00",
      discomovil:
        false,
    },
  });


  console.log(
    "==============================================",
  );

  console.log(
    "BATCH_13_COMPLETE",
  );

  console.log(
    "==============================================",
  );
}

main().catch(
  error => {
    console.error(
      "BATCH_13_FAILED",
      error,
    );

    process.exitCode = 1;
  },
);
