import {
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
