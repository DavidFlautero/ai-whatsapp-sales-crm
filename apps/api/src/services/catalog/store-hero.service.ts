import {
  readPlatformConfig,
  writePlatformConfig,
} from "../../platform/platform.repository.js";

const COMPANY_ID =
  "fulanitas";

export async function getStoreHeroImage() {
  const config =
    await readPlatformConfig();

  const company =
    config.companies.find(
      (item) =>
        item.id === COMPANY_ID,
    );

  return {
    url:
      company?.branding
        .heroImageUrl
      ?? null,
  };
}

export async function saveStoreHeroImage(
  url: string,
) {
  const config =
    await readPlatformConfig();

  const index =
    config.companies.findIndex(
      (item) =>
        item.id === COMPANY_ID,
    );

  if (index < 0) {
    throw new Error(
      "COMPANY_NOT_FOUND",
    );
  }

  const company =
    config.companies[index];

  if (!company) {
    throw new Error(
      "COMPANY_NOT_FOUND",
    );
  }

  config.companies[index] = {
    ...company,

    branding: {
      ...company.branding,

      heroImageUrl:
        url,
    },
  };

  const saved =
    await writePlatformConfig(
      config,
    );

  const savedCompany =
    saved.companies.find(
      (item) =>
        item.id === COMPANY_ID,
    );

  return {
    url:
      savedCompany?.branding
        .heroImageUrl
      ?? url,
  };
}
