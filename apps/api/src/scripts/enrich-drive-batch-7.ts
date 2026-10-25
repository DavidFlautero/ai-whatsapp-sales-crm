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
      "RAFA_PROFILE_NOT_FOUND",
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
        "Rafa figura como propietario/gestor de una finca en Cumbres de Calicanto, Torrent, formada por chalet principal y apartamento independiente.",

      commercial_relationship:
        "Propietario histórico vinculado a Eventos Mediterráneo",

      commercial_conditions: {
        property_sale_reference:
          500000,

        notary:
          "Rafa se encarga según nota histórica",

        main_house_built_m2:
          460,

        plot_m2:
          1596,

        main_house_bedrooms:
          7,

        main_house_bathrooms:
          3,

        apartment_bedrooms:
          4,

        apartment_bathrooms:
          2,
      },

      known_preferences: [
        "Contacto directo para visitas",
      ],

      service_categories: [
        "venue_owner",
        "property",
        "accommodation",
      ],

      factual_notes:
        "La documentación revisada identifica esta propiedad en Calle Paiporta 77, Cumbres de Calicanto. Es distinta del chalet Azor en Partida Barbeta 130 M.",

      source_metadata: {
        source:
          "google-drive",

        folder_id:
          "1wqi-tTUlTjEui4sCjpe5609bml7pLtF3",

        primary_document_id:
          "1EGjrAjC4aBM2Xx977HnZb-HCL2HlbHeDjNyZ6jnivX0",
      },
    },
  });

  console.log(
    "[PROFILE UPDATED] Rafa",
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
        "Chalet Rafa Cumbres de Calicanto",

      status:
        "draft",

      province:
        "Valencia",

      city:
        "Torrent",

      address:
        "Calle Paiporta 77, Cumbres de Calicanto, Torrent, Valencia",

      description:
        "Finca en Cumbres de Calicanto gestionada por Rafa. Chalet principal de 460 m² sobre parcela de 1.596 m², con 7 habitaciones y 3 baños, más apartamento independiente con 4 habitaciones y 2 baños. Piscina privada, garaje, trastero, terrazas y conectividad de alta velocidad.",

      features: [
        "Piscina privada",
        "Aseo exterior en piscina",
        "460 m² construidos",
        "Parcela de 1.596 m²",
        "3 plantas",
        "7 habitaciones chalet principal",
        "3 baños chalet principal",
        "Apartamento independiente",
        "4 habitaciones apartamento",
        "2 baños apartamento",
        "Terrazas",
        "Balcón",
        "Garaje",
        "Trastero",
        "Armarios empotrados",
        "Aire acondicionado",
        "WiFi alta velocidad",
        "Línea telefónica",
      ],

      rental_modes: [
        "overnight",
        "multi_day",
      ],

      suitable_for: [
        "Alojamiento",
        "Escapadas",
        "Familias",
        "Grupos",
      ],
    },
  });

  console.log(
    "[VENUE UPDATED] Chalet Rafa Cumbres de Calicanto",
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
        "1wqi-tTUlTjEui4sCjpe5609bml7pLtF3",

      source_folder_path:
        "1-CHALETS / 2. ALQUILER POR DIA / Rafa dueño Chalet calicanto Rafa",

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
    "DRIVE ENRICHMENT BATCH 7",
  );
  console.log(
    "==============================================",
  );

  const provider =
    await providerByName(
      "Rafa",
    );

  const providerId =
    String(
      provider.id,
    );

  const venue =
    await venueBySlug(
      "chalet-calicanto-rafa",
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
      "Ficha inmobiliaria Chalet Rafa Calicanto",

    sourceFileId:
      "1EGjrAjC4aBM2Xx977HnZb-HCL2HlbHeDjNyZ6jnivX0",

    sourceFileName:
      "Información",

    sourceModifiedAt:
      "2025-11-06T11:57:06.990Z",

    description:
      "Ficha de propiedad con dimensiones, distribución, equipamiento, reformas, propietario y ubicación.",

    newValue: {
      owner:
        "Rafa",

      address:
        "Calle Paiporta 77, Cumbres de Calicanto, Torrent",

      built_m2:
        460,

      plot_m2:
        1596,

      floors:
        3,

      main_bedrooms:
        7,

      main_bathrooms:
        3,

      pool_toilet:
        1,

      apartment_bedrooms:
        4,

      apartment_bathrooms:
        2,

      built_year:
        1982,

      renovation_investment:
        "aprox. 30.000 EUR en los dos años anteriores a la ficha",

      amenities: [
        "piscina",
        "garaje",
        "trastero",
        "aire acondicionado",
        "wifi alta velocidad",
        "línea telefónica",
      ],
    },
  });

  await addHistory({
    venueId,

    historyType:
      "sale_reference",

    title:
      "Referencia histórica de venta 500.000 €",

    sourceFileId:
      "1EGjrAjC4aBM2Xx977HnZb-HCL2HlbHeDjNyZ6jnivX0",

    sourceFileName:
      "Información",

    sourceModifiedAt:
      "2025-11-06T11:57:06.990Z",

    description:
      "La ficha contiene la nota '500.000 € para Rafa' y que Rafa se encarga de notaría. Se conserva como referencia histórica de venta y no como tarifa de alquiler.",

    newValue: {
      sale_reference:
        500000,

      currency:
        "EUR",

      notary:
        "Rafa se encarga",
    },
  });

  await addHistory({
    venueId,

    historyType:
      "commercial_document",

    title:
      "Versión web Cumbres de Calicanto Rafa",

    sourceFileId:
      "1XR7jNjdit6Pux2ODnGetbKFWxOdT_VnuTIC-G1i15OM",

    sourceFileName:
      "web: Espectacular Chalet Independiente en Cumbres de Calicanto, Torrent",

    sourceModifiedAt:
      "2026-09-19T12:30:34.202Z",

    description:
      "Versión web reciente que confirma propiedad gestionada por Rafa, dirección, dimensiones, chalet principal, apartamento independiente y reformas.",
  });

  await addHistory({
    venueId,

    historyType:
      "external_listing",

    title:
      "Enlaces históricos de Booking asociados",

    sourceFileId:
      "1EGjrAjC4aBM2Xx977HnZb-HCL2HlbHeDjNyZ6jnivX0",

    sourceFileName:
      "Información",

    sourceModifiedAt:
      "2025-11-06T11:57:06.990Z",

    description:
      "La ficha conserva varios enlaces de Booking asociados a la propiedad. Se guardan como referencia histórica sin asumir que continúan activos.",

    newValue: {
      booking_links: [
        "https://www.booking.com/Pulse-KVl00N",
        "https://www.booking.com/Pulse-RRtajF",
        "https://www.booking.com/Pulse-6C18xO",
        "https://www.booking.com/Pulse-dVVrN8",
      ],
    },
  });

  await addHistory({
    venueId,

    historyType:
      "duplicate_resolved",

    title:
      "Azor Calicanto y Rafa Calicanto confirmados como espacios distintos",

    sourceFileId:
      "1XR7jNjdit6Pux2ODnGetbKFWxOdT_VnuTIC-G1i15OM",

    sourceFileName:
      "web: Espectacular Chalet Independiente en Cumbres de Calicanto, Torrent",

    sourceModifiedAt:
      "2026-09-19T12:30:34.202Z",

    description:
      "La documentación de Rafa sitúa este inmueble en Calle Paiporta 77, Cumbres de Calicanto. El chalet Azor está documentado en Partida Barbeta 130 M. Por tanto se mantienen como venues distintos.",

    newValue: {
      rafa_address:
        "Calle Paiporta 77",

      azor_address:
        "Partida Barbeta 130 M",

      merge:
        false,
    },
  });

  await addHistory({
    venueId,

    historyType:
      "availability_document",

    title:
      "Documento Fecha libre sin contenido textual",

    sourceFileId:
      "1CbJoi8S6VoLpf9sXWwbByDFHKUFapxp9X8T049s2lug",

    sourceFileName:
      "Fecha libre",

    sourceModifiedAt:
      "2026-07-26T18:13:53.413Z",

    confidence:
      "unverified",

    description:
      "Existe un documento denominado 'Fecha libre', pero la lectura actual no contiene texto utilizable. No se infiere disponibilidad.",
  });

  console.log(
    "==============================================",
  );
  console.log(
    "BATCH_7_COMPLETE",
  );
  console.log(
    "==============================================",
  );
}

main().catch(
  error => {
    console.error(
      "BATCH_7_FAILED",
      error,
    );

    process.exitCode = 1;
  },
);
