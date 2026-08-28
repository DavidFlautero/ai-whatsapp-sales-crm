import {
  supabaseRequest,
} from "../db/supabase-rest.client.js";


export type CatalogSource =
  | "ninox"
  | "panel";


export type AfterHoursMode =
  | "ai"
  | "ai_with_notice"
  | "closed_message";


export type BusinessDay = {
  enabled: boolean;
  start: string;
  end: string;
};


export type BusinessHours = {
  monday: BusinessDay;
  tuesday: BusinessDay;
  wednesday: BusinessDay;
  thursday: BusinessDay;
  friday: BusinessDay;
  saturday: BusinessDay;
  sunday: BusinessDay;
};


export type WhatsappBusinessSettings = {
  catalogSource:
    CatalogSource;

  /*
   * El catálogo visual de Meta,
   * cuando exista, se alimentará
   * exclusivamente desde nuestro panel.
   */
  metaCatalogSource:
    "panel";

  timezone:
    string;

  afterHoursMode:
    AfterHoursMode;

  afterHoursMessage:
    string;

  welcomeMessage:
    string;

  businessHours:
    BusinessHours;
};


export type WhatsappBusinessSettingsInput = {
  catalogSource?:
    CatalogSource;

  timezone?:
    string;

  afterHoursMode?:
    AfterHoursMode;

  afterHoursMessage?:
    string;

  welcomeMessage?:
    string;

  businessHours?: {
    monday?: Partial<BusinessDay>;
    tuesday?: Partial<BusinessDay>;
    wednesday?: Partial<BusinessDay>;
    thursday?: Partial<BusinessDay>;
    friday?: Partial<BusinessDay>;
    saturday?: Partial<BusinessDay>;
    sunday?: Partial<BusinessDay>;
  };
};


type BusinessSettingsRow = {
  company_id:
    string;

  metadata?:
    Record<string, unknown>
    | null;
};


export const DEFAULT_WHATSAPP_BUSINESS_SETTINGS:
WhatsappBusinessSettings = {
  /*
   * Fulanitas sigue hoy con Ninox.
   * No lo cambiamos automáticamente
   * antes del smoke test.
   */
  catalogSource:
    "ninox",

  metaCatalogSource:
    "panel",

  timezone:
    "America/Argentina/Buenos_Aires",

  afterHoursMode:
    "ai_with_notice",

  afterHoursMessage:
    "En este momento estamos fuera del horario comercial, pero puedo ayudarte igual y dejar todo preparado.",

  welcomeMessage:
    "¡Hola! ¿En qué podemos ayudarte?",

  businessHours: {
    monday: {
      enabled: true,
      start: "09:00",
      end: "18:00",
    },

    tuesday: {
      enabled: true,
      start: "09:00",
      end: "18:00",
    },

    wednesday: {
      enabled: true,
      start: "09:00",
      end: "18:00",
    },

    thursday: {
      enabled: true,
      start: "09:00",
      end: "18:00",
    },

    friday: {
      enabled: true,
      start: "09:00",
      end: "18:00",
    },

    saturday: {
      enabled: false,
      start: "09:00",
      end: "13:00",
    },

    sunday: {
      enabled: false,
      start: "09:00",
      end: "13:00",
    },
  },
};


function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value),
  );
}


function asCatalogSource(
  value: unknown,
): CatalogSource | undefined {
  if (
    value === "ninox"
    || value === "panel"
  ) {
    return value;
  }

  return undefined;
}


function asAfterHoursMode(
  value: unknown,
): AfterHoursMode | undefined {
  if (
    value === "ai"
    || value === "ai_with_notice"
    || value === "closed_message"
  ) {
    return value;
  }

  return undefined;
}


function asString(
  value: unknown,
): string | undefined {
  return typeof value === "string"
    ? value
    : undefined;
}


function normalizeDay(
  input:
    Record<string, unknown>
    | undefined,

  fallback:
    BusinessDay,
): BusinessDay {
  return {
    enabled:
      typeof input?.enabled
        === "boolean"
        ? input.enabled
        : fallback.enabled,

    start:
      asString(
        input?.start,
      )
      ?? fallback.start,

    end:
      asString(
        input?.end,
      )
      ?? fallback.end,
  };
}


