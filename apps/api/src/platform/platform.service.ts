import { randomUUID } from "node:crypto";
import { resolve4 } from "node:dns/promises";
import { authConfig } from "../auth/auth.config.js";
import bcrypt from "bcryptjs";
import {
  createCompanySchema,
  companyBrandingSchema,
  companyRobotSchema,
  companySubscriptionSchema,
  platformBrandingSchema,
  updateCompanySchema,
  companyDomainSchema,
  companyOwnerUpdateSchema,
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
  const baseDomain = process.env.TENANT_BASE_DOMAIN?.trim().toLowerCase().replace(/^\.+/, "");
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
  email: string;
  active: boolean;
};

type CompanyDomainRow = {
  company_id: string;
  purpose: "menu" | "panel";
  kind: "custom" | "subdomain";
  hostname: string;
  status: "pending_dns" | "dns_verified" | "active" | "error";
  verified_at: string | null;
};

export async function listCompanies() {
  const [companies, settings, owners, domains] = await Promise.all([
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
      query: "?select=company_id,role,email,active",
    }),
    supabaseRequest<CompanyDomainRow[]>({
      table: "platform_company_domains",
      query: "?select=company_id,purpose,kind,hostname,status,verified_at",
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
    ownerEmail: owners.find(user => user.company_id === company.id && user.role === "owner" && user.active)?.email ?? null,
    domains: domains.filter(d => d.company_id === company.id),
    domain: domains.find(d => d.company_id === company.id && d.purpose === "menu")?.hostname
      ?? (process.env.TENANT_BASE_DOMAIN?.trim()
        ? `${company.id}.${process.env.TENANT_BASE_DOMAIN.trim()}` : null),
  }));
}

export async function findCompany(companyId: string) {
  const companies = await listCompanies();
  return companies.find((company) => company.id === companyId) ?? null;
}

export async function createCompany(input: unknown) {
  const payload = createCompanySchema.parse(input);
  if (authConfig.users.some(u => u.active && u.email.toLowerCase() === payload.ownerEmail)) {
    throw new Error("OWNER_EMAIL_RESERVED_BY_PLATFORM");
  }
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

/** Registro solicitado por el superadmin. Guardar NO modifica DNS ni Nginx. */
export async function registerCompanyDomain(companyId: string, input: unknown) {
  const company = await findCompany(companyId);
  if (!company) return null;
  const payload = companyDomainSchema.parse(input);
  const hostname = payload.hostname.toLowerCase().replace(/\.$/, "");
  const labels = hostname.split(".");
  if (labels.length < 2 || labels.some(label =>
    label.length < 1 || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  ) || labels.at(-1)!.length < 2 || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    throw new Error("INVALID_HOSTNAME");
  }
  if (payload.kind === "subdomain") {
    const base = process.env.TENANT_BASE_DOMAIN?.toLowerCase().replace(/^\.+/, "").trim();
    if (!base || !hostname.endsWith("." + base) || hostname.slice(0, -(base.length + 1)).includes(".")) {
      throw new Error("SUBDOMAIN_BASE_NOT_CONFIGURED_OR_INVALID");
    }
  }
  const rows = await supabaseRequest<CompanyDomainRow[]>({
    table: "platform_company_domains",
    method: "POST",
    query: "?on_conflict=company_id,purpose",
    prefer: "resolution=merge-duplicates,return=representation",
    body: {
      company_id: companyId,
      purpose: payload.purpose,
      kind: payload.kind,
      hostname,
      status: "pending_dns",
      verified_at: null,
      activated_at: null,
      updated_at: new Date().toISOString(),
    },
  });
  return rows[0] ?? null;
}

/** Solo verifica DNS. La activación HTTPS la hará un despliegue separado. */
export async function verifyCompanyDomain(companyId: string, purpose: string) {
  const company = await findCompany(companyId);
  if (!company) return null;
  if (purpose !== "menu" && purpose !== "panel") throw new Error("INVALID_PURPOSE");
  const current = company.domains.find(d => d.purpose === purpose);
  if (!current) throw new Error("DOMAIN_NOT_REGISTERED");
  const expectedIp = (process.env.PUBLIC_SERVER_IP || "187.33.150.136").trim();
  let ipv4: string[] = [];
  try { ipv4 = await resolve4(current.hostname); } catch { /* DNS aún no propagado */ }
  const verified = ipv4.includes(expectedIp);
  const rows = await supabaseRequest<CompanyDomainRow[]>({
    table: "platform_company_domains",
    method: "PATCH",
    query: `?company_id=eq.${encodeURIComponent(companyId)}&purpose=eq.${purpose}`,
    body: {
      status: verified ? "dns_verified" : "pending_dns",
      verified_at: verified ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
  });
  return { ...rows[0], verified, expectedIp, ipv4, httpsActivated: false };
}

/** Permite asignar propietario distinto del superadmin, sin duplicar empresa. */
export async function updateCompanyOwnerAccess(companyId: string, input: unknown) {
  const company = await findCompany(companyId);
  if (!company) return null;
  const payload = companyOwnerUpdateSchema.parse(input);
  if (authConfig.users.some(u => u.active && u.email.toLowerCase() === payload.email.toLowerCase())) {
    throw new Error("EMAIL_RESERVED_BY_EXISTING_ACCOUNT");
  }
  const users = await supabaseRequest<Array<{ id: string; role: string; email: string }>>({
    table: "crm_auth_users",
    query: `?company_id=eq.${encodeURIComponent(companyId)}&role=eq.owner&active=eq.true&select=id,role,email`,
  });
  if (users.length !== 1) throw new Error("EXPECTED_EXACTLY_ONE_ACTIVE_OWNER");
  const update: Record<string, unknown> = {
    email: payload.email.toLowerCase(),
    updated_at: new Date().toISOString(),
  };
  if (payload.password) update.password_hash = await bcrypt.hash(payload.password, 12);
  const result = await supabaseRequest<Array<{ id: string; email: string; role: string }>>({
    table: "crm_auth_users",
    method: "PATCH",
    query: `?company_id=eq.${encodeURIComponent(companyId)}&id=eq.${encodeURIComponent(users[0].id)}`,
    body: update,
  });
  return result[0] ? { email: result[0].email, role: result[0].role, companyId } : null;
}
