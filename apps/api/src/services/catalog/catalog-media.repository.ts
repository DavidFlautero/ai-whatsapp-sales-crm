import {
  randomUUID,
} from "node:crypto";

import {
  promises as fs,
} from "node:fs";

import {
  fileURLToPath,
} from "node:url";

import path from "node:path";


export type CatalogMediaRole =
  | "cover"
  | "front"
  | "back"
  | "detail"
  | "model";


export type CatalogMediaAsset = {
  id: string;

  companyId: string;

  articleCode: string;

  colorCode:
    | string
    | null;

  colorName:
    | string
    | null;

  role:
    CatalogMediaRole;

  url: string;

  bucket?:
    string | null;

  storagePath?:
    string | null;

  sha256: string;

  source:
    | "panel"
    | "legacy";

  createdAt: string;
};


type CatalogMediaRegistry = {
  version: 1;

  companyId: string;

  updatedAt: string;

  assets:
    CatalogMediaAsset[];
};


export type CatalogMediaSettings = {
  version: 1;

  companyId: string;

  ownerWhatsapp:
    string | null;

  notificationsEnabled:
    boolean;

  updatedAt: string;
};


const currentDir =
  path.dirname(
    fileURLToPath(
      import.meta.url,
    ),
  );


const DATA_DIR =
  path.resolve(
    currentDir,
    "../../../data/catalog-media",
  );


function safeCompanyId(
  companyId: string,
) {
  const value =
    companyId
      .trim()
      .toLowerCase();

  if (
    !/^[a-z0-9_-]{2,100}$/.test(
      value,
    )
  ) {
    throw new Error(
      "CATALOG_MEDIA_INVALID_COMPANY_ID",
    );
  }

  return value;
}


export function normalizeArticleCode(
  value:
    string | null | undefined,
) {
  return String(
    value ?? "",
  )
    .trim()
    .toUpperCase()
    .replace(
      /\s+/g,
      "",
    );
}


function registryPath(
  companyId: string,
) {
  return path.join(
    DATA_DIR,
    `${
      safeCompanyId(
        companyId,
      )
    }.registry.json`,
  );
}


function settingsPath(
  companyId: string,
) {
  return path.join(
    DATA_DIR,
    `${
      safeCompanyId(
        companyId,
      )
    }.settings.json`,
  );
}


async function sleep(
  ms: number,
) {
  await new Promise<void>(
    (resolve) =>
      setTimeout(
        resolve,
        ms,
      ),
  );
}


async function ensureDataDir() {
  await fs.mkdir(
    DATA_DIR,
    {
      recursive:
        true,
    },
  );
}


async function readJson<T>(
  target:
    string,

  fallback:
    T,
): Promise<T> {
  try {
    return JSON.parse(
      await fs.readFile(
        target,
        "utf8",
      ),
    ) as T;

  } catch (error) {
    if (
      error instanceof Error
      && "code" in error
      && error.code === "ENOENT"
    ) {
      return fallback;
    }

    throw error;
  }
}


async function atomicWrite(
  target:
    string,

  value:
    unknown,
) {
  await ensureDataDir();

  const temporary =
    `${target}.${process.pid}.${randomUUID()}.tmp`;

  try {
    await fs.writeFile(
      temporary,
      JSON.stringify(
        value,
        null,
        2,
      ),
      {
        encoding:
          "utf8",

        mode:
          0o600,
      },
    );

    await fs.rename(
      temporary,
      target,
    );

  } finally {
    await fs.rm(
      temporary,
      {
        force:
          true,
      },
    )
      .catch(
        () => undefined,
      );
  }
}


