import {
  supabaseRequest,
} from "../services/db/supabase-rest.client.js";

import {
  readIntegrationSecrets,
} from "../services/integrations/integration-secrets.repository.js";

type Row = Record<string, any>;

type Seed = {
  name: string;
  contactName?: string | null;
  providerType: string;
  categories: string[];
  city?: string | null;
  province?: string | null;
  notes?: string | null;
  sourceId: string;
  sourceName: string;
  sourcePath: string;
  confidence?: "source" | "derived" | "unverified" | "conflict";
};

const COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID
  || "eventos-mediterraneo";

function enc(
  value: string,
) {
  return encodeURIComponent(value);
}

function normalize(
  value: string,
) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

const seeds: Seed[] = [

  // ==================================================
  // DECORACION
  // ==================================================

  {
    name: "Sabrina Decoraciones",
    contactName: "Sabrina",
    providerType: "service_provider",
    categories: [
      "decoration",
      "event_decoration",
    ],
    sourceId:
      "1-pQhTbnU5yUKPJzxnhgv3dKbree5-RVt",
    sourceName:
      "DESCORACINES SABRINA",
    sourcePath:
      "Otros Servicios / 2-Decoradores / DESCORACINES SABRINA",
  },

  {
    name: "Alejandra Decoraciones",
    contactName: "Alejandra",
    providerType: "service_provider",
    categories: [
      "decoration",
      "event_decoration",
    ],
    sourceId:
      "1sx8rn8laO0tlBv0rhhSB_rwe3Ddpf2St",
    sourceName:
      "Alejandra Descoracines",
    sourcePath:
      "Otros Servicios / 2-Decoradores / Alejandra Descoracines",
  },

  {
    name: "Andrea Decoraciones",
    contactName: "Andrea",
    providerType: "service_provider",
    categories: [
      "decoration",
      "event_decoration",
    ],
    sourceId:
      "154rBxZpFJ-DkJW5rSwu7U6WvP6twgG-s",
    sourceName:
      "Andrea Decoraciónes",
    sourcePath:
      "Otros Servicios / 2-Decoradores / Andrea Decoraciónes",
  },

  {
    name: "Candy Show",
    providerType: "service_provider",
    categories: [
      "decoration",
      "event_entertainment",
    ],
    notes:
      "Carpeta incluida dentro de Decoradores. No se infieren servicios adicionales sin revisar su contenido interno.",
    sourceId:
      "1kpmBUOfUHTXOU1R1kV50b_TASttp33Qz",
    sourceName:
      "Candy show",
    sourcePath:
      "Otros Servicios / 2-Decoradores / Candy show",
    confidence:
      "source",
  },

  {
    name: "Rodrigo Decoración Alzira",
    contactName: "Rodrigo",
    providerType: "service_provider",
    categories: [
      "decoration",
      "event_decoration",
    ],
    city:
      "Alzira",
    province:
      "Valencia",
    sourceId:
      "1vdWPE-6HjJGVeZKf6YIdoUEdxn2j-snY",
    sourceName:
      "RODRIGO ALZIRA DESCORACIO",
    sourcePath:
      "Otros Servicios / 2-Decoradores / RODRIGO ALZIRA DESCORACIO",
  },


  // ==================================================
  // SILLAS / MOBILIARIO
  // ==================================================

  {
    name: "Fosati Sillas",
    providerType: "equipment_provider",
    categories: [
      "chair_rental",
      "furniture_rental",
      "event_furniture",
    ],
    sourceId:
      "1mB33Wy8v0fAkIhKFJvcVc9QWiNSRVrrH",
    sourceName:
      "Empresa Fosati sillas",
    sourcePath:
      "Otros Servicios / 3-Alquiler de Sillas / Empresa Fosati sillas",
  },

  {
    name: "Rubén Sillas Castellón",
    contactName: "Rubén",
    providerType: "equipment_provider",
    categories: [
      "chair_rental",
      "furniture_rental",
      "event_furniture",
    ],
    province:
      "Castellón",
    sourceId:
      "1ojPyPOmieXyK1-dVIsLtdX4tGHXwG65B",
    sourceName:
      "Silla Ruben - Castellòn",
    sourcePath:
      "Otros Servicios / 3-Alquiler de Sillas / Silla Ruben - Castellòn",
  },

  {
    name: "Ceibo Mobiliario",
    providerType: "equipment_provider",
    categories: [
      "furniture_rental",
      "event_furniture",
    ],
    sourceId:
      "1W9ksyDOaso4yFwdHl_CvioHOW-CXVjJy",
    sourceName:
      "Ceibo MOBILIARIO",
    sourcePath:
      "Otros Servicios / 3-Alquiler de Sillas / Ceibo MOBILIARIO",
  },

  {
    name: "Quico Mobiliario Manises",
    contactName: "Quico",
    providerType: "equipment_provider",
    categories: [
      "chair_rental",
      "furniture_rental",
      "event_furniture",
    ],
    city:
      "Manises",
    province:
      "Valencia",
    sourceId:
      "103sljEHkLz2YCofUpSQFpc4KWc673NaE",
    sourceName:
      "Quico / manises",
    sourcePath:
      "Otros Servicios / 3-Alquiler de Sillas / Quico / manises",
  },

  {
    name: "Miguel Sillas IKEA",
    contactName: "Miguel",
    providerType: "equipment_provider",
    categories: [
      "chair_rental",
      "furniture_rental",
    ],
    notes:
      "La carpeta fuente se denomina MIGUEL SILLA IKEA. No se interpreta IKEA como relación empresarial confirmada.",
    sourceId:
      "1xSXkdVxZKjsVSzsSXzEChIJWZ1NoYbVU",
    sourceName:
      "MIGUEL SILLA IKEA",
    sourcePath:
      "Otros Servicios / 3-Alquiler de Sillas / MIGUEL SILLA IKEA",
  },

  {
    name: "Antonio Sillas Albal",
    contactName: "Antonio",
    providerType: "equipment_provider",
    categories: [
      "chair_rental",
      "furniture_rental",
      "event_furniture",
    ],
    city:
      "Albal",
    province:
      "Valencia",
    sourceId:
      "1zafkxSRPL291BTTomgYuGwItwT6ePAKL",
    sourceName:
      "ANTONIO ALBAL SILLAS",
    sourcePath:
      "Otros Servicios / 3-Alquiler de Sillas / ANTONIO ALBAL SILLAS",
  },


  // ==================================================
  // COCINEROS
  // ==================================================

  {
    name: "Addu Habibi",
    contactName: "Addu Habibi",
    providerType: "staff_provider",
    categories: [
      "cook",
      "event_staff",
      "kitchen_staff",
    ],
    sourceId:
      "10IwaZz-EP0AON1IRk_HbfBNXuHXgUUsP",
    sourceName:
      "Addu habibi",
    sourcePath:
      "Otros Servicios / 4-COCINEROS CARPETAS / Addu habibi",
  },


  // ==================================================
  // CAMAREROS
  // ==================================================

  {
    name: "Fernando Apoyo Camareros",
    contactName: "Fernando",
    providerType: "staff_provider",
    categories: [
      "waiter",
      "event_staff",
      "hospitality_staff",
    ],
    notes:
      "Carpeta fuente denominada Fernando apoyo camarera.",
    sourceId:
      "1YxHua5HeRTyQKrSw0I-b2z4SQW7N5iwf",
    sourceName:
      "Fernando apoyo camarera",
    sourcePath:
      "Otros Servicios / 6-Camareros / Fernando apoyo camarera",
  },


  // ==================================================
  // CASTILLOS HINCHABLES
  // ==================================================

  {
    name: "Miguel Castillos Hinchables",
    contactName: "Miguel",
    providerType: "equipment_provider",
    categories: [
      "inflatable_castles",
      "children_entertainment",
      "event_equipment",
    ],
    sourceId:
      "1S2jshH1ymNxh3f-E4aB1uVhOYTD3TTEQ",
    sourceName:
      "MIGUEL CASTILLOS HIMCHABLES",
    sourcePath:
      "Otros Servicios / Castillos hinchables / MIGUEL CASTILLOS HIMCHABLES",
  },

  {
    name: "Francisco Castillos Hinchables",
    contactName: "Francisco",
    providerType: "equipment_provider",
    categories: [
      "inflatable_castles",
      "children_entertainment",
      "event_equipment",
    ],
    sourceId:
      "1b5F6isOG5aQwJr3UysUGJ2YAZ4MI0VAG",
    sourceName:
      "Francisco castillo hinchable",
    sourcePath:
      "Otros Servicios / Castillos hinchables / Francisco castillo hinchable",
  },

  {
    name: "Salvador Castillos Hinchables",
    contactName: "Salvador",
    providerType: "equipment_provider",
    categories: [
      "inflatable_castles",
      "children_entertainment",
      "event_equipment",
    ],
    sourceId:
      "12Ay8IPhgMBS60FR4_QNf7TcDBoE1cyKY",
    sourceName:
      "Salvador castillo",
    sourcePath:
      "Otros Servicios / Castillos hinchables / Salvador castillo",
  },
];

