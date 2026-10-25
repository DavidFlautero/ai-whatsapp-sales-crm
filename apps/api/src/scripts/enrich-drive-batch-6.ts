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

  return rows[0] ?? null;
}

async function ensureAzorProvider() {
  const existing =
    await providerByName(
      "Azor",
    );

  if (existing) {
    console.log(
      "[PROVIDER EXISTS] Azor",
    );

    return existing;
  }

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
          "Azor",

        contact_name:
          "Azor",

        phone:
          null,

        whatsapp:
          null,

        province:
          "Valencia",

        city:
          "Torrent",

        service_area:
          "Calicanto, Torrent, Valencia",

        notes:
          "Contacto indicado en documentación Drive para visitas del chalet de Calicanto. La carpeta fuente lo identifica como chalet del exmarido vinculado al entorno de Zoe; identidad legal no verificada.",
      },
    });

  if (!rows[0]) {
    throw new Error(
      "AZOR_PROVIDER_CREATE_FAILED",
    );
  }

  console.log(
    "[PROVIDER CREATED] Azor",
  );

  return rows[0];
}

async function ensureProfile(
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
    provider_type:
      "owner_contact",

    factual_summary:
      "Azor figura en la documentación de Google Drive como contacto para visitas de un chalet para eventos situado en Calicanto, zona Partida Barbeta.",

    commercial_relationship:
      "Contacto histórico de espacio asociado a Eventos Mediterráneo",

    commercial_conditions: {
      daily_price:
        850,

      included_schedule:
        "10:00-22:00",

      extra_hour:
        80,

      approximate_capacity:
        "45-50",

      commission_percent:
        20,

      maximum_night_time:
        "aprox. 02:00; documento también menciona 02:00-03:00 por vecinos",
    },

    known_preferences: [
      "Visitas con aviso previo",
      "Fiesta nocturna trasladada a discoteca interior",
      "Respeto de convivencia por proximidad de vecinos",
    ],

    service_categories: [
      "venue_owner_contact",
      "events",
    ],

    factual_notes:
      "No se dispone todavía de teléfono confirmado en el documento revisado. No fusionar automáticamente con Zoe ni con Rafa Calicanto.",

    source_metadata: {
      source:
        "google-drive",

      folder_id:
        "1_sjAJKNlly3_lnhl5fOSqc-dLDP4lISE",

      document_id:
        "1d_YCz8bGKvk6kIn5AdLBRNwxgtLJaBLNxLXsJrL4osk",
    },
  };

  if (rows[0]) {
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
      "[PROFILE UPDATED] Azor",
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

      ...body,
    },
  });

  console.log(
    "[PROFILE CREATED] Azor",
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

  return rows[0] ?? null;
}

