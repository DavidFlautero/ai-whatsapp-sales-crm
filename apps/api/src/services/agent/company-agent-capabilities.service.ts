import {
  listPrompts,
} from "../prompts/prompt.repository.js";

export type CompanySector =
  | "restaurant"
  | "events"
  | "services"
  | "retail"
  | "other";

export type CompanyAdapter =
  | "native"
  | "ninox"
  | "toteat"
  | "pos360"
  | "events";

export type CompanyAgentCapabilities = {
  companyId: string;
  sector: CompanySector;
  adapters: CompanyAdapter[];
  memory: boolean;
  knowledge: boolean;
  crm: boolean;
  catalog: boolean;
  orders: boolean;
  voice: boolean;
  vision: boolean;
  humanHandoff: boolean;
};

const sectors = new Set<string>([
  "restaurant",
  "events",
  "services",
  "retail",
  "other",
]);

const adapters = new Set<string>([
  "native",
  "ninox",
  "toteat",
  "pos360",
  "events",
]);

export function resolveCompanyCapabilities(
  companyId: string,
  metadata: Record<string, unknown>,
): CompanyAgentCapabilities {
  const rawSector = metadata.sector;

  const sector: CompanySector =
    typeof rawSector === "string" &&
    sectors.has(rawSector)
      ? rawSector as CompanySector
      : "other";

  const configured = metadata.adapters;

  const selectedAdapters: CompanyAdapter[] =
    Array.isArray(configured)
      ? configured.filter(
          (value): value is CompanyAdapter =>
            typeof value === "string" &&
            adapters.has(value),
        )
      : [];

  return {
    companyId,
    sector,
    adapters: [...new Set(selectedAdapters)],
    memory: true,
    knowledge: true,
    crm: true,

    // Ninguna operación externa se habilita
    // hasta verificar su integración.
    catalog: sector === "restaurant",
    orders: false,
    voice: false,
    vision: false,
    humanHandoff: false,
  };
}

export async function loadCompanyCapabilities(
  companyId: string,
): Promise<CompanyAgentCapabilities> {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(companyId)) {
    throw new Error("INVALID_COMPANY_ID");
  }

  const prompts = await listPrompts(companyId);

  const profile = prompts.find(
    item =>
      item.company_id === companyId &&
      item.type === "company_agent" &&
      item.active === true,
  );

  if (!profile) {
    throw new Error("COMPANY_AGENT_NOT_CONFIGURED");
  }

  return resolveCompanyCapabilities(
    companyId,
    profile.metadata ?? {},
  );
}
