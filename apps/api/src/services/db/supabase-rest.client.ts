import { env } from "../../config/env.js";

export function isSupabaseConfigured() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}


export function isVoiceSupabaseConfigured() {
  const driver =
    process.env.VOICE_STORAGE_DRIVER?.trim().toLowerCase();

  return (
    driver !== "memory"
    && isSupabaseConfigured()
  );
}

export async function supabaseRequest<T>
    (input: {
  table: string;
  method?: "GET" | "POST" | "PATCH";
  query?: string;
  body?: unknown;
  prefer?: string;
}): Promise<T> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase is not configured");
  }

  const url = `${env.SUPABASE_URL}/rest/v1/${input.table}${input.query ?? ""}`;

  const res = await fetch(url, {
    method: input.method ?? "GET",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: input.prefer ?? "return=representation"
    },
    body: input.body ? JSON.stringify(input.body) : undefined
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    console.error(
      "[SUPABASE ERROR]",
      {
        status:
          res.status,

        table:
          input.table,

        method:
          input.method
          ?? "GET",
      },
    );
    throw new Error("Supabase request failed");
  }

  return data as T;
}


export class SupabaseRpcError extends Error {
  readonly functionName: string;
  readonly status: number;
  readonly code: string | null;
  readonly details: unknown;

  constructor(input: {
    functionName: string;
    status: number;
    code?: string | null;
    message: string;
    details?: unknown;
  }) {
    super(input.message);

    this.name = "SupabaseRpcError";
    this.functionName =
      input.functionName;
    this.status =
      input.status;
    this.code =
      input.code ?? null;
    this.details =
      input.details ?? null;
  }
}


export async function supabaseRpc<T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  if (
    !env.SUPABASE_URL
    || !env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      "Supabase is not configured",
    );
  }

  const baseUrl =
    env.SUPABASE_URL.replace(
      /\/+$/,
      "",
    );

  const url =
    `${baseUrl}/rest/v1/rpc/${encodeURIComponent(
      functionName,
    )}`;

  const response =
    await fetch(
      url,
      {
        method: "POST",

        headers: {
          apikey:
            env.SUPABASE_SERVICE_ROLE_KEY,

          Authorization:
            `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,

          "Content-Type":
            "application/json",

          Prefer:
            "return=representation",
        },

        body:
          JSON.stringify(body),
      },
    );

  const text =
    await response.text();

  let data:
    unknown = null;

  if (text) {
    try {
      data =
        JSON.parse(text);
    } catch {
      data =
        text;
    }
  }

  if (!response.ok) {
    console.error(
      "[SUPABASE RPC ERROR]",
      {
        functionName,
        status:
          response.status,
        data,
      },
    );

    const rpcData =
      data
      && typeof data === "object"
        ? data as Record<string, unknown>
        : null;

    throw new SupabaseRpcError({
      functionName,
      status:
        response.status,
      code:
        typeof rpcData?.code === "string"
          ? rpcData.code
          : null,
      message:
        typeof rpcData?.message === "string"
          ? rpcData.message
          : `Supabase RPC failed: ${functionName}`,
      details:
        rpcData?.details ?? data,
    });
  }

  return data as T;
}