async function getProviders() {
  return await supabaseRequest<Row[]>({
    table:
      "crm_providers",
    query:
      `?company_id=eq.${enc(COMPANY_ID)}&select=*`,
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
          null,

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
        `?company_id=eq.${enc(COMPANY_ID)}`
        + `&provider_id=eq.${enc(providerId)}`
        + "&select=id"
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
        `${seed.name} figura en Google Drive dentro de las categorías ${seed.categories.join(", ")}.`,

      commercial_relationship:
        "Contacto/proveedor histórico registrado en Google Drive",

      service_categories:
        seed.categories,

      known_preferences:
        [],

      commercial_conditions:
        {},

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
        `?company_id=eq.${enc(COMPANY_ID)}`
        + "&entity_type=eq.provider"
        + `&provider_id=eq.${enc(providerId)}`
        + `&source_file_id=eq.${enc(seed.sourceId)}`
        + `&title=eq.${enc(title)}`
        + "&select=id"
        + "&limit=1",
    });

  if (existing[0]) {
    console.log(
      "[HISTORY EXISTS]",
      seed.name,
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
        `Entidad localizada durante la migración de Google Drive. Categorías: ${seed.categories.join(", ")}.`,

      old_value:
        null,

      new_value: {
        provider_type:
          seed.providerType,

        categories:
          seed.categories,

        city:
          seed.city
          ?? null,

        province:
          seed.province
          ?? null,
      },

      source:
        "google-drive",

      source_file_id:
        seed.sourceId,

      source_file_name:
        seed.sourceName,

      source_folder_id:
        seed.sourceId,

      source_folder_path:
        seed.sourcePath,

      source_modified_at:
        null,

      confidence:
        seed.confidence
        ?? "source",

      metadata: {
        migration_batch:
          10,
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
    "DRIVE SERVICES BATCH 10",
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
        String(row.name ?? ""),
      ),
      row,
    );
  }

  let created = 0;
  let reused = 0;

  for (const seed of seeds) {
    const key =
      normalize(seed.name);

    let provider =
      map.get(key);

    if (!provider) {
      provider =
        await createProvider(seed);

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
      String(provider.id);

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
    "BATCH_10_COMPLETE",
  );

  console.log(
    "==============================================",
  );
}

main().catch(
  error => {
    console.error(
      "BATCH_10_FAILED",
      error,
    );

    process.exitCode = 1;
  },
);
