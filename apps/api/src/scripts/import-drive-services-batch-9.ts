import {
  supabaseRequest,
} from "../services/db/supabase-rest.client.js";

import {
  readIntegrationSecrets,
} from "../services/integrations/integration-secrets.repository.js";

type Row =
  Record<string, any>;

type Seed = {
  name: string;
  contactName?: string | null;
  providerType: string;
  categories: string[];
  phone?: string | null;
  city?: string | null;
  province?: string | null;
  notes?: string | null;
  relationship?: string | null;
  sourceId: string;
  sourceName: string;
  sourcePath: string;
  confidence?:
    | "source"
    | "derived"
    | "unverified"
    | "conflict";
  conditions?: Record<string, unknown>;
};

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

function normalize(
  value: string,
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .trim();
}

async function hydrateSupabaseRuntime() {
  const integrations =
    await readIntegrationSecrets();

  const url =
    integrations.supabase.url?.trim();

  const key =
    integrations.supabase
      .serviceRoleKey?.trim();

  if (!url || !key) {
    throw new Error(
      "SUPABASE_INTEGRATION_NOT_CONFIGURED",
    );
  }

  process.env.SUPABASE_URL =
    process.env.SUPABASE_URL || url;

  process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY
    || key;

  console.log(
    "[RUNTIME] Supabase loaded",
  );
}