async function upsertVenue(
  providerId: string,
) {
  const slug =
    "chalet-azor-calicanto";

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
      "Chalet Azor Calicanto",

    slug,

    status:
      "draft",

    description:
      "Chalet privado para eventos en Calicanto, Torrent. Cuenta con piscina, barbacoa, chill out, barra, discoteca y amplia zona exterior. Aforo aproximado de 45 a 50 personas.",

    province:
      "Valencia",

    city:
      "Torrent",

    address:
      "Partida Barbeta 130 M, Calicanto, Torrent, Valencia",

    capacity_min:
      45,

    capacity_max:
      50,

    max_event_guests:
      50,

    max_sleeping_guests:
      null,

    cost_from:
      850,

    client_price_from:
      850,

    currency:
      "EUR",

    features: [
      "Piscina",
      "Barbacoa",
      "Zona chill out",
      "Barra",
      "Discoteca privada",
      "Zona exterior completa",
      "Porsche decorativo/exposición",
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
      "Celebraciones",
      "Reuniones",
      "Eventos privados",
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
      "[VENUE UPDATED] Chalet Azor Calicanto",
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
      "AZOR_VENUE_CREATE_FAILED",
    );
  }

  console.log(
    "[VENUE CREATED] Chalet Azor Calicanto",
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
        "1_sjAJKNlly3_lnhl5fOSqc-dLDP4lISE",

      source_folder_path:
        "1-CHALETS / 3-villas grupos por dias / 2-AZOE CHALET DEL EXMARIDO DUEÑO",

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
    "DRIVE ENRICHMENT BATCH 6",
  );
  console.log(
    "==============================================",
  );

  const provider =
    await ensureAzorProvider();

  const providerId =
    String(
      provider.id,
    );

  await ensureProfile(
    providerId,
  );

  const venue =
    await upsertVenue(
      providerId,
    );

  const venueId =
    String(
      venue.id,
    );

  await addHistory({
    venueId,

    historyType:
      "information_update",

    title:
      "Ficha Chalet Calicanto Azor",

    sourceFileId:
      "1d_YCz8bGKvk6kIn5AdLBRNwxgtLJaBLNxLXsJrL4osk",

    sourceFileName:
      "Info de chalet calicanto",

    sourceModifiedAt:
      "2026-08-25T09:46:49.184Z",

    description:
      "Ficha operativa con ubicación, precio, horarios, aforo, zonas incluidas, música, visitas y comisión comercial.",

    newValue: {
      location:
        "Partida Barbeta 130 M, zona alta de Calicanto, Torrent",

      daily_price:
        850,

      included_hours:
        "10:00-22:00",

      extra_hour:
        80,

      capacity:
        "45-50",

      facilities: [
        "piscina",
        "barbacoa",
        "chill out",
        "barra",
        "discoteca",
        "exterior completo",
      ],

      contact_for_visits:
        "Azor",

      visit_hours:
        "10:00-22:00",

      commission_percent:
        20,
    },
  });

  await addHistory({
    venueId,

    historyType:
      "rule_update",

    title:
      "Reglas de música y horario Chalet Azor",

    sourceFileId:
      "1d_YCz8bGKvk6kIn5AdLBRNwxgtLJaBLNxLXsJrL4osk",

    sourceFileName:
      "Info de chalet calicanto",

    sourceModifiedAt:
      "2026-08-25T09:46:49.184Z",

    description:
      "La documentación establece transición de la celebración a la discoteca interior durante la noche y límite nocturno condicionado por vecinos.",

    newValue: {
      outside_music:
        "limitada según horario indicado en la fuente",

      indoor_disco_from:
        "aprox. 23:00",

      max_end_time:
        "02:00-03:00 según documento",

      reason:
        "vecinos",
    },
  });

  await addHistory({
    venueId,

    historyType:
      "commercial_agreement",

    title:
      "Comisión comercial Chalet Azor 20%",

    sourceFileId:
      "1d_YCz8bGKvk6kIn5AdLBRNwxgtLJaBLNxLXsJrL4osk",

    sourceFileName:
      "Info de chalet calicanto",

    sourceModifiedAt:
      "2026-08-25T09:46:49.184Z",

    description:
      "La ficha indica expresamente una comisión del 20% para Eventos Mediterráneo.",

    newValue: {
      commission_percent:
        20,
    },
  });

  await addHistory({
    venueId,

    historyType:
      "commercial_document",

    title:
      "Versión web Chalet Azor Calicanto",

    sourceFileId:
      "1eb5mVueZhFxZehulfxnbhVPTSFB7duIy_dv4uJZ2aRs",

    sourceFileName:
      "Info WB",

    sourceModifiedAt:
      "2026-05-29T11:02:35.892Z",

    description:
      "Documento comercial para web con características del espacio, aforo, normas generales y condiciones de uso nocturno.",
  });

  await addHistory({
    venueId,

    historyType:
      "identity_note",

    title:
      "Relación con carpeta Zoe pendiente de verificación",

    sourceFileId:
      "1d_YCz8bGKvk6kIn5AdLBRNwxgtLJaBLNxLXsJrL4osk",

    sourceFileName:
      "Info de chalet calicanto",

    sourceModifiedAt:
      "2026-08-25T09:46:49.184Z",

    confidence:
      "unverified",

    description:
      "La carpeta fuente está denominada como chalet del exmarido vinculado al entorno de Zoe. El documento operativo solo indica a Azor como contacto para visitas. No se asigna una relación personal/legal más específica hasta verificarla.",
  });

  await addHistory({
    venueId,

    historyType:
      "possible_duplicate",

    title:
      "Posible relación con otro chalet de Calicanto",

    sourceFileId:
      "1d_YCz8bGKvk6kIn5AdLBRNwxgtLJaBLNxLXsJrL4osk",

    sourceFileName:
      "Info de chalet calicanto",

    sourceModifiedAt:
      "2026-08-25T09:46:49.184Z",

    confidence:
      "unverified",

    description:
      "El CRM ya contiene otro espacio procedente de una carpeta distinta denominado Chalet Rafa Calicanto. No se fusionan porque las fuentes identifican contactos y carpetas diferentes.",
  });

  console.log(
    "==============================================",
  );
  console.log(
    "BATCH_6_COMPLETE",
  );
  console.log(
    "==============================================",
  );
}

main().catch(
  error => {
    console.error(
      "BATCH_6_FAILED",
      error,
    );

    process.exitCode = 1;
  },
);
