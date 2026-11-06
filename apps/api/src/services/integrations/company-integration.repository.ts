import {
  supabaseRequest,
} from "../db/supabase-rest.client.js";

export type CompanyIntegrationProvider =
  | "ninox"
  | "toteat"
  | "pos360"
  | "whapi"
  | "native";

export type CompanyIntegrationRecord = {
  company_id: string;
  provider: CompanyIntegrationProvider;
  status: "pending" | "connected" | "disabled";
  enabled: boolean;
};

const PROVIDERS = new Set<string>([
  "ninox",
  "toteat",
  "pos360",
  "whapi",
  "native",
]);

export async function getCompanyIntegration(
  companyId: string,
  provider: CompanyIntegrationProvider,
): Promise<CompanyIntegrationRecord | null> {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(companyId)) {
    throw new Error("INVALID_COMPANY_ID");
  }

  if (!PROVIDERS.has(provider)) {
    throw new Error("INVALID_INTEGRATION_PROVIDER");
  }

  const rows = await supabaseRequest<CompanyIntegrationRecord[]>({
    table: "company_integrations",
    query:
      "?select=company_id,provider,status,enabled" +
      "&company_id=eq." + encodeURIComponent(companyId) +
      "&provider=eq." + encodeURIComponent(provider) +
      "&limit=1",
  });

  const record = rows[0] ?? null;

  if (
    record &&
    (
      record.company_id !== companyId ||
      record.provider !== provider
    )
  ) {
    throw new Error("INTEGRATION_SCOPE_MISMATCH");
  }

  return record;
}

export async function getCompanyIntegrationReadiness(
  companyId: string,
  provider: CompanyIntegrationProvider,
) {
  const record = await getCompanyIntegration(
    companyId,
    provider,
  );

  return {
    companyId,
    provider,
    configured: Boolean(record),
    enabled: record?.enabled === true,
    connected: record?.status === "connected",

    // No existen todavía credenciales empresariales
    // ni comprobación operativa del proveedor.
    verified: false,
  };
}
