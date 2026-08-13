import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import fs from "node:fs/promises";
import path from "node:path";

import {
  fileURLToPath,
} from "node:url";

import {
  env,
} from "../../config/env.js";

export type IntegrationProvider =
  | "whatsapp"
  | "anthropic"
  | "groq"
  | "supabase"
  | "ninox"
  | "vision";

export type IntegrationSecrets = {
  whatsapp: {
    token: string;
    phoneNumberId: string;
    businessAccountId: string;
    verifyToken: string;
    graphVersion: string;
  };

  anthropic: {
    apiKey: string;
  };

  groq: {
    apiKey: string;
  };

  supabase: {
    url: string;
    serviceRoleKey: string;
    anonKey: string;
  };

  ninox: {
    enabled: boolean;
    baseUrl: string;
    apiKey: string;
    webhookSecret: string;
  };

  vision: {
    apiKey: string;
    model: string;
  };
};

type IntegrationStore = {
  version: 1;
  integrations: IntegrationSecrets;
  updatedAt: string;
  updatedBy: string | null;
};

type EncryptedEnvelope = {
  version: 1;
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  ciphertext: string;
  updatedAt: string;
};

const storePath =
  process.env.INTEGRATIONS_STORE_PATH?.trim() ||
  fileURLToPath(
    new URL(
      "../../../data/integration-secrets.enc.json",
      import.meta.url,
    ),
  );

const temporaryPath =
  `${storePath}.tmp`;

const auditPath =
  process.env.INTEGRATIONS_AUDIT_PATH?.trim() ||
  fileURLToPath(
    new URL(
      "../../../data/integration-audit.jsonl",
      import.meta.url,
    ),
  );

let mutationQueue:
  Promise<void> =
  Promise.resolve();

function value(
  name: string,
  fallback = "",
) {
  return (
    process.env[name]?.trim() ||
    fallback
  );
}

function initialSecrets():
  IntegrationSecrets {
  return {
    whatsapp: {
      token:
        value(
          "WHATSAPP_TOKEN",
        ),

      phoneNumberId:
        value(
          "WHATSAPP_PHONE_NUMBER_ID",
        ),

      businessAccountId:
        value(
          "WHATSAPP_BUSINESS_ACCOUNT_ID",
        ),

      verifyToken:
        value(
          "WHATSAPP_VERIFY_TOKEN",
        ),

      graphVersion:
        value(
          "WHATSAPP_GRAPH_VERSION",
          "v20.0",
        ),
    },

    anthropic: {
      apiKey:
        value(
          "ANTHROPIC_API_KEY",
        ),
    },

    groq: {
      apiKey:
        value(
          "GROQ_API_KEY",
        ),
    },

    vision: {
      apiKey:
        value(
          "VISION_API_KEY",
        ),

      model:
        value(
          "VISION_MODEL",
        ),
    },

    supabase: {
      url:
        value(
          "SUPABASE_URL",
        ),

      serviceRoleKey:
        value(
          "SUPABASE_SERVICE_ROLE_KEY",
        ),

      anonKey:
        value(
          "SUPABASE_ANON_KEY",
        ),
    },

    ninox: {
      enabled:
        Boolean(
          value(
            "NINOX_API_KEY",
          ),
        ),

      baseUrl:
        value(
          "NINOX_BASE_URL",
          "https://api.ninox.com/v1",
        ),

      apiKey:
        value(
          "NINOX_API_KEY",
        ),

      webhookSecret:
        value(
          "NINOX_WEBHOOK_SECRET",
        ),
    },
  };
}

function emptyProvider(
  provider: IntegrationProvider,
): IntegrationSecrets[
  IntegrationProvider
] {
  switch (provider) {
    case "whatsapp":
      return {
        token: "",
        phoneNumberId: "",
        businessAccountId: "",
        verifyToken: "",
        graphVersion: "v20.0",
      };

    case "anthropic":
      return {
        apiKey: "",
      };

    case "groq":
      return {
        apiKey: "",
      };

    case "supabase":
      return {
        url: "",
        serviceRoleKey: "",
        anonKey: "",
      };

    case "vision":
      return {
        apiKey: "",
        model: "",
      };

    case "ninox":
      return {
        enabled: false,
        baseUrl:
          "https://api.ninox.com/v1",
        apiKey: "",
        webhookSecret: "",
      };
  }
}

