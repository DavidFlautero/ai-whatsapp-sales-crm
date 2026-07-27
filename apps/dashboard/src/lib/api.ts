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
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
}

export async function getAdminOverview() {
  const res = await fetch(`${getApiBaseUrl()}/admin/overview`, {
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error("Failed to load admin overview");
  }

  return res.json();
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const res = await fetch(`${getApiBaseUrl()}/admin/status`, {
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`Failed to load system status (${res.status})`);
  }

  return res.json() as Promise<SystemStatus>;
}