function mergeSettings(
  raw:
    Record<string, unknown>
    | null
    | undefined,
): WhatsappBusinessSettings {
  const hours =
    isObject(
      raw?.businessHours,
    )
      ? raw.businessHours
      : {};

  return {
    catalogSource:
      asCatalogSource(
        raw?.catalogSource,
      )
      ?? DEFAULT_WHATSAPP_BUSINESS_SETTINGS
        .catalogSource,

    /*
     * Esto queda fijo.
     * Meta nunca toma Ninox directamente.
     */
    metaCatalogSource:
      "panel",

    timezone:
      asString(
        raw?.timezone,
      )
      ?? DEFAULT_WHATSAPP_BUSINESS_SETTINGS
        .timezone,

    afterHoursMode:
      asAfterHoursMode(
        raw?.afterHoursMode,
      )
      ?? DEFAULT_WHATSAPP_BUSINESS_SETTINGS
        .afterHoursMode,

    afterHoursMessage:
      asString(
        raw?.afterHoursMessage,
      )
      ?? DEFAULT_WHATSAPP_BUSINESS_SETTINGS
        .afterHoursMessage,

    welcomeMessage:
      asString(
        raw?.welcomeMessage,
      )
      ?? DEFAULT_WHATSAPP_BUSINESS_SETTINGS
        .welcomeMessage,

    businessHours: {
      monday:
        normalizeDay(
          isObject(hours.monday)
            ? hours.monday
            : undefined,

          DEFAULT_WHATSAPP_BUSINESS_SETTINGS
            .businessHours
            .monday,
        ),

      tuesday:
        normalizeDay(
          isObject(hours.tuesday)
            ? hours.tuesday
            : undefined,

          DEFAULT_WHATSAPP_BUSINESS_SETTINGS
            .businessHours
            .tuesday,
        ),

      wednesday:
        normalizeDay(
          isObject(hours.wednesday)
            ? hours.wednesday
            : undefined,

          DEFAULT_WHATSAPP_BUSINESS_SETTINGS
            .businessHours
            .wednesday,
        ),

      thursday:
        normalizeDay(
          isObject(hours.thursday)
            ? hours.thursday
            : undefined,

          DEFAULT_WHATSAPP_BUSINESS_SETTINGS
            .businessHours
            .thursday,
        ),

      friday:
        normalizeDay(
          isObject(hours.friday)
            ? hours.friday
            : undefined,

          DEFAULT_WHATSAPP_BUSINESS_SETTINGS
            .businessHours
            .friday,
        ),

      saturday:
        normalizeDay(
          isObject(hours.saturday)
            ? hours.saturday
            : undefined,

          DEFAULT_WHATSAPP_BUSINESS_SETTINGS
            .businessHours
            .saturday,
        ),

      sunday:
        normalizeDay(
          isObject(hours.sunday)
            ? hours.sunday
            : undefined,

          DEFAULT_WHATSAPP_BUSINESS_SETTINGS
            .businessHours
            .sunday,
        ),
    },
  };
}


function inputToRaw(
  current:
    WhatsappBusinessSettings,

  input:
    WhatsappBusinessSettingsInput,
): Record<string, unknown> {
  return {
    catalogSource:
      input.catalogSource
      ?? current.catalogSource,

    metaCatalogSource:
      "panel",

    timezone:
      input.timezone
      ?? current.timezone,

    afterHoursMode:
      input.afterHoursMode
      ?? current.afterHoursMode,

    afterHoursMessage:
      input.afterHoursMessage
      ?? current.afterHoursMessage,

    welcomeMessage:
      input.welcomeMessage
      ?? current.welcomeMessage,

    businessHours: {
      monday: {
        ...current.businessHours.monday,
        ...input.businessHours?.monday,
      },

      tuesday: {
        ...current.businessHours.tuesday,
        ...input.businessHours?.tuesday,
      },

      wednesday: {
        ...current.businessHours.wednesday,
        ...input.businessHours?.wednesday,
      },

      thursday: {
        ...current.businessHours.thursday,
        ...input.businessHours?.thursday,
      },

      friday: {
        ...current.businessHours.friday,
        ...input.businessHours?.friday,
      },

      saturday: {
        ...current.businessHours.saturday,
        ...input.businessHours?.saturday,
      },

      sunday: {
        ...current.businessHours.sunday,
        ...input.businessHours?.sunday,
      },
    },
  };
}


export async function getWhatsappBusinessSettings(
  companyId: string,
): Promise<WhatsappBusinessSettings> {
  const rows =
    await supabaseRequest<
      BusinessSettingsRow[]
    >({
      table:
        "commerce_business_settings",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + "&select=company_id,metadata"
        + "&limit=1",
    });

  const metadata =
    rows[0]?.metadata
    ?? {};

  const raw =
    isObject(
      metadata.whatsapp_business,
    )
      ? metadata.whatsapp_business
      : null;

  return mergeSettings(
    raw,
  );
}