function masterKey(): Buffer {
  const raw =
    process.env
      .INTEGRATIONS_MASTER_KEY
      ?.trim();

  if (!raw) {
    throw new Error(
      "INTEGRATIONS_MASTER_KEY is missing",
    );
  }

  if (
    /^[0-9a-fA-F]{64}$/.test(
      raw,
    )
  ) {
    return Buffer.from(
      raw,
      "hex",
    );
  }

  return createHash(
    "sha256",
  )
    .update(raw)
    .digest();
}

function encryptStore(
  store: IntegrationStore,
): EncryptedEnvelope {
  const iv =
    randomBytes(12);

  const cipher =
    createCipheriv(
      "aes-256-gcm",
      masterKey(),
      iv,
    );

  const plaintext =
    Buffer.from(
      JSON.stringify(store),
      "utf8",
    );

  const ciphertext =
    Buffer.concat([
      cipher.update(
        plaintext,
      ),
      cipher.final(),
    ]);

  const authTag =
    cipher.getAuthTag();

  return {
    version: 1,
    algorithm:
      "aes-256-gcm",

    iv:
      iv.toString(
        "base64",
      ),

    authTag:
      authTag.toString(
        "base64",
      ),

    ciphertext:
      ciphertext.toString(
        "base64",
      ),

    updatedAt:
      store.updatedAt,
  };
}

function decryptStore(
  envelope: EncryptedEnvelope,
): IntegrationStore {
  if (
    envelope.version !== 1 ||
    envelope.algorithm !==
      "aes-256-gcm"
  ) {
    throw new Error(
      "Unsupported integrations store",
    );
  }

  const decipher =
    createDecipheriv(
      "aes-256-gcm",
      masterKey(),

      Buffer.from(
        envelope.iv,
        "base64",
      ),
    );

  decipher.setAuthTag(
    Buffer.from(
      envelope.authTag,
      "base64",
    ),
  );

  const plaintext =
    Buffer.concat([
      decipher.update(
        Buffer.from(
          envelope.ciphertext,
          "base64",
        ),
      ),
      decipher.final(),
    ]);

  const parsed =
    JSON.parse(
      plaintext.toString(
        "utf8",
      ),
    ) as IntegrationStore;

  if (
    parsed.version !== 1 ||
    !parsed.integrations
  ) {
    throw new Error(
      "Invalid integrations store",
    );
  }

  return parsed;
}

async function writeStore(
  store: IntegrationStore,
) {
  const envelope =
    encryptStore(store);

  await fs.mkdir(
    path.dirname(
      storePath,
    ),
    {
      recursive: true,
      mode: 0o700,
    },
  );

  await fs.writeFile(
    temporaryPath,

    `${JSON.stringify(
      envelope,
      null,
      2,
    )}\n`,

    {
      encoding: "utf8",
      mode: 0o600,
    },
  );

  await fs.rename(
    temporaryPath,
    storePath,
  );

  await fs.chmod(
    storePath,
    0o600,
  );
}

async function readStore():
  Promise<IntegrationStore> {
  try {
    const raw =
      await fs.readFile(
        storePath,
        "utf8",
      );

    return decryptStore(
      JSON.parse(
        raw,
      ) as EncryptedEnvelope,
    );
  } catch (
    error: unknown
  ) {
    if (
      (
        error as NodeJS.ErrnoException
      ).code !== "ENOENT"
    ) {
      throw error;
    }

    const now =
      new Date()
        .toISOString();

    const initial:
      IntegrationStore = {
      version: 1,
      integrations:
        initialSecrets(),
      updatedAt: now,
      updatedBy:
        "environment-migration",
    };

    await writeStore(
      initial,
    );

    return initial;
  }
}

