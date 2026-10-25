import {
  supabaseRequest,
} from "../services/db/supabase-rest.client.js";

import {
  readIntegrationSecrets,
} from "../services/integrations/integration-secrets.repository.js";

type Row =
  Record<string, unknown>;

type OperationSeed = {
  sourceId: string;
  sourceName: string;
  sourcePath: string;
  historyType: string;
  title: string;
  description: string;
  occurredOn?: string | null;
  confidence?: "source" | "derived" | "unverified" | "conflict";
  venueSlug?: string | null;
  providerName?: string | null;
  data?: Record<string, unknown>;
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

async function findVenue(
  slug?: string | null,
) {
  if (!slug) {
    return null;
  }

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
        + "&select=id,name,slug"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}

async function findProvider(
  name?: string | null,
) {
  if (!name) {
    return null;
  }

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
        + "&select=id,name"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}

async function historyExists(
  seed: OperationSeed,
) {
  const rows =
    await supabaseRequest<Row[]>({
      table:
        "crm_entity_history",

      query:
        `?company_id=eq.${enc(
          COMPANY_ID!,
        )}`
        + `&source_file_id=eq.${enc(
          seed.sourceId,
        )}`
        + `&title=eq.${enc(
          seed.title,
        )}`
        + "&select=id"
        + "&limit=1",
    });

  return Boolean(
    rows[0],
  );
}

async function insertHistory(
  seed: OperationSeed,
) {
  if (
    await historyExists(
      seed,
    )
  ) {
    console.log(
      "[HISTORY EXISTS]",
      seed.title,
    );

    return;
  }

  const venue =
    await findVenue(
      seed.venueSlug,
    );

  const provider =
    await findProvider(
      seed.providerName,
    );

  const venueId =
    venue
      ? String(
          venue.id,
        )
      : null;

  const providerId =
    provider
      ? String(
          provider.id,
        )
      : null;

  let entityType =
    "company";

  if (venueId) {
    entityType =
      "venue";
  } else if (providerId) {
    entityType =
      "provider";
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
        entityType,

      provider_id:
        providerId,

      venue_id:
        venueId,

      event_id:
        null,

      occurred_at:
        null,

      occurred_on:
        seed.occurredOn
        ?? null,

      history_type:
        seed.historyType,

      title:
        seed.title,

      description:
        seed.description,

      old_value:
        null,

      new_value:
        seed.data
        ?? null,

      source:
        "google-drive",

      source_file_id:
        seed.sourceId,

      source_file_name:
        seed.sourceName,

      source_folder_id:
        "11mG7DdxoZKo6YPpIUyI8aPCUjraId_hA",

      source_folder_path:
        seed.sourcePath,

      source_modified_at:
        null,

      confidence:
        seed.confidence
        ?? "source",

      metadata: {
        migration_batch:
          11,

        operation_import:
          true,

        venue_linked:
          Boolean(
            venueId,
          ),

        provider_linked:
          Boolean(
            providerId,
          ),
      },
    },
  });

  console.log(
    "[HISTORY CREATED]",
    seed.title,
    venueId
      ? "[VENUE]"
      : providerId
        ? "[PROVIDER]"
        : "[COMPANY]",
  );
}