const seeds: Seed[] = [

  // ==================================================
  // SOCIOS / INMOBILIARIA
  // ==================================================

  {
    name:
      "Yasmina Inmobiliaria",

    contactName:
      "Yasmina",

    providerType:
      "real_estate_partner",

    categories: [
      "real_estate",
      "property_sales",
      "property_rental",
      "partner",
    ],

    relationship:
      "Socio/contacto inmobiliario registrado en Drive",

    notes:
      "Archivo fuente identifica a Yasmina con actividad inmobiliaria, venta de chalet y alquiler.",

    sourceId:
      "13ZX77oJMN38f5EACZrEUKaBXNuToKmHq",

    sourceName:
      "YASMINA INMOBILIARIA, VENTA DE CHALET Y ALQUILER.png",

    sourcePath:
      "SOCIOS HIMOBILARIOS",
  },

  {
    name:
      "Max Diabola",

    contactName:
      "Max",

    providerType:
      "partner_lead",

    categories: [
      "partner_candidate",
      "investment",
      "local_business",
    ],

    relationship:
      "Posible socio; no confirmado",

    notes:
      "Figura dentro de la carpeta BUSCA UN SOCIOS PARA EL LOCAL. No se marca como socio confirmado.",

    confidence:
      "unverified",

    sourceId:
      "1TywQbp8sjOMl8CyOObVvZSurnGiwpUEN",

    sourceName:
      "MAX DIABOLA BUSCA",

    sourcePath:
      "BUSCA UN SOCIOS PARA EL LOCAL / MAX DIABOLA BUSCA",
  },


  // ==================================================
  // CATERING
  // ==================================================

  {
    name:
      "Hermano de Marga Catering",

    providerType:
      "partner",

    categories: [
      "catering",
      "partner",
    ],

    relationship:
      "Socio de catering según denominación de la carpeta fuente",

    sourceId:
      "1bgbY4vz8WS11tNcNv9--Qk7kJeM8mwML",

    sourceName:
      "Hermano marga catering socio mío",

    sourcePath:
      "Otros Servicios / 1-CATERFING SERVICIOS",
  },

  {
    name:
      "Paula Catering",

    contactName:
      "Paula",

    providerType:
      "service_provider",

    categories: [
      "catering",
    ],

    sourceId:
      "14NPP9ljgwxPyGFFfqDVJP_E96p06JVTi",

    sourceName:
      "PAULA CATERING",

    sourcePath:
      "Otros Servicios / 1-CATERFING SERVICIOS",
  },

  {
    name:
      "Cris Catering",

    contactName:
      "Cris",

    providerType:
      "service_provider",

    categories: [
      "catering",
    ],

    sourceId:
      "1trcUGTyfEs8PQ8MibvqlgbjFcriqa8SP",

    sourceName:
      "CRIS CATERING EMPRESA",

    sourcePath:
      "Otros Servicios / 1-CATERFING SERVICIOS",
  },

  {
    name:
      "Triana Catering RD",

    providerType:
      "service_provider",

    categories: [
      "catering",
    ],

    sourceId:
      "1EvY45XwbvoLwREIvUPYVItLl7GEwa_AG",

    sourceName:
      "TRIANA CATERING RD",

    sourcePath:
      "Otros Servicios / 1-CATERFING SERVICIOS",
  },

  {
    name:
      "Diego Catering",

    contactName:
      "Diego",

    providerType:
      "service_provider",

    categories: [
      "catering",
    ],

    sourceId:
      "1bVFyAwzu7F9bNoJvSL40CkIeidGuf8O3",

    sourceName:
      "DIEGO CATERING",

    sourcePath:
      "Otros Servicios / 1-CATERFING SERVICIOS",
  },

  {
    name:
      "Maite Catering y Organización de Eventos",

    contactName:
      "Maite",

    providerType:
      "service_provider",

    categories: [
      "catering",
      "event_planning",
    ],

    sourceId:
      "1-pRlow3jhz5EC3mvp6drBT7iAAGE-GPb",

    sourceName:
      "Maite catering y organización de eventos",

    sourcePath:
      "Otros Servicios / 1-CATERFING SERVICIOS",
  },

  {
    name:
      "Javi Benimaclet Ultramarino",

    contactName:
      "Javi",

    providerType:
      "service_provider",

    categories: [
      "catering",
      "food_supplier",
    ],

    sourceId:
      "1Qd1Ine4dMcWYv16f2d7g3ykY0_kkaStS",

    sourceName:
      "Javi Benimaclet ultramarino",

    sourcePath:
      "Otros Servicios / 1-CATERFING SERVICIOS",
  },

  {
    name:
      "Soriano Menú",

    providerType:
      "service_provider",

    categories: [
      "catering",
      "food",
    ],

    sourceId:
      "1yUJO8x_HfzQ7qmQ8gwYiq7R2dpVf8atL",

    sourceName:
      "Soriano menú",

    sourcePath:
      "Otros Servicios / 1-CATERFING SERVICIOS",
  },

  {
    name:
      "Maria Catering",

    contactName:
      "Maria",

    providerType:
      "service_provider",

    categories: [
      "catering",
    ],

    sourceId:
      "10b4pBaDRhHtSr02idxMBYgwAFA-C74Xf",

    sourceName:
      "Maria catering",

    sourcePath:
      "Otros Servicios / 1-CATERFING SERVICIOS",
  },

  {
    name:
      "Nathaly Cruz Catering",

    contactName:
      "Nathaly Cruz",

    providerType:
      "service_provider",

    categories: [
      "catering",
    ],

    sourceId:
      "1wf8w9XZpi3IJAZ-omL7HPsf1BrpgBJfA",

    sourceName:
      "Nathaly Cruz Catering",

    sourcePath:
      "Otros Servicios / 1-CATERFING SERVICIOS",
  },

  {
    name:
      "Valentina Catering",

    contactName:
      "Valentina",

    providerType:
      "service_provider",

    categories: [
      "catering",
    ],

    sourceId:
      "1wcAujaH0o3u5xX7JIOs23MwLAxr8Yhgn",

    sourceName:
      "Valentina Catering",

    sourcePath:
      "Otros Servicios / 1-CATERFING SERVICIOS",
  },

  {
    name:
      "Alejandro Martinez",

    contactName:
      "Alejandro Martinez",

    providerType:
      "service_provider",

    categories: [
      "catering",
    ],

    sourceId:
      "1koFR7L0F9ViXjNwjR0umgHodcNZugsDx",

    sourceName:
      "Alejandro Martinez",

    sourcePath:
      "Otros Servicios / 1-CATERFING SERVICIOS",
  },

  {
    name:
      "Mohamed Reda",

    contactName:
      "Mohamed Reda",

    providerType:
      "service_provider",

    categories: [
      "catering",
    ],

    sourceId:
      "1-ksbj7j7L_MS3f6NITQI037lMWB5mmO-",

    sourceName:
      "mohamed reda",

    sourcePath:
      "Otros Servicios / 1-CATERFING SERVICIOS",
  },

  {
    name:
      "Leidy Tatiana",

    contactName:
      "Leidy Tatiana",

    providerType:
      "service_provider",

    categories: [
      "catering",
    ],

    sourceId:
      "1RUjo8mDZyp9NaKt1ev2Wuz_hkEEgkpwd",

    sourceName:
      "Leidy Tatiana",

    sourcePath:
      "Otros Servicios / 1-CATERFING SERVICIOS",
  },

  {
    name:
      "Bandana Catering",

    providerType:
      "service_provider",

    categories: [
      "catering",
    ],

    sourceId:
      "1KLP32wtb35cigHQteFbUuKS9_-c_MSEm",

    sourceName:
      "BANDANA CATERING Catering empresa",

    sourcePath:
      "Otros Servicios / 1-CATERFING SERVICIOS",
  },

  {
    name:
      "Tía Manjar Catering",

    providerType:
      "service_provider",

    categories: [
      "catering",
    ],

    sourceId:
      "11cgOUCfTlamq5-UBwkG1GvFnSyZc77u8",

    sourceName:
      "TÍA MANJAR EMPRESA CATERING",

    sourcePath:
      "Otros Servicios / 1-CATERFING SERVICIOS",
  },

  {
    name:
      "Triana",

    providerType:
      "service_provider",

    categories: [
      "catering",
    ],

    notes:
      "No fusionar automáticamente con Triana Catering RD hasta confirmar que sean la misma entidad.",

    confidence:
      "unverified",

    sourceId:
      "1sIkrsjuVjfCXqhxaqMgMtllx9PIfgzyu",

    sourceName:
      "Triana",

    sourcePath:
      "Otros Servicios / 1-CATERFING SERVICIOS",
  },

  {
    name:
      "Luis Catering Roberto",

    providerType:
      "service_provider",

    categories: [
      "catering",
    ],

    sourceId:
      "1K0Yz_ey-7lvs8-vzIN9FBBS8P9LYUL_8",

    sourceName:
      "Luis catering Roberto",

    sourcePath:
      "Otros Servicios / 1-CATERFING SERVICIOS",
  },

  {
    name:
      "Catering Devoradora",

    providerType:
      "service_provider",

    categories: [
      "catering",
    ],

    sourceId:
      "1kMtvlV67kdsCfWhU1brt6T1NBucH81Oq",

    sourceName:
      "Catering devoradora",

    sourcePath:
      "Otros Servicios",
  },


  // ==================================================
  // TRANSPORTE / COCHES / LIMUSINAS / BUS
  // ==================================================

  {
    name:
      "Vicente Eventos Limosinas",

    contactName:
      "Vicente",

    providerType:
      "transport_provider",

    categories: [
      "limousine",
      "chauffeur",
      "wedding_transport",
      "event_transport",
    ],

    relationship:
      "Colaborador",

    notes:
      "Documento fuente indica literalmente COLABORAMOS JUNTOS y que Vicente es dueño/contacto para alquiler de limusinas.",

    sourceId:
      "1mlyjZ6ZgyFDN4C9UoRNOsQXkrAoiZX8LHTAwU8p5liM",

    sourceName:
      "victor dueño acuerdo informacion",

    sourcePath:
      "Otros Servicios / 7-Alquiler de coches clasicos / Alquiler de Limosinas",

    conditions: {
      website:
        "www.limusinavalencia.es",

      hummer_capacity:
        12,

      vehicle_8_seats_day_reference:
        995,

      vehicle_8_seats_5_hours_reference:
        835,

      vehicle_12_seats_reference:
        1495,

      deposit_reference:
        90,

      booking_requires: [
        "nombre",
        "DNI",
        "zona",
        "ubicación",
        "fecha",
        "hora",
        "días",
      ],
    },
  },

  {
    name:
      "Autocares Alegre",

    providerType:
      "transport_provider",

    categories: [
      "bus",
      "coach",
      "minibus",
      "event_transport",
      "shuttle",
    ],

    phone:
      "+34963831671",

    relationship:
      "Proveedor/contacto comercial",

    notes:
      "Empresa que ofrece autocares y microbuses de diferentes capacidades para grupos, eventos, celebraciones y lanzaderas.",

    sourceId:
      "1sv2QKaA9H7RLYMsYPzqlUnU-Kuo9jiyWa0aOsjF2Djo",

    sourceName:
      "AUTOCAR FLOTAS DE AUTOBUSES",

    sourcePath:
      "Otros Servicios / 7-Alquiler de coches clasicos",

    conditions: {
      email:
        "autocaresalegre@autocaresalegre.com",

      services: [
        "autocares",
        "microbuses",
        "traslados de grupos",
        "servicios lanzadera",
        "servicios nocturnos",
      ],
    },
  },

  {
    name:
      "Taxis 24 Horas Junito",

    providerType:
      "transport_provider",

    categories: [
      "taxi",
      "event_transport",
    ],

    sourceId:
      "1vfxugXtigweC7j_yzzNeYxRA9xyDwh0A",

    sourceName:
      "TAXIS 24 HORAS JUNITO",

    sourcePath:
      "Otros Servicios / 7-Alquiler de coches clasicos",
  },

  {
    name:
      "Massabus",

    providerType:
      "transport_provider",

    categories: [
      "bus",
      "event_transport",
    ],

    sourceId:
      "1cKGyZl8vX0AKxGmsA-wng9hfaW6zMEUl",

    sourceName:
      "Massabus",

    sourcePath:
      "Otros Servicios / 7-Alquiler de coches clasicos",
  },

  {
    name:
      "EVENTSCARS",

    providerType:
      "transport_provider",

    categories: [
      "event_cars",
      "vehicle_rental",
      "event_transport",
    ],

    sourceId:
      "1eqZLceuzOep8Vc2bu_wUXw_znzWsF1e3",

    sourceName:
      "EVENTSCARS",

    sourcePath:
      "Otros Servicios / 7-Alquiler de coches clasicos",
  },

  {
    name:
      "FANDOS Rent Alquiler de Furgonetas",

    providerType:
      "transport_provider",

    categories: [
      "van_rental",
      "vehicle_rental",
      "logistics",
    ],

    sourceId:
      "1aze2qskfmlUJuqUJSzDnkCiCRajRSHTi",

    sourceName:
      "FANDOS Rent Alquiler de Furgonetas",

    sourcePath:
      "Otros Servicios / 7-Alquiler de coches clasicos",
  },


  // ==================================================
  // OTROS PROVEEDORES IDENTIFICADOS
  // ==================================================

  {
    name:
      "Jhonny Barcos",

    contactName:
      "Jhonny",

    providerType:
      "service_provider",

    categories: [
      "boat",
      "boat_rental",
    ],

    notes:
      "Marcado como pendiente en Drive.",

    sourceId:
      "1Gp9iJ5tQaIBY1qwVVv5O1qg7cH5zfJeI",

    sourceName:
      "Jhonny barcos pendiente",

    sourcePath:
      "Otros Servicios",
  },

  {
    name:
      "Cerbo Proveedor",

    providerType:
      "service_provider",

    categories: [
      "supplier",
    ],

    sourceId:
      "13M0XsJrZXI2-galGxFstME6n5bAWVRWc",

    sourceName:
      "CERBO PROBEDOR",

    sourcePath:
      "Otros Servicios",
  },

  {
    name:
      "Lusca Empresa de Alquiler de Equipo",

    providerType:
      "equipment_provider",

    categories: [
      "equipment_rental",
      "events",
    ],

    sourceId:
      "1T-9sq-z5DdaHd3IDqzJlEYVwQIkgRO-o",

    sourceName:
      "LUSCA EMPRESA DE ALQUILER EQUIPO",

    sourcePath:
      "Otros Servicios",
  },

  {
    name:
      "Hermanos Jiménez Sonido Reparaciones",

    providerType:
      "technical_provider",

    categories: [
      "sound",
      "sound_repair",
      "technical_service",
    ],

    sourceId:
      "1d3DnnK9OAjQw4tf-pqt99aEaRMcm5xo4",

    sourceName:
      "Hermanos Jimenez SONIDO REPARACINES",

    sourcePath:
      "Otros Servicios",
  },

  {
    name:
      "Taller Mecánico Massanassa",

    providerType:
      "service_provider",

    categories: [
      "mechanic",
      "vehicle_service",
    ],

    city:
      "Massanassa",

    province:
      "Valencia",

    sourceId:
      "10B82iD_gUjli68uwZZJq9xzDpHbA8oTO",

    sourceName:
      "Taller mecánico Massanassa",

    sourcePath:
      "Otros Servicios",
  },

  {
    name:
      "Lavado de Coche",

    providerType:
      "service_provider",

    categories: [
      "car_wash",
      "vehicle_service",
    ],

    confidence:
      "unverified",

    notes:
      "La fuente identifica el servicio pero no aporta en el nombre de carpeta una empresa/persona concreta.",

    sourceId:
      "1Aa97ywlwSoS9En5asZ5e3AxkcqRFE1L-",

    sourceName:
      "Lavado de coche 🚕",

    sourcePath:
      "Otros Servicios",
  },

  {
    name:
      "Manolo Seguridad",

    contactName:
      "Manolo",

    providerType:
      "security_provider",

    categories: [
      "security",
      "event_security",
    ],

    sourceId:
      "1BejzLFids0IKZrCK6r3K6TaFdQChCq6g",

    sourceName:
      "Manolo Seguridad",

    sourcePath:
      "Otros Servicios",
  },

  {
    name:
      "Poli Vicente Empresa de Eventos",

    contactName:
      "Vicente",

    providerType:
      "event_company",

    categories: [
      "events",
      "event_company",
    ],

    sourceId:
      "1nneziX6PJ27A4PIWvL5UtDu6Q1rOEe5Y",

    sourceName:
      "Poli Vicente dueño Empresa de eventos",

    sourcePath:
      "Otros Servicios",
  },
];