async function withFileLock<T>(
  lockName:
    string,

  operation:
    () => Promise<T>,
): Promise<T> {
  await ensureDataDir();

  const lockPath =
    path.join(
      DATA_DIR,
      `${lockName}.lock`,
    );

  const deadline =
    Date.now()
    + 10_000;

  while (true) {
    try {
      await fs.mkdir(
        lockPath,
      );

      break;

    } catch (error) {
      if (
        !(
          error instanceof Error
          && "code" in error
          && error.code
            === "EEXIST"
        )
      ) {
        throw error;
      }

      /*
       * Recuperación de lock abandonado
       * por crash/kill del proceso.
       */
      try {
        const stat =
          await fs.stat(
            lockPath,
          );

        if (
          Date.now()
          - stat.mtimeMs
          > 60_000
        ) {
          await fs.rm(
            lockPath,
            {
              recursive:
                true,

              force:
                true,
            },
          );

          continue;
        }

      } catch {
        continue;
      }

      if (
        Date.now()
        >= deadline
      ) {
        throw new Error(
          "CATALOG_MEDIA_LOCK_TIMEOUT",
        );
      }

      await sleep(
        50
        + Math.floor(
          Math.random()
          * 100,
        ),
      );
    }
  }

  try {
    return await operation();

  } finally {
    await fs.rm(
      lockPath,
      {
        recursive:
          true,

        force:
          true,
      },
    )
      .catch(
        () => undefined,
      );
  }
}


function emptyRegistry(
  companyId: string,
): CatalogMediaRegistry {
  return {
    version:
      1,

    companyId:
      safeCompanyId(
        companyId,
      ),

    updatedAt:
      new Date()
        .toISOString(),

    assets:
      [],
  };
}


export async function listCatalogMediaAssets(
  companyId: string,
) {
  const registry =
    await readJson<CatalogMediaRegistry>(
      registryPath(
        companyId,
      ),
      emptyRegistry(
        companyId,
      ),
    );

  return Array.isArray(
    registry.assets,
  )
    ? registry.assets
    : [];
}


export async function findCatalogMediaAssetByHash(
  companyId: string,

  articleCode: string,

  sha256: string,
) {
  const code =
    normalizeArticleCode(
      articleCode,
    );

  const assets =
    await listCatalogMediaAssets(
      companyId,
    );

  return (
    assets.find(
      (asset) =>
        normalizeArticleCode(
          asset.articleCode,
        ) === code
        && asset.sha256
          === sha256,
    )
    ?? null
  );
}


export async function registerCatalogMediaAsset(
  input: {
    companyId: string;

    articleCode: string;

    colorCode?:
      string | null;

    colorName?:
      string | null;

    role:
      CatalogMediaRole;

    url: string;

    bucket?:
      string | null;

    storagePath?:
      string | null;

    sha256: string;

    source?:
      "panel" | "legacy";
  },
) {
  const companyId =
    safeCompanyId(
      input.companyId,
    );

  const articleCode =
    normalizeArticleCode(
      input.articleCode,
    );

  if (!articleCode) {
    throw new Error(
      "CATALOG_MEDIA_ARTICLE_CODE_REQUIRED",
    );
  }

  if (
    !/^https:\/\//i.test(
      input.url,
    )
  ) {
    throw new Error(
      "CATALOG_MEDIA_HTTPS_URL_REQUIRED",
    );
  }

  if (
    !/^[a-f0-9]{64}$/i.test(
      input.sha256,
    )
  ) {
    throw new Error(
      "CATALOG_MEDIA_INVALID_SHA256",
    );
  }

  return withFileLock(
    `registry-${companyId}`,

    async () => {
      const target =
        registryPath(
          companyId,
        );

      const registry =
        await readJson<CatalogMediaRegistry>(
          target,
          emptyRegistry(
            companyId,
          ),
        );

      const existing =
        registry.assets.find(
          (asset) =>
            normalizeArticleCode(
              asset.articleCode,
            ) === articleCode
            && asset.sha256
              === input.sha256,
        );

      if (existing) {
        return {
          asset:
            existing,

          created:
            false,
        };
      }

      const asset:
      CatalogMediaAsset = {
        id:
          randomUUID(),

        companyId,

        articleCode,

        colorCode:
          input.colorCode
            ?.trim()
            || null,

        colorName:
          input.colorName
            ?.trim()
            || null,

        role:
          input.role,

        url:
          input.url,

        bucket:
          input.bucket
          ?? null,

        storagePath:
          input.storagePath
          ?? null,

        sha256:
          input.sha256
            .toLowerCase(),

        source:
          input.source
          ?? "panel",

        createdAt:
          new Date()
            .toISOString(),
      };

      registry.assets.push(
        asset,
      );

      registry.updatedAt =
        new Date()
          .toISOString();

      await atomicWrite(
        target,
        registry,
      );

      return {
        asset,

        created:
          true,
      };
    },
  );
}