function runtimeSet(
  name: string,
  nextValue: string,
) {
  const runtimeEnv =
    env as unknown as
      Record<
        string,
        string | undefined
      >;

  if (nextValue) {
    process.env[name] =
      nextValue;

    runtimeEnv[name] =
      nextValue;

    return;
  }

  delete process.env[name];

  runtimeEnv[name] =
    undefined;
}

function applyRuntime(
  integrations:
    IntegrationSecrets,
) {
  runtimeSet(
    "WHATSAPP_TOKEN",
    integrations
      .whatsapp.token,
  );

  runtimeSet(
    "WHATSAPP_PHONE_NUMBER_ID",
    integrations
      .whatsapp
      .phoneNumberId,
  );

  runtimeSet(
    "WHATSAPP_BUSINESS_ACCOUNT_ID",
    integrations
      .whatsapp
      .businessAccountId,
  );

  runtimeSet(
    "WHATSAPP_VERIFY_TOKEN",
    integrations
      .whatsapp
      .verifyToken,
  );

  runtimeSet(
    "WHATSAPP_GRAPH_VERSION",
    integrations
      .whatsapp
      .graphVersion,
  );

  runtimeSet(
    "ANTHROPIC_API_KEY",
    integrations
      .anthropic.apiKey,
  );

  runtimeSet(
    "GROQ_API_KEY",
    integrations
      .groq.apiKey,
  );

  runtimeSet(
    "SUPABASE_URL",
    integrations
      .supabase.url,
  );

  runtimeSet(
    "SUPABASE_SERVICE_ROLE_KEY",
    integrations
      .supabase
      .serviceRoleKey,
  );

  runtimeSet(
    "SUPABASE_ANON_KEY",
    integrations
      .supabase.anonKey,
  );

  runtimeSet(
    "NINOX_BASE_URL",
    integrations
      .ninox.baseUrl,
  );

  runtimeSet(
    "NINOX_API_KEY",
    integrations
      .ninox.enabled
      ? integrations
          .ninox.apiKey
      : "",
  );

  runtimeSet(
    "NINOX_WEBHOOK_SECRET",
    integrations
      .ninox.webhookSecret,
  );
}

function mask(
  secret: string,
) {
  if (!secret) {
    return null;
  }

  if (
    secret.length <= 8
  ) {
    return "••••••••";
  }

  return [
    secret.slice(0, 4),
    "••••••••",
    secret.slice(-4),
  ].join("");
}

async function audit(
  input: {
    action: string;
    provider:
      IntegrationProvider;
    actorId: string;
    actorEmail: string;
  },
) {
  const entry = {
    at:
      new Date()
        .toISOString(),

    ...input,
  };

  await fs.mkdir(
    path.dirname(
      auditPath,
    ),
    {
      recursive: true,
      mode: 0o700,
    },
  );

  await fs.appendFile(
    auditPath,

    `${JSON.stringify(
      entry,
    )}\n`,

    {
      encoding: "utf8",
      mode: 0o600,
    },
  );

  await fs.chmod(
    auditPath,
    0o600,
  );
}

function nonEmptyText(
  values:
    Record<
      string,
      unknown
    >,

  field: string,
) {
  const candidate =
    values[field];

  if (
    typeof candidate !==
      "string"
  ) {
    return undefined;
  }

  const normalized =
    candidate.trim();

  return normalized ||
    undefined;
}

export async function hydrateIntegrationSecrets() {
  const store =
    await readStore();

  applyRuntime(
    store.integrations,
  );

  return store;
}

export async function readIntegrationSecrets() {
  const store =
    await readStore();

  return store.integrations;
}