async function getProviders() {
  return await supabaseRequest<Row[]>({
    table:
      "crm_providers",

    query:
      `?company_id=eq.${enc(
        COMPANY_ID!,
      )}&select=*`,
  });
}

async function createProvider(
  seed: Seed,
) {
  const rows =
    await supabaseRequest<Row[]>({
      table:
        "crm_providers",

      method:
        "POST",

      body: {
        company_id:
          COMPANY_ID,

        name:
          seed.name,

        contact_name:
          seed.contactName
          ?? seed.name,

        phone:
          seed.phone
          ?? null,

        whatsapp:
          null,

        province:
          seed.province
          ?? null,

        city:
          seed.city
          ?? null,

        service_area:
          [
            seed.city,
            seed.province,
          ]
            .filter(Boolean)
            .join(", ")
          || null,

        notes:
          seed.notes
          ?? `Importado desde Google Drive. Fuente: ${seed.sourcePath}`,
      },
    });

  if (!rows[0]) {
    throw new Error(
      `PROVIDER_CREATE_FAILED:${seed.name}`,
    );
  }

  return rows[0];
}

async function ensureProfile(
  providerId: string,
  seed: Seed,
) {
  const existing =
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

  if (existing[0]) {
    console.log(
      "[PROFILE EXISTS]",
      seed.name,
    );

    return;
  }

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
        seed.providerType,

      factual_summary:
        `${seed.name} figura en Google Drive dentro de la categoría ${seed.categories.join(
          ", ",
        )}.`,

      commercial_relationship:
        seed.relationship
        ?? "Contacto/proveedor histórico registrado en Google Drive",

      service_categories:
        seed.categories,

      known_preferences:
        [],

      commercial_conditions:
        seed.conditions
        ?? {},

      factual_notes:
        seed.notes
        ?? null,

      ai_profile:
        {},

      source_metadata: {
        source:
          "google-drive",

        source_id:
          seed.sourceId,

        source_name:
          seed.sourceName,

        source_path:
          seed.sourcePath,

        confidence:
          seed.confidence
          ?? "source",
      },
    },
  });

  console.log(
    "[PROFILE CREATED]",
    seed.name,
  );
}

