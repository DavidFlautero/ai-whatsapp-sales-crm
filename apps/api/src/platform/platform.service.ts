import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  createCompanySchema,
  companyBrandingSchema,
  companyRobotSchema,
  companySubscriptionSchema,
  platformBrandingSchema,
  updateCompanySchema,
} from "./platform.schema.js";
import {
  readPlatformConfig,
  writePlatformConfig,
} from "./platform.repository.js";
import { supabaseRequest, supabaseRpc } from "../services/db/supabase-rest.client.js";
import type {
  CompanyBranding,
  CompanyRobot,
  CompanySubscription,
  PlatformBranding,
} from "./platform.types.js";

export async function getPublicBranding(hostname?: string) {
  const config = await readPlatformConfig();
  const baseDomain = process.env.TENANT_BASE_DOMAIN?.trim().toLowerCase().replace(/^\\.+/, "");
  const host = hostname?.trim().toLowerCase();

  if (baseDomain && host?.endsWith("." + baseDomain)) {
    const slug = host.slice(0, -baseDomain.length - 1);
    if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
      const tenant = await findCompany(slug);
      if (tenant?.active) {
        return {
          platform: config.platform,
          defaultCompany: {
            id: tenant.id,
            name: tenant.name,
            branding: {
              shortName: tenant.name,
              loginEyebrow: "GESTIÓN EMPRESARIAL",
              loginTitle: tenant.name,
              loginMessage: "Accedé al panel de tu empresa.",
              loginButtonLabel: "Ingresar",
              primaryColor: config.platform.primaryColor,
              logoUrl: null,
              heroImageUrl: null,
            },
          },
        };
      }
    }
    return { platform: config.platform, defaultCompany: null };
  }

  return {
    platform: config.platform,
    defaultCompany:
      config.companies.find((company) => company.active) || null,
  };
}

export async function getPlatformOverview() {
  return readPlatformConfig();
}

type CompanyRow = {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
};

type BusinessSettingsRow = {
  company_id: string;
  currency: string;
};

type OwnerRow = {
  company_id: string;
  role: string;
  active: boolean;
};

export async function listCompanies() {
  const [companies, settings, owners] = await Promise.all([
    supabaseRequest<CompanyRow[]>({
      table: "commerce_companies",
      query: "?select=id,name,active,created_at&order=created_at.desc",
    }),
    supabaseRequest<BusinessSettingsRow[]>({
      table: "commerce_business_settings",
      query: "?select=company_id,currency",
    }),
    supabaseRequest<OwnerRow[]>({
      table: "crm_auth_users",
      query: "?select=company_id,role,active",
    }),
  ]);

  const currencyByCompany = new Map(
    settings.map((setting) => [setting.company_id, setting.currency]),
  );

  return companies.map((company) => ({
    id: company.id,
    slug: company.id,
    name: company.name,
    active: company.active,
    createdAt: company.created_at,
    currency: currencyByCompany.get(company.id) ?? null,
    usersCount: owners.filter(
      (user) => user.company_id === company.id && user.active,
    ).length,
    domain: process.env.TENANT_BASE_DOMAIN?.trim()
      ? `${company.id}.${process.env.TENANT_BASE_DOMAIN.trim()}`
      : null,
  }));
}

export async function findCompany(companyId: string) {
  const companies = await listCompanies();
  return companies.find((company) => company.id === companyId) ?? null;
}

export async function createCompany(input: unknown) {
  const payload = createCompanySchema.parse(input);
  const passwordHash = await bcrypt.hash(payload.ownerPassword, 12);

  // Una sola RPC = una transacción: empresa, ajustes y owner.
  const created = await supabaseRpc<{
    id: string;
    name: string;
    active: boolean;
    currency: string;
    ownerEmail: string;
  }>("platform_create_company", {
    p_company_id: payload.slug,
    p_company_name: payload.name,
    p_owner_id: randomUUID(),
    p_owner_name: payload.ownerName,
    p_owner_email: payload.ownerEmail,
    p_password_hash: passwordHash,
    p_currency: payload.currency,
  });

  return {
    ...created,
    domain: process.env.TENANT_BASE_DOMAIN?.trim()
      ? `${created.id}.${process.env.TENANT_BASE_DOMAIN.trim()}`
      : null,
  };
}

export async function updatePlatformBranding(
  input: PlatformBranding,
) {
  const branding = platformBrandingSchema.parse(input);
  const config = await readPlatformConfig();

  return writePlatformConfig({
    ...config,
    platform: branding,
  });
}

export async function updateCompany(
  companyId: string,
  input: unknown,
) {
  const changes = updateCompanySchema.parse(input);
  const config = await readPlatformConfig();

  const index = config.companies.findIndex(
    (company) => company.id === companyId,
  );

  if (index < 0) {
    return null;
  }

  config.companies[index] = {
    ...config.companies[index],
    ...changes,
  };

  const saved = await writePlatformConfig(config);
  return saved.companies[index];
}

export async function updateCompanyBranding(
  companyId: string,
  input: CompanyBranding,
) {
  const branding = companyBrandingSchema.parse(input);
  const config = await readPlatformConfig();

  const index = config.companies.findIndex(
    (company) => company.id === companyId,
  );

  if (index < 0) {
    return null;
  }

  config.companies[index] = {
    ...config.companies[index],
    branding,
  };

  const saved = await writePlatformConfig(config);
  return saved.companies[index];
}

export async function updateCompanyRobot(
  companyId: string,
  input: CompanyRobot,
) {
  const robot = companyRobotSchema.parse(input);
  const config = await readPlatformConfig();

  const index = config.companies.findIndex(
    (company) => company.id === companyId,
  );

  if (index < 0) {
    return null;
  }

  config.companies[index] = {
    ...config.companies[index],
    robot,
  };

  const saved = await writePlatformConfig(config);
  return saved.companies[index];
}

export async function updateCompanySubscription(
  companyId: string,
  input: CompanySubscription,
) {
  const subscription =
    companySubscriptionSchema.parse(input);

  const config = await readPlatformConfig();

  const index = config.companies.findIndex(
    (company) => company.id === companyId,
  );

  if (index < 0) {
    return null;
  }

  config.companies[index] = {
    ...config.companies[index],
    subscription,
  };

  const saved = await writePlatformConfig(config);
  return saved.companies[index];
}