export async function getPublicIntegrationConfig() {
  const store =
    await readStore();

  const current =
    store.integrations;

  return {
    updatedAt:
      store.updatedAt,

    updatedBy:
      store.updatedBy,

    whatsapp: {
      configured:
        Boolean(
          current
            .whatsapp.token &&
          current
            .whatsapp
            .phoneNumberId,
        ),

      tokenMasked:
        mask(
          current
            .whatsapp.token,
        ),

      verifyTokenMasked:
        mask(
          current
            .whatsapp
            .verifyToken,
        ),

      phoneNumberId:
        current
          .whatsapp
          .phoneNumberId,

      businessAccountId:
        current
          .whatsapp
          .businessAccountId,

      graphVersion:
        current
          .whatsapp
          .graphVersion,
    },

    anthropic: {
      configured:
        Boolean(
          current
            .anthropic.apiKey,
        ),

      apiKeyMasked:
        mask(
          current
            .anthropic.apiKey,
        ),
    },

    groq: {
      configured:
        Boolean(
          current
            .groq.apiKey,
        ),

      apiKeyMasked:
        mask(
          current
            .groq.apiKey,
        ),
    },

    vision: {
      configured:
        Boolean(
          current
            .vision
            ?.apiKey
          && current
            .vision
            ?.model,
        ),

      apiKeyMasked:
        mask(
          current
            .vision
            ?.apiKey
          ?? "",
        ),

      model:
        current
          .vision
          ?.model
        ?? "",
    },

    supabase: {
      configured:
        Boolean(
          current
            .supabase.url &&
          (
            current
              .supabase
              .serviceRoleKey ||
            current
              .supabase
              .anonKey
          ),
        ),

      url:
        current
          .supabase.url,

      serviceRoleKeyMasked:
        mask(
          current
            .supabase
            .serviceRoleKey,
        ),

      anonKeyMasked:
        mask(
          current
            .supabase
            .anonKey,
        ),
    },

    ninox: {
      configured:
        Boolean(
          current
            .ninox.enabled &&
          current
            .ninox.apiKey,
        ),

      enabled:
        current
          .ninox.enabled,

      baseUrl:
        current
          .ninox.baseUrl,

      apiKeyMasked:
        mask(
          current
            .ninox.apiKey,
        ),

      webhookSecretMasked:
        mask(
          current
            .ninox
            .webhookSecret,
        ),
    },
  };
}