async function ensureHistory(
  providerId: string,
  seed: Seed,
) {
  const title =
    `Importación Drive — ${seed.name}`;

  const existing =
    await supabaseRequest<Row[]>({
      table:
        "crm_entity_history",

      query:
        `?company_id=eq.${enc(
          COMPANY_ID!,
        )}`
        + "&entity_type=eq.provider"
        + `&provider_id=eq.${enc(
          providerId,
        )}`
        + `&source_file_id=eq.${enc(
          seed.sourceId,
        )}`
        + `&title=eq.${enc(
          title,
        )}`
        + "&select=id"
        + "&limit=1",
    });

  if (existing[0]) {
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
        "provider",

      provider_id:
        providerId,

      venue_id:
        null,

      event_id:
        null,

      occurred_at:
        null,

      occurred_on:
        null,

      history_type:
        "source_inventory",

      title,

      description:
        `Entidad localizada durante la migración completa de Google Drive. Categorías: ${seed.categories.join(
          ", ",
        )}.`,

      old_value:
        null,

      new_value: {
        provider_type:
          seed.providerType,

        categories:
          seed.categories,

        relationship:
          seed.relationship
          ?? null,

        conditions:
          seed.conditions
          ?? null,
      },

      source:
        "google-drive",

      source_file_id:
        seed.sourceId,

      source_file_name:
        seed.sourceName,

      source_folder_id:
        null,

      source_folder_path:
        seed.sourcePath,

      source_modified_at:
        null,

      confidence:
        seed.confidence
        ?? "source",

      metadata: {
        migration_batch:
          9,
      },
    },
  });

  console.log(
    "[HISTORY CREATED]",
    seed.name,
  );
}

