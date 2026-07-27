import { env } from "../../config/env.js";

export type ConnectionStatus =
  | "online"
  | "missing_config"
  | "invalid_credentials"
  | "invalid_config"
  | "degraded"
  | "unreachable"
  | "error";

export type ConnectionCheck = {
  status: ConnectionStatus;
  configured: boolean;
  checkedAt: string;
  latencyMs: number | null;
  message: string;
  details?: Record<string, string | number | boolean | null>;
};

const CHECK_TIMEOUT_MS = 8_000;

function mask(value?: string) {
  if (!value) return { configured: false, preview: null };
  return {
    configured: true,
    preview: `••••${value.slice(-6)}`
  };
}

function now() {
  return new Date().toISOString();
}

function missingConfig(message: string): ConnectionCheck {
  return {
    status: "missing_config",
    configured: false,
    checkedAt: now(),
    latencyMs: null,
    message
  };
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "La conexión superó el tiempo máximo de espera.";
  }

  return "No fue posible contactar el servicio.";
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function failedCheck(
  response: Response,
  provider: string,
  latencyMs: number
): ConnectionCheck {
  if (response.status === 401 || response.status === 403) {
    return {
      status: "invalid_credentials",
      configured: true,
      checkedAt: now(),
      latencyMs,
      message: `${provider} rechazó las credenciales.`
    };
  }

  if (response.status === 400 || response.status === 404) {
    return {
      status: "invalid_config",
      configured: true,
      checkedAt: now(),
      latencyMs,
      message: `${provider} respondió, pero la configuración no coincide con un recurso válido.`
    };
  }

  if (response.status === 408 || response.status === 429 || response.status >= 500) {
    return {
      status: "degraded",
      configured: true,
      checkedAt: now(),
      latencyMs,
      message: `${provider} respondió con disponibilidad limitada (HTTP ${response.status}).`
    };
  }

  return {
    status: "error",
    configured: true,
    checkedAt: now(),
    latencyMs,
    message: `${provider} respondió con HTTP ${response.status}.`
  };
}

async function checkWhatsApp(): Promise<ConnectionCheck> {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    return missingConfig("Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID.");
  }

  const startedAt = Date.now();
  const version = (env.WHATSAPP_GRAPH_VERSION || "v25.0").replace(/^\/?/, "");
  const phoneNumberId = encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID);
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`;

  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_TOKEN}`
      }
    });
    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      let metaErrorCode: number | null = null;

      try {
        const errorBody = (await response.clone().json()) as { error?: { code?: number } };
        metaErrorCode = errorBody.error?.code ?? null;
      } catch {
        metaErrorCode = null;
      }

      if (metaErrorCode === 190) {
        return {
          status: "invalid_credentials",
          configured: true,
          checkedAt: now(),
          latencyMs,
          message: "Meta rechazó el token de WhatsApp; está vencido, eliminado o no pertenece a esta app."
        };
      }

      return failedCheck(response, "WhatsApp Cloud API", latencyMs);
    }

    const data = (await response.json()) as Record<string, unknown>;

    return {
      status: "online",
      configured: true,
      checkedAt: now(),
      latencyMs,
      message: "Token y Phone Number ID validados contra Meta.",
      details: {
        displayPhoneNumber:
          typeof data.display_phone_number === "string" ? data.display_phone_number : null,
        verifiedName: typeof data.verified_name === "string" ? data.verified_name : null,
        qualityRating: typeof data.quality_rating === "string" ? data.quality_rating : null
      }
    };
  } catch (error) {
    return {
      status: "unreachable",
      configured: true,
      checkedAt: now(),
      latencyMs: Date.now() - startedAt,
      message: errorMessage(error)
    };
  }
}

async function checkClaude(): Promise<ConnectionCheck> {
  if (!env.ANTHROPIC_API_KEY) {
    return missingConfig("Falta ANTHROPIC_API_KEY.");
  }

  const startedAt = Date.now();

  try {
    const response = await fetchWithTimeout("https://api.anthropic.com/v1/models?limit=1", {
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      }
    });
    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      return failedCheck(response, "Claude", latencyMs);
    }

    const data = (await response.json()) as {
      data?: Array<{ id?: string; display_name?: string }>;
    };
    const firstModel = data.data?.[0];

    return {
      status: "online",
      configured: true,
      checkedAt: now(),
      latencyMs,
      message: "La API key de Claude es válida.",
      details: {
        model: firstModel?.display_name ?? firstModel?.id ?? null
      }
    };
  } catch (error) {
    return {
      status: "unreachable",
      configured: true,
      checkedAt: now(),
      latencyMs: Date.now() - startedAt,
      message: errorMessage(error)
    };
  }
}