export async function saveIntegrationConfig(
  provider:
    IntegrationProvider,

  values:
    Record<
      string,
      unknown
    >,

  actor: {
    id: string;
    email: string;
  },
) {
  const operation =
    mutationQueue
      .catch(
        () => undefined,
      )
      .then(
        async () => {
          const store =
            await readStore();

          const integrations =
            structuredClone(
              store.integrations,
            );

          switch (provider) {
            case "whatsapp": {
              const token =
                nonEmptyText(
                  values,
                  "token",
                );

              const phoneNumberId =
                nonEmptyText(
                  values,
                  "phoneNumberId",
                );

              const businessAccountId =
                nonEmptyText(
                  values,
                  "businessAccountId",
                );

              const verifyToken =
                nonEmptyText(
                  values,
                  "verifyToken",
                );

              const graphVersion =
                nonEmptyText(
                  values,
                  "graphVersion",
                );

              if (token) {
                integrations
                  .whatsapp.token =
                  token;
              }

              if (phoneNumberId) {
                integrations
                  .whatsapp
                  .phoneNumberId =
                  phoneNumberId;
              }

              if (
                businessAccountId
              ) {
                integrations
                  .whatsapp
                  .businessAccountId =
                  businessAccountId;
              }

              if (verifyToken) {
                integrations
                  .whatsapp
                  .verifyToken =
                  verifyToken;
              }

              if (graphVersion) {
                integrations
                  .whatsapp
                  .graphVersion =
                  graphVersion;
              }

              break;
            }

            case "anthropic": {
              const apiKey =
                nonEmptyText(
                  values,
                  "apiKey",
                );

              if (apiKey) {
                integrations
                  .anthropic.apiKey =
                  apiKey;
              }

              break;
            }

            case "groq": {
              const apiKey =
                nonEmptyText(
                  values,
                  "apiKey",
                );

              if (apiKey) {
                integrations
                  .groq.apiKey =
                  apiKey;
              }

              break;
            }

            case "vision": {
              const apiKey =
                nonEmptyText(
                  values,
                  "apiKey",
                );

              const model =
                nonEmptyText(
                  values,
                  "model",
                );

              integrations.vision ??= {
                apiKey: "",
                model: "",
              };

              if (apiKey) {
                integrations
                  .vision.apiKey =
                  apiKey;
              }

              if (model) {
                integrations
                  .vision.model =
                  model;
              }

              break;
            }

            case "supabase": {
              const url =
                nonEmptyText(
                  values,
                  "url",
                );

              const serviceRoleKey =
                nonEmptyText(
                  values,
                  "serviceRoleKey",
                );

              const anonKey =
                nonEmptyText(
                  values,
                  "anonKey",
                );

              if (url) {
                integrations
                  .supabase.url =
                  url.replace(
                    /\/+$/,
                    "",
                  );
              }

              if (
                serviceRoleKey
              ) {
                integrations
                  .supabase
                  .serviceRoleKey =
                  serviceRoleKey;
              }

              if (anonKey) {
                integrations
                  .supabase
                  .anonKey =
                  anonKey;
              }

              break;
            }

            case "ninox": {
              const baseUrl =
                nonEmptyText(
                  values,
                  "baseUrl",
                );

              const apiKey =
                nonEmptyText(
                  values,
                  "apiKey",
                );

              const webhookSecret =
                nonEmptyText(
                  values,
                  "webhookSecret",
                );

              if (
                typeof values.enabled ===
                "boolean"
              ) {
                integrations
                  .ninox.enabled =
                  values.enabled;
              }

              if (baseUrl) {
                integrations
                  .ninox.baseUrl =
                  baseUrl.replace(
                    /\/+$/,
                    "",
                  );
              }

              if (apiKey) {
                integrations
                  .ninox.apiKey =
                  apiKey;

                /*
                 * Si el usuario guarda una API key válida,
                 * Ninox queda conectado.
                 *
                 * Antes podía quedar:
                 * apiKey presente + enabled false.
                 */
                integrations
                  .ninox.enabled =
                  true;
              }

              if (
                webhookSecret
              ) {
                integrations
                  .ninox
                  .webhookSecret =
                  webhookSecret;
              }

              break;
            }
          }

          const nextStore:
            IntegrationStore = {
            version: 1,
            integrations,

            updatedAt:
              new Date()
                .toISOString(),

            updatedBy:
              actor.email,
          };

          await writeStore(
            nextStore,
          );

          applyRuntime(
            integrations,
          );

          await audit({
            action:
              "integration.saved",

            provider,
            actorId:
              actor.id,

            actorEmail:
              actor.email,
          });

          return nextStore;
        },
      );

  mutationQueue =
    operation.then(
      () => undefined,
      () => undefined,
    );

  await operation;

  return getPublicIntegrationConfig();
}

export async function disconnectIntegration(
  provider:
    IntegrationProvider,

  actor: {
    id: string;
    email: string;
  },
) {
  const operation =
    mutationQueue
      .catch(
        () => undefined,
      )
      .then(
        async () => {
          const store =
            await readStore();

          const integrations =
            structuredClone(
              store.integrations,
            );

          (
            integrations as unknown as
              Record<
                string,
                unknown
              >
          )[provider] =
            emptyProvider(
              provider,
            );

          const nextStore:
            IntegrationStore = {
            version: 1,
            integrations,

            updatedAt:
              new Date()
                .toISOString(),

            updatedBy:
              actor.email,
          };

          await writeStore(
            nextStore,
          );

          applyRuntime(
            integrations,
          );

          await audit({
            action:
              "integration.disconnected",

            provider,
            actorId:
              actor.id,

            actorEmail:
              actor.email,
          });
        },
      );

  mutationQueue =
    operation.then(
      () => undefined,
      () => undefined,
    );

  await operation;

  return getPublicIntegrationConfig();
}