async function main() {
  await hydrateSupabaseRuntime();

  console.log(
    "==============================================",
  );
  console.log(
    "SERVICES / PARTNERS BATCH 9",
  );
  console.log(
    "==============================================",
  );

  const existing =
    await getProviders();

  const map =
    new Map<string, Row>();

  for (const row of existing) {
    map.set(
      normalize(
        String(
          row.name ?? "",
        ),
      ),
      row,
    );
  }

  let created = 0;
  let reused = 0;

  for (const seed of seeds) {
    const key =
      normalize(
        seed.name,
      );

    let provider =
      map.get(
        key,
      );

    if (!provider) {
      provider =
        await createProvider(
          seed,
        );

      map.set(
        key,
        provider,
      );

      created++;

      console.log(
        "[PROVIDER CREATED]",
        seed.name,
      );
    } else {
      reused++;

      console.log(
        "[PROVIDER EXISTS]",
        seed.name,
      );
    }

    const providerId =
      String(
        provider.id,
      );

    await ensureProfile(
      providerId,
      seed,
    );

    await ensureHistory(
      providerId,
      seed,
    );
  }

  console.log(
    "==============================================",
  );

  console.log({
    seeds:
      seeds.length,

    created,

    reused,
  });

  console.log(
    "BATCH_9_COMPLETE",
  );

  console.log(
    "==============================================",
  );
}

main().catch(
  error => {
    console.error(
      "BATCH_9_FAILED",
      error,
    );

    process.exitCode = 1;
  },
);