export async function saveWhatsappBusinessSettings(
  companyId: string,
  input:
    WhatsappBusinessSettingsInput,
): Promise<WhatsappBusinessSettings> {
  const rows =
    await supabaseRequest<
      BusinessSettingsRow[]
    >({
      table:
        "commerce_business_settings",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + "&select=company_id,metadata"
        + "&limit=1",
    });

  const existing =
    rows[0];

  const current =
    await getWhatsappBusinessSettings(
      companyId,
    );

  const next =
    mergeSettings(
      inputToRaw(
        current,
        input,
      ),
    );

  const metadata = {
    ...(
      existing?.metadata
      ?? {}
    ),

    whatsapp_business:
      next,
  };

  if (existing) {
    await supabaseRequest({
      table:
        "commerce_business_settings",

      method:
        "PATCH",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`,

      body: {
        metadata,

        updated_at:
          new Date()
            .toISOString(),
      },
    });
  } else {
    await supabaseRequest({
      table:
        "commerce_business_settings",

      method:
        "POST",

      body: [
        {
          company_id:
            companyId,

          metadata,
        },
      ],
    });
  }

  return next;
}


export async function getWhatsappCatalogSource(
  companyId: string,
): Promise<CatalogSource> {
  const settings =
    await getWhatsappBusinessSettings(
      companyId,
    );

  return settings.catalogSource;
}


function timeToMinutes(
  value: string,
): number {
  const [
    hourText,
    minuteText,
  ] =
    value.split(":");

  const hours =
    Number(
      hourText
      ?? 0,
    );

  const minutes =
    Number(
      minuteText
      ?? 0,
    );

  return (
    (
      Number.isFinite(hours)
        ? hours
        : 0
    )
    * 60
    + (
      Number.isFinite(minutes)
        ? minutes
        : 0
    )
  );
}


export async function buildWhatsappBusinessRuntimeContext(
  companyId: string,
): Promise<string> {
  const settings =
    await getWhatsappBusinessSettings(
      companyId,
    );

  const now =
    new Date();

  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          settings.timezone,

        weekday:
          "long",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hour12:
          false,
      },
    );

  const parts =
    formatter.formatToParts(
      now,
    );

  const weekday =
    parts.find(
      (part) =>
        part.type === "weekday",
    )
      ?.value
      ?.toLowerCase()
    ?? "";

  const hour =
    Number(
      parts.find(
        (part) =>
          part.type === "hour",
      )
        ?.value
      ?? 0,
    );

  const minute =
    Number(
      parts.find(
        (part) =>
          part.type === "minute",
      )
        ?.value
      ?? 0,
    );

  let day:
    BusinessDay
    | null = null;

  if (weekday === "monday") {
    day =
      settings.businessHours.monday;
  } else if (
    weekday === "tuesday"
  ) {
    day =
      settings.businessHours.tuesday;
  } else if (
    weekday === "wednesday"
  ) {
    day =
      settings.businessHours.wednesday;
  } else if (
    weekday === "thursday"
  ) {
    day =
      settings.businessHours.thursday;
  } else if (
    weekday === "friday"
  ) {
    day =
      settings.businessHours.friday;
  } else if (
    weekday === "saturday"
  ) {
    day =
      settings.businessHours.saturday;
  } else if (
    weekday === "sunday"
  ) {
    day =
      settings.businessHours.sunday;
  }

  const currentMinutes =
    hour * 60
    + minute;

  const open =
    Boolean(
      day?.enabled
      && currentMinutes
        >= timeToMinutes(
          day.start,
        )
      && currentMinutes
        < timeToMinutes(
          day.end,
        ),
    );

  const lines = [
    "CONFIGURACIÓN OPERATIVA DE WHATSAPP:",
    `Fuente de catálogo activa: ${settings.catalogSource}.`,
    `Catálogo Meta: ${settings.metaCatalogSource}.`,
    `Horario comercial ahora: ${open ? "ABIERTO" : "CERRADO"}.`,
    `Modo fuera de horario: ${settings.afterHoursMode}.`,
  ];

  if (
    !open
    && settings.afterHoursMode
      !== "ai"
  ) {
    lines.push(
      `Mensaje fuera de horario: "${settings.afterHoursMessage}"`,
    );
  }

  if (
    !open
    && settings.afterHoursMode
      === "closed_message"
  ) {
    lines.push(
      "Fuera de horario no iniciar ventas nuevas. Informar el horario y dejar registrada la consulta.",
    );
  }

  if (
    !open
    && settings.afterHoursMode
      === "ai_with_notice"
  ) {
    lines.push(
      "Avisar una sola vez que el negocio está fuera de horario y continuar atendiendo normalmente con IA.",
    );
  }

  return lines.join(
    "\n",
  );
}