const operations: OperationSeed[] = [

  // ==================================================
  // PRESUPUESTO DANIEL
  // NO SE VINCULA AL CHALET DANIEL:
  // EL DOCUMENTO NO IDENTIFICA EL VENUE.
  // ==================================================

  {
    sourceId:
      "1IxxgMJ3K8rhuVrryLDjEZL2Gj0VQAyaisXPR3sUwogA",

    sourceName:
      "Presupuesto Daniel",

    sourcePath:
      "PRESUPUESTOS / Presupuesto Daniel",

    historyType:
      "quote_sent",

    title:
      "Presupuesto Daniel — sonido, luces y DJ — 575 €",

    description:
      "Presupuesto histórico con alquiler de sonido, luces, DJ, transporte/equipamiento y personal. El documento no identifica de forma suficiente un chalet, por lo que se conserva como operación de empresa sin asociarlo automáticamente a Chalet Daniel Alginet.",

    data: {
      total:
        575,

      currency:
        "EUR",

      vat_reference:
        "21%",

      sound_reference:
        200,

      lights_reference:
        175,

      dj_reference:
        150,

      transport_staff_reference:
        50,

      equipment: [
        "2 subwoofer LD Systems STINGER SUB 15 A G2",
        "WORK ZEUS pre-escucha",
        "módulo potencia",
        "2 altavoces PEAVEY UL215H",
        "mezcladora Alexis MultiMix 16",
        "cabeza móvil BEAMZ",
        "proyector BeamZ",
        "iCOLOR 4 Light Effects",
        "Consola Pioneer DJ",
      ],

      payment_methods: [
        "Bizum",
        "Transferencia bancaria",
      ],

      venue_not_confirmed:
        true,
    },
  },


  // ==================================================
  // EVENTO BURGOS
  // ==================================================

  {
    sourceId:
      "1005QkwBPtbMr9XQlA4LGdVCgkoHvywDPlwT0V31DI3M",

    sourceName:
      "Evento de Burgos 15 de Agosto",

    sourcePath:
      "PRESUPUESTOS / Evento de Burgos 15 de Agosto",

    historyType:
      "client_request",

    title:
      "Solicitud Ayuntamiento Burgos — evento 300 personas",

    description:
      "José, identificado en la fuente como alcalde del pueblo de Burgos, contacta para cotizar un espectáculo elegante para 300 personas con bailarinas, animador y sonido.",

    occurredOn:
      null,

    data: {
      client:
        "José / Ayuntamiento de Burgos",

      requested_date:
        "15 de agosto",

      guests:
        300,

      location:
        "Plaza del Ayuntamiento, Burgos",

      travel:
        "aprox. 500 km / 5 horas",

      requested_services: [
        "bailarinas",
        "animador",
        "sonido",
      ],
    },
  },

  {
    sourceId:
      "1005QkwBPtbMr9XQlA4LGdVCgkoHvywDPlwT0V31DI3M",

    sourceName:
      "Evento de Burgos 15 de Agosto",

    sourcePath:
      "PRESUPUESTOS / Evento de Burgos 15 de Agosto",

    historyType:
      "quote_costing",

    title:
      "Costeo operativo Evento Burgos 15 de Agosto",

    description:
      "Costes y recursos registrados para preparar el evento de Burgos.",

    data: {
      sound:
        1000,

      van:
        139,

      van_deposit:
        200,

      van_provider:
        "Enterprise",

      van_provider_phone:
        "960450238",

      dancers:
        {
          quantity:
            2,

          price_each:
            200,

          status:
            "pendiente por confirmar",
        },

      helpers: [
        "Paula",
        "Jennifer",
      ],

      helpers_price_each:
        200,

      animator:
        "Soriano",

      dj:
        "Austin",

      sound_engineer:
        "Daniel",

      equipment: [
        "Sonido 3000 watts",
        "Luces",
        "4 micrófonos, 2 inalámbricos",
        "1 puente de luz",
      ],
    },
  },


  // ==================================================
  // OLOCAU / SANTONIO
  // ==================================================

  {
    sourceId:
      "1hqGelfkhAx5eM0JMtk42W4-uLblSxIR7bN7Aim_Dhpo",

    sourceName:
      "Presupuesto de Montaje 20 de Enero Olocau",

    sourcePath:
      "PRESUPUESTOS / Presupuesto de Montaje 20 de Enero Olocau",

    historyType:
      "quote_sent",

    title:
      "Presupuesto evento Santonio — montaje y sonido",

    description:
      "Presupuesto actualizado el 23/04/2025 para un evento denominado Santonio en Valencia, previsto para el 14/06/2025.",

    occurredOn:
      "2025-04-23",

    data: {
      event:
        "Santonio",

      event_date:
        "2025-06-14",

      location:
        "Valencia",

      equipment_reference:
        1500,

      service_hours:
        "23:00-03:00",

      setup_start:
        "10:00",

      staff: [
        "1 sonidista/encargado de luces",
        "transporte",
        "carga y descarga",
        "1 chofer de artistas e instrumentos",
        "2 animadoras",
        "1 DJ",
      ],

      equipment: [
        "3 altavoces",
        "2 pre-escuchas",
        "2 subwoofer",
        "4 cabezas móviles",
        "1 soporte de luces",
        "1 mezcladora",
        "1 mesa DJ",
        "2 micrófonos inalámbricos",
        "3000W sonido",
      ],
    },
  },


  // ==================================================
  // ADREINA
  // ==================================================

  {
    sourceId:
      "15P9yBQWrQZQNnx62OsaQpUv3hUg0__qpNW4BuM_zS34",

    sourceName:
      "Presuspuesto Adreina Boda Septiembre 15 2023",

    sourcePath:
      "PRESUPUESTOS / Presuspuesto Adreina Boda Septiembre 15 2023",

    historyType:
      "quote_sent",

    title:
      "Presupuesto Adreina — evento 15 septiembre 2024 — 1.100 €",

    description:
      "Presupuesto emitido para Adreina con sonido, DJ, bailarinas, animación, mobiliario, transporte, cámara y sonidista.",

    occurredOn:
      "2024-01-23",

    data: {
      client:
        "Adreina",

      event_date:
        "2024-09-15",

      total:
        1100,

      currency:
        "EUR",

      services: [
        "alquiler de sonido",
        "mezcladora",
        "altavoces",
        "pre-escucha",
        "DJ",
        "2 bailarinas",
        "animación SorianoRD",
        "23 sillas",
        "8 mesas",
        "transporte",
        "1 camarógrafo",
        "sonidista",
      ],

      confirmation_condition:
        "abono total o 50% para confirmar reserva",

      cancellation_condition:
        "aviso mínimo 24h; de lo contrario se abona la mitad del servicio",

      civil_liability:
        "a cargo de Adreina según documento",
    },
  },


  // ==================================================
  // PRESUPUESTO 2do TRIMESTRE 2024
  // DOCUMENTO CONTIENE REPETICIONES / PLANTILLA.
  // ==================================================

  {
    sourceId:
      "1rTe-rwcRKfo-1-MxNsFwKYQOKxgjVwtT5oiJyCTGopY",

    sourceName:
      "Presupuesto 2do Trimestre 2024",

    sourcePath:
      "PRESUPUESTOS / Presupuesto 2do Trimestre 2024",

    historyType:
      "quote_sent",

    title:
      "Presupuesto Lucía Fernández — cumpleaños 60 personas",

    description:
      "Documento de presupuesto con cliente Lucía Fernández para cumpleaños de 60 personas el 31/05/2025. Contiene referencias de local, DJ, sillas, mesas y catering. El documento presenta bloques repetidos y valores incompletos.",

    data: {
      client:
        "Lucía Fernández",

      event_type:
        "Cumpleaños",

      guests:
        60,

      event_date:
        "2025-05-31",

      local_reference:
        500,

      dj_reference:
        125,

      chairs:
        60,

      chair_unit_price:
        2,

      chair_total:
        120,

      tables:
        20,

      catering:
        "empresa pendiente/no especificada",

      reservation_advance_percent:
        50,

      document_quality:
        "plantilla/repeticiones/total final no visible",
    },

    confidence:
      "source",
  },

  {
    sourceId:
      "1rTe-rwcRKfo-1-MxNsFwKYQOKxgjVwtT5oiJyCTGopY",

    sourceName:
      "Presupuesto 2do Trimestre 2024",

    sourcePath:
      "PRESUPUESTOS / Presupuesto 2do Trimestre 2024",

    historyType:
      "data_conflict",

    title:
      "Bloques repetidos y cliente alternativo Michelle en presupuesto 2024",

    description:
      "El mismo documento repite el presupuesto y contiene bloques donde el nombre del cliente cambia a 'Michelle Apellidos' manteniendo otros datos iguales. Se conserva como conflicto/plantilla y no se interpreta como operación confirmada separada.",

    confidence:
      "conflict",

    data: {
      alternate_client:
        "Michelle Apellidos",

      repeated_event_date:
        "2025-05-31",

      repeated_guests:
        60,

      action:
        "no consolidar automáticamente",
    },
  },
];

async function main() {
  await hydrateSupabaseRuntime();

  console.log(
    "==============================================",
  );

  console.log(
    "DRIVE OPERATIONS BATCH 11",
  );

  console.log(
    "==============================================",
  );

  for (
    const operation
    of operations
  ) {
    await insertHistory(
      operation,
    );
  }

  console.log(
    "==============================================",
  );

  console.log(
    "BATCH_11_COMPLETE",
  );

  console.log(
    "==============================================",
  );
}

main().catch(
  error => {
    console.error(
      "BATCH_11_FAILED",
      error,
    );

    process.exitCode = 1;
  },
);