export async function findCatalogMediaAssetById(
  companyId:
    string,

  assetId:
    string,
) {
  const assets =
    await listCatalogMediaAssets(
      companyId,
    );


  return (
    assets.find(
      (asset) =>
        asset.id
        === assetId,
    )
    ?? null
  );
}


export async function removeCatalogMediaAsset(
  companyIdInput:
    string,

  assetId:
    string,
) {
  const companyId =
    safeCompanyId(
      companyIdInput,
    );


  return withFileLock(
    `registry-${companyId}`,

    async () => {
      const target =
        registryPath(
          companyId,
        );


      const registry =
        await readJson<CatalogMediaRegistry>(
          target,
          emptyRegistry(
            companyId,
          ),
        );


      const index =
        registry.assets
          .findIndex(
            (asset) =>
              asset.id
              === assetId,
          );


      if (
        index < 0
      ) {
        return null;
      }


      const [
        removed,
      ] =
        registry.assets
          .splice(
            index,
            1,
          );


      registry.updatedAt =
        new Date()
          .toISOString();


      await atomicWrite(
        target,
        registry,
      );


      return removed
        ?? null;
    },
  );
}


function normalizeWhatsapp(
  value:
    string | null | undefined,
) {
  const digits =
    String(
      value ?? "",
    )
      .replace(
        /\D/g,
        "",
      );

  if (!digits) {
    return null;
  }

  if (
    digits.length < 8
    || digits.length > 15
  ) {
    throw new Error(
      "CATALOG_MEDIA_OWNER_PHONE_INVALID",
    );
  }

  return digits;
}


function emptySettings(
  companyId: string,
): CatalogMediaSettings {
  return {
    version:
      1,

    companyId:
      safeCompanyId(
        companyId,
      ),

    ownerWhatsapp:
      null,

    notificationsEnabled:
      true,

    updatedAt:
      new Date()
        .toISOString(),
  };
}


export async function readCatalogMediaSettings(
  companyId: string,
) {
  return readJson<CatalogMediaSettings>(
    settingsPath(
      companyId,
    ),
    emptySettings(
      companyId,
    ),
  );
}


export async function saveCatalogMediaSettings(
  companyId: string,

  input: {
    ownerWhatsapp?:
      string | null;

    notificationsEnabled?:
      boolean;
  },
) {
  const normalizedCompany =
    safeCompanyId(
      companyId,
    );

  return withFileLock(
    `settings-${normalizedCompany}`,

    async () => {
      const current =
        await readCatalogMediaSettings(
          normalizedCompany,
        );

      const next:
      CatalogMediaSettings = {
        ...current,

        ownerWhatsapp:
          input.ownerWhatsapp
            === undefined
            ? current.ownerWhatsapp
            : normalizeWhatsapp(
                input.ownerWhatsapp,
              ),

        notificationsEnabled:
          input.notificationsEnabled
            ?? current
              .notificationsEnabled,

        updatedAt:
          new Date()
            .toISOString(),
      };

      await atomicWrite(
        settingsPath(
          normalizedCompany,
        ),
        next,
      );

      return next;
    },
  );
}
