import { cookies } from "next/headers";

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

export type SystemStatus = {
  ok: boolean;
  allOnline: boolean;
  timestamp: string;
  services: {
    whatsapp: ConnectionCheck;
    claude: ConnectionCheck;
    supabase: ConnectionCheck;
    ninox: ConnectionCheck;
    audio: ConnectionCheck;
  };
};

function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:4000"
  ).replace(/\/+$/, "");
}

async function getForwardedCookieHeader(): Promise<string> {
  const cookieStore = await cookies();

  return cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
}

async function authenticatedFetch(
  pathname: string,
  init: RequestInit = {},
) {
  const cookieHeader = await getForwardedCookieHeader();

  const headers = new Headers(init.headers);

  if (cookieHeader) {
    headers.set("Cookie", cookieHeader);
  }

  headers.set("Accept", "application/json");

  return fetch(`${getApiBaseUrl()}${pathname}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

export async function getAdminOverview() {
  const response = await authenticatedFetch(
    "/admin/overview",
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load admin overview (${response.status})`,
    );
  }

  return response.json();
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const response = await authenticatedFetch(
    "/admin/status",
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load system status (${response.status})`,
    );
  }

  return response.json() as Promise<SystemStatus>;
}
