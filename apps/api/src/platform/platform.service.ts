import {
  companyBrandingSchema,
  createCompanySchema,
  companyRobotSchema,
  companySubscriptionSchema,
  platformBrandingSchema,
  updateCompanySchema,
} from "./platform.schema.js";
import {
  readPlatformConfig,
  writePlatformConfig,
} from "./platform.repository.js";
import type {
  CompanyBranding,
  CompanyRobot,
  CompanySubscription,
  PlatformBranding,
  PlatformCompany,
} from "./platform.types.js";

export async function getPublicBranding() {
  const config = await readPlatformConfig();

  return {
    platform: config.platform,
    defaultCompany:
      config.companies.find(
        (company) => company.active,
      ) || null,
  };
}

export async function getPlatformOverview() {
  return readPlatformConfig();
}

export async function listCompanies() {
  const config = await readPlatformConfig();
  return config.companies;
}

export async function findCompany(
  companyId: string,
): Promise<PlatformCompany | null> {
  const config = await readPlatformConfig();

  return (
    config.companies.find(
      (company) => company.id === companyId,
    ) || null
  );
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


// Provisionamiento inicial: DB transaccional por RPC + vista del Superadmin.
// La cuenta owner y las credenciales externas quedan PENDIENTES de activación.
let provisionQueue: Promise<void> = Promise.resolve();

export class CompanyAlreadyExistsError extends Error {
  constructor() {
    super("COMPANY_ALREADY_EXISTS");
  }
}

function defaultCompany(input: {
  id: string;
  name: string;
  legalName: string;
  plan: string;
  currency: string;
}): PlatformCompany {
  const name = input.name;
  return {
    id: input.id,
    slug: input.id,
    name,
    legalName: input.legalName,
    active: false, // No activar antes de conceder acceso al owner.
    createdAt: new Date().toISOString(),
    branding: {
      shortName: name.slice(0, 40),
      panelTitle: `${name} · Panel`.slice(0, 120),
      panelSubtitle: "Gestión y operación empresarial",
      loginEyebrow: "ACCESO EMPRESARIAL",
      loginTitle: `Bienvenido a ${name}`.slice(0, 180),
      loginMessage: "Accede con las credenciales de tu empresa.",
      loginButtonLabel: "Iniciar sesión",
      robotName: "Asistente",
      primaryColor: "#2856B6",
      logoUrl: null,
      heroImageUrl: null,
    },
    robot: {
      status: "pending",
      phone: "Sin configurar",
      provider: "pending",
      webhookStatus: "pending",
      aiStatus: "pending",
    },
    subscription: {
      plan: input.plan,
      monthlyPrice: 0,
      currency: input.currency,
      paymentStatus: "pending",
    },
  };
}

async function provisionInDatabase(input: {
  id: string;
  name: string;
  legalName: string;
  ownerEmail: string;
  sector: string;
  plan: string;
  currency: string;
}) {
  const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    throw new Error("SUPABASE_PROVISIONING_NOT_CONFIGURED");
  }
  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/platform_provision_company`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        p_company_id: input.id,
        p_name: input.name,
        p_owner_email: input.ownerEmail,
        p_sector: input.sector,
        p_plan: input.plan,
        p_currency: input.currency,
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (response.status === 409) {
    throw new CompanyAlreadyExistsError();
  }
  if (!response.ok) {
    // No volcar la respuesta: podría contener detalles internos del proveedor.
    throw new Error(`COMPANY_DATABASE_PROVISIONING_FAILED_${response.status}`);
  }
}

export function createCompany(input: unknown): Promise<PlatformCompany> {
  // Serializar altas en este proceso para evitar perder actualizaciones del JSON.
  const operation = provisionQueue
    .catch(() => undefined)
    .then(async () => {
      const parsed = createCompanySchema.parse(input);
      const config = await readPlatformConfig();
      const existing = config.companies.find(
        (company) => company.id === parsed.id,
      );
      if (existing && existing.name !== parsed.name) {
        throw new CompanyAlreadyExistsError();
      }

      // La RPC es idempotente: si falla la proyección JSON, se puede reintentar.
      await provisionInDatabase(parsed);
      if (existing) return existing;

      const newCompany = defaultCompany(parsed);
      await writePlatformConfig({
        ...config,
        companies: [...config.companies, newCompany],
      });
      return newCompany;
    });

  provisionQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}