async function checkSupabase(): Promise<ConnectionCheck> {
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_ANON_KEY;

  if (!env.SUPABASE_URL || !key) {
    return missingConfig("Faltan SUPABASE_URL y una API key de Supabase.");
  }

  const startedAt = Date.now();
  const baseUrl = env.SUPABASE_URL.replace(/\/+$/, "");

  try {
    const response = await fetchWithTimeout(`${baseUrl}/auth/v1/health`, {
      headers: {
        apikey: key
      }
    });
    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      return failedCheck(response, "Supabase", latencyMs);
    }

    const data = (await response.json()) as Record<string, unknown>;

    return {
      status: "online",
      configured: true,
      checkedAt: now(),
      latencyMs,
      message: "Proyecto y API key de Supabase validados.",
      details: {
        service: typeof data.name === "string" ? data.name : "Auth",
        version: typeof data.version === "string" ? data.version : null
      }
    };
  } catch (error) {
    return {
      status: "unreachable",
      configured: true,
      checkedAt: now(),
      latencyMs: Date.now() - startedAt,
      message: errorMessage(error)
    };
  }
}

async function checkNinox(): Promise<ConnectionCheck> {
  if (!env.NINOX_API_KEY) {
    return missingConfig("Falta NINOX_API_KEY.");
  }

  const startedAt = Date.now();
  const baseUrl = (env.NINOX_BASE_URL || "https://api.ninox.com/v1").replace(/\/+$/, "");
  const url = baseUrl.endsWith("/teams") ? baseUrl : `${baseUrl}/teams`;

  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        Authorization: `Bearer ${env.NINOX_API_KEY}`,
        "Content-Type": "application/json"
      }
    });
    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      return failedCheck(response, "Ninox", latencyMs);
    }

    const data = (await response.json()) as unknown;

    return {
      status: "online",
      configured: true,
      checkedAt: now(),
      latencyMs,
      message: "La API key de Ninox es válida.",
      details: {
        workspaces: Array.isArray(data) ? data.length : null
      }
    };
  } catch (error) {
    return {
      status: "unreachable",
      configured: true,
      checkedAt: now(),
      latencyMs: Date.now() - startedAt,
      message: errorMessage(error)
    };
  }
}

async function checkAudioTranscription(): Promise<ConnectionCheck> {
  const provider = env.GROQ_API_KEY ? "Groq" : env.OPENAI_API_KEY ? "OpenAI" : null;
  const key = env.GROQ_API_KEY ?? env.OPENAI_API_KEY;

  if (!provider || !key) {
    return missingConfig("Falta GROQ_API_KEY u OPENAI_API_KEY para transcripción.");
  }

  const startedAt = Date.now();
  const url =
    provider === "Groq"
      ? "https://api.groq.com/openai/v1/models"
      : "https://api.openai.com/v1/models";

  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        Authorization: `Bearer ${key}`
      }
    });
    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      return failedCheck(response, provider, latencyMs);
    }

    return {
      status: "online",
      configured: true,
      checkedAt: now(),
      latencyMs,
      message: `Credencial de ${provider} validada para el servicio de audio.`,
      details: {
        provider
      }
    };
  } catch (error) {
    return {
      status: "unreachable",
      configured: true,
      checkedAt: now(),
      latencyMs: Date.now() - startedAt,
      message: errorMessage(error)
    };
  }
}

export async function getSystemStatus() {
  const [whatsapp, claude, supabase, ninox, audio] = await Promise.all([
    checkWhatsApp(),
    checkClaude(),
    checkSupabase(),
    checkNinox(),
    checkAudioTranscription()
  ]);

  const services = {
    whatsapp: {
      ...whatsapp,
      token: mask(env.WHATSAPP_TOKEN),
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID ?? null,
      businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? null
    },
    claude: {
      ...claude,
      apiKey: mask(env.ANTHROPIC_API_KEY)
    },
    supabase: {
      ...supabase,
      url: env.SUPABASE_URL ?? null,
      apiKey: mask(env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_ANON_KEY)
    },
    ninox: {
      ...ninox,
      apiKey: mask(env.NINOX_API_KEY),
      baseUrl: env.NINOX_BASE_URL || "https://api.ninox.com/v1"
    },
    audio,
    database: {
      status: env.DATABASE_URL ? "configured" : "pending",
      configured: Boolean(env.DATABASE_URL),
      url: mask(env.DATABASE_URL)
    },
    webhook: {
      verifyToken: mask(env.WHATSAPP_VERIFY_TOKEN)
    }
  };

  return {
    ok: true,
    allOnline: [whatsapp, claude, supabase, ninox, audio].every(
      (service) => service.status === "online"
    ),
    timestamp: now(),
    services
  };
}
