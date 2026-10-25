export type Config = {
  supabaseUrl: string;
  serviceKey: string;
  companyId: string;
  writeEnabled: boolean;
  aiEnabled: boolean;
  openaiKey: string;
  openaiModel: string;
  startAt: string;
  pollMs: number;
};

function enabled(value?: string): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function loadConfig(): Config {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_REST_URL ||
    ""
  ).replace(/\/$/, "");

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "";

  const companyId =
    process.env.CM_COMPANY_ID ||
    process.env.DEFAULT_COMPANY_ID ||
    "";

  if (!url || !serviceKey || !companyId) {
    throw new Error("CM_CONFIG_MISSING");
  }

  if (!/^[-_a-zA-Z0-9]{2,128}$/.test(companyId)) {
    throw new Error("CM_INVALID_COMPANY_ID");
  }

  const startAt =
    process.env.CM_START_AT ||
    "2026-01-01T00:00:00.000Z";

  if (!Number.isFinite(Date.parse(startAt))) {
    throw new Error("CM_INVALID_START_AT");
  }

  const pollMs = Math.max(
    10000,
    Math.min(
      600000,
      Number(process.env.CM_POLL_MS || 30000) || 30000,
    ),
  );

  const openaiKey = process.env.OPENAI_API_KEY || "";

  return {
    supabaseUrl: url.endsWith("/rest/v1")
      ? url
      : `${url}/rest/v1`,
    serviceKey,
    companyId,
    writeEnabled: enabled(process.env.CM_WRITE_ENABLED),
    aiEnabled: enabled(process.env.CM_AI_ENABLED),
    openaiKey,
    openaiModel:
      process.env.CM_OPENAI_MODEL || "gpt-4o-mini",
    startAt: new Date(startAt).toISOString(),
    pollMs,
  };
}
