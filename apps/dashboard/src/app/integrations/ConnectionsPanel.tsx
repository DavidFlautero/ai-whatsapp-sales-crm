"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import styles from "./integrations.module.css";

const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL ||
  "https://panel.fulanitasfabrica.site/api"
).replace(/\/+$/, "");

type Provider =
  | "whatsapp"
  | "anthropic"
  | "groq"
  | "supabase"
  | "ninox";

type ConnectionStatus =
  | "online"
  | "missing_config"
  | "invalid_credentials"
  | "invalid_config"
  | "degraded"
  | "unreachable"
  | "error";

type StatusCheck = {
  status:
    ConnectionStatus;

  configured: boolean;
  checkedAt: string;
  latencyMs:
    | number
    | null;
  message: string;
};

type SystemStatus = {
  services: {
    whatsapp:
      StatusCheck;

    claude:
      StatusCheck;

    supabase:
      StatusCheck;

    ninox:
      StatusCheck;

    audio:
      StatusCheck;
  };
};

type PublicConfig = {
  updatedAt: string;
  updatedBy:
    | string
    | null;

  whatsapp: {
    configured: boolean;
    tokenMasked:
      | string
      | null;

    verifyTokenMasked:
      | string
      | null;

    phoneNumberId: string;
    businessAccountId: string;
    graphVersion: string;
  };

  anthropic: {
    configured: boolean;
    apiKeyMasked:
      | string
      | null;
  };

  groq: {
    configured: boolean;
    apiKeyMasked:
      | string
      | null;
  };

  supabase: {
    configured: boolean;
    url: string;

    serviceRoleKeyMasked:
      | string
      | null;

    anonKeyMasked:
      | string
      | null;
  };

  ninox: {
    configured: boolean;
    enabled: boolean;
    baseUrl: string;

    apiKeyMasked:
      | string
      | null;

    webhookSecretMasked:
      | string
      | null;
  };
};

type TestResult = {
  provider: Provider;

  status:
    ConnectionStatus;

  configured: boolean;
  checkedAt: string;

  latencyMs:
    | number
    | null;

  message: string;

  details?: Record<
    string,
    string | number | boolean | null
  >;
};

type Draft =
  Record<
    Provider,
    Record<
      string,
      string | boolean
    >
  >;

type FieldDefinition = {
  key: string;
  label: string;

  type:
    | "text"
    | "password"
    | "url"
    | "checkbox";

  placeholder?: string;
  helperKey?: string;
};

type ProviderDefinition = {
  id: Provider;
  eyebrow: string;
  title: string;
  description: string;
  fields:
    FieldDefinition[];
};

const definitions:
  ProviderDefinition[] = [
  {
    id: "whatsapp",
    eyebrow:
      "CANAL COMERCIAL",
    title:
      "WhatsApp Business",
    description:
      "Meta Cloud API, número, webhook y recepción de mensajes.",

    fields: [
      {
        key: "token",
        label:
          "Token de acceso",
        type: "password",
        placeholder:
          "Dejar vacío para conservar el token actual",
        helperKey:
          "tokenMasked",
      },
      {
        key:
          "phoneNumberId",
        label:
          "Phone Number ID",
        type: "text",
      },
      {
        key:
          "businessAccountId",
        label:
          "Business Account ID",
        type: "text",
      },
      {
        key:
          "verifyToken",
        label:
          "Verify Token del webhook",
        type: "password",
        placeholder:
          "Dejar vacío para conservarlo",
        helperKey:
          "verifyTokenMasked",
      },
      {
        key:
          "graphVersion",
        label:
          "Versión Graph API",
        type: "text",
        placeholder: "v20.0",
      },
    ],
  },
  {
    id: "anthropic",
    eyebrow:
      "INTELIGENCIA COMERCIAL",
    title: "Anthropic",
    description:
      "Motor Claude para responder, analizar conversaciones y ejecutar agentes.",

    fields: [
      {
        key: "apiKey",
        label:
          "Anthropic API Key",
        type: "password",
        placeholder:
          "Dejar vacío para conservar la key actual",
        helperKey:
          "apiKeyMasked",
      },
    ],
  },
  {
    id: "groq",
    eyebrow:
      "AUDIO Y TRANSCRIPCIÓN",
    title: "Groq",
    description:
      "Transcripción rápida de notas de voz recibidas por WhatsApp.",

    fields: [
      {
        key: "apiKey",
        label:
          "Groq API Key",
        type: "password",
        placeholder:
          "Dejar vacío para conservar la key actual",
        helperKey:
          "apiKeyMasked",
      },
    ],
  },
  {
    id: "supabase",
    eyebrow:
      "BASE DE DATOS",
    title: "Supabase",
    description:
      "Persistencia de clientes, conversaciones, pedidos, stock y reservas.",

    fields: [
      {
        key: "url",
        label:
          "URL del proyecto",
        type: "url",
        placeholder:
          "https://proyecto.supabase.co",
      },
      {
        key:
          "serviceRoleKey",
        label:
          "Service Role Key",
        type: "password",
        placeholder:
          "Dejar vacío para conservarla",
        helperKey:
          "serviceRoleKeyMasked",
      },
      {
        key: "anonKey",
        label:
          "Anon Key",
        type: "password",
        placeholder:
          "Dejar vacío para conservarla",
        helperKey:
          "anonKeyMasked",
      },
    ],
  },
  {
    id: "ninox",
    eyebrow:
      "MIGRACIÓN Y SINCRONIZACIÓN",
    title: "Ninox",
    description:
      "Conexión temporal para importar o sincronizar datos del sistema anterior.",

    fields: [
      {
        key: "enabled",
        label:
          "Activar integración",
        type: "checkbox",
      },
      {
        key: "baseUrl",
        label: "Base URL",
        type: "url",
        placeholder:
          "https://api.ninox.com/v1",
      },
      {
        key: "apiKey",
        label:
          "Ninox API Key",
        type: "password",
        placeholder:
          "Dejar vacío para conservarla",
        helperKey:
          "apiKeyMasked",
      },
      {
        key:
          "webhookSecret",
        label:
          "Webhook Secret",
        type: "password",
        placeholder:
          "Dejar vacío para conservarlo",
        helperKey:
          "webhookSecretMasked",
      },
    ],
  },
];

const emptyDraft:
  Draft = {
  whatsapp: {
    token: "",
    phoneNumberId: "",
    businessAccountId: "",
    verifyToken: "",
    graphVersion: "v20.0",
  },

  anthropic: {
    apiKey: "",
  },

  groq: {
    apiKey: "",
  },

  supabase: {
    url: "",
    serviceRoleKey: "",
    anonKey: "",
  },

  ninox: {
    enabled: false,

    baseUrl:
      "https://api.ninox.com/v1",

    apiKey: "",
    webhookSecret: "",
  },
};

function statusLabel(
  status?:
    ConnectionStatus,
) {
  switch (status) {
    case "online":
      return "Conectada";

    case "missing_config":
      return "No configurada";

    case "invalid_credentials":
      return "Credencial inválida";

    case "invalid_config":
      return "Configuración inválida";

    case "degraded":
      return "Servicio degradado";

    case "unreachable":
      return "Sin respuesta";

    case "error":
      return "Error";

    default:
      return "Sin comprobar";
  }
}

function statusForProvider(
  provider: Provider,
  status:
    SystemStatus | null,
) {
  if (!status) {
    return null;
  }

  switch (provider) {
    case "whatsapp":
      return status
        .services
        .whatsapp;

    case "anthropic":
      return status
        .services
        .claude;

    case "groq":
      return status
        .services
        .audio;

    case "supabase":
      return status
        .services
        .supabase;

    case "ninox":
      return status
        .services
        .ninox;
  }
}

async function apiRequest<T>(
  path: string,
  init:
    RequestInit = {},
): Promise<T> {
  const response =
    await fetch(
      `${apiUrl}${path}`,
      {
        ...init,

        credentials:
          "include",

        cache:
          "no-store",

        headers: {
          "Content-Type":
            "application/json",

          ...(init.headers ||
            {}),
        },
      },
    );

  const body =
    await response
      .json()
      .catch(
        () => null,
      );

  if (!response.ok) {
    throw new Error(
      body?.message ||
      body?.error ||
      `Error HTTP ${response.status}`,
    );
  }

  return body as T;
}

export function ConnectionsPanel({
  initialStatus,
}: {
  initialStatus:
    SystemStatus | null;
}) {
  const [
    config,
    setConfig,
  ] = useState<
    PublicConfig | null
  >(null);

  const [
    status,
    setStatus,
  ] = useState<
    SystemStatus | null
  >(initialStatus);

  const [
    draft,
    setDraft,
  ] = useState<Draft>(
    emptyDraft,
  );

  const [
    results,
    setResults,
  ] = useState<
    Partial<
      Record<
        Provider,
        TestResult
      >
    >
  >({});

  const [
    busy,
    setBusy,
  ] = useState<
    Provider | null
  >(null);

  const [
    globalError,
    setGlobalError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const configuredCount =
    useMemo(
      () =>
        config
          ? definitions.filter(
              (
                definition,
              ) =>
                config[
                  definition.id
                ].configured,
            ).length
          : 0,
      [config],
    );

  function populateDraft(
    nextConfig:
      PublicConfig,
  ) {
    setDraft({
      whatsapp: {
        token: "",

        phoneNumberId:
          nextConfig
            .whatsapp
            .phoneNumberId ||
          "",

        businessAccountId:
          nextConfig
            .whatsapp
            .businessAccountId ||
          "",

        verifyToken: "",

        graphVersion:
          nextConfig
            .whatsapp
            .graphVersion ||
          "v20.0",
      },

      anthropic: {
        apiKey: "",
      },

      groq: {
        apiKey: "",
      },

      supabase: {
        url:
          nextConfig
            .supabase.url ||
          "",

        serviceRoleKey: "",
        anonKey: "",
      },

      ninox: {
        enabled:
          nextConfig
            .ninox.enabled,

        baseUrl:
          nextConfig
            .ninox
            .baseUrl ||
          "https://api.ninox.com/v1",

        apiKey: "",
        webhookSecret: "",
      },
    });
  }

  async function load() {
    setGlobalError("");

    try {
      const [
        configBody,
        statusBody,
      ] = await Promise.all([
        apiRequest<{
          ok: boolean;
          data: PublicConfig;
        }>(
          "/admin/integrations/config",
        ),

        apiRequest<SystemStatus>(
          "/admin/status",
        ),
      ]);

      setConfig(
        configBody.data,
      );

      populateDraft(
        configBody.data,
      );

      setStatus(
        statusBody,
      );
    } catch (
      error: unknown
    ) {
      setGlobalError(
        error instanceof Error
          ? error.message
          : "No fue posible cargar las integraciones.",
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function update(
    provider: Provider,
    key: string,
    value:
      string | boolean,
  ) {
    setDraft(
      (current) => ({
        ...current,

        [provider]: {
          ...current[
            provider
          ],

          [key]: value,
        },
      }),
    );

    setSuccess("");
    setGlobalError("");
  }

  function helper(
    provider: Provider,
    key?: string,
  ) {
    if (
      !config ||
      !key
    ) {
      return null;
    }

    const providerConfig =
      config[
        provider
      ] as unknown as
        Record<
          string,
          unknown
        >;

    const current =
      providerConfig[key];

    return typeof current ===
      "string"
      ? current
      : null;
  }

  async function test(
    provider:
      Provider,
  ) {
    setBusy(provider);
    setGlobalError("");
    setSuccess("");

    try {
      const body =
        await apiRequest<{
          ok: boolean;
          data:
            TestResult;
        }>(
          "/admin/integrations/test",
          {
            method:
              "POST",

            body:
              JSON.stringify({
                provider,

                values:
                  draft[
                    provider
                  ],
              }),
          },
        );

      setResults(
        (current) => ({
          ...current,

          [provider]:
            body.data,
        }),
      );
    } catch (
      error: unknown
    ) {
      setGlobalError(
        error instanceof Error
          ? error.message
          : "No fue posible probar la integración.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function save(
    provider:
      Provider,
  ) {
    setBusy(provider);
    setGlobalError("");
    setSuccess("");

    try {
      const body =
        await apiRequest<{
          ok: boolean;
          data:
            PublicConfig;
        }>(
          "/admin/integrations/config",
          {
            method:
              "PUT",

            body:
              JSON.stringify({
                provider,

                values:
                  draft[
                    provider
                  ],
              }),
          },
        );

      setConfig(
        body.data,
      );

      populateDraft(
        body.data,
      );

      setSuccess(
        `${definitions.find(
          (item) =>
            item.id ===
            provider,
        )?.title} guardada correctamente.`,
      );

      const statusBody =
        await apiRequest<SystemStatus>(
          "/admin/status",
        );

      setStatus(
        statusBody,
      );
    } catch (
      error: unknown
    ) {
      setGlobalError(
        error instanceof Error
          ? error.message
          : "No fue posible guardar la integración.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveAndTest(
    provider:
      Provider,
  ) {
    await save(
      provider,
    );

    await test(
      provider,
    );
  }

  async function disconnect(
    provider:
      Provider,
  ) {
    const name =
      definitions.find(
        (item) =>
          item.id ===
          provider,
      )?.title ||
      provider;

    if (
      !window.confirm(
        `¿Desconectar ${name}? Se eliminarán sus credenciales cifradas.`,
      )
    ) {
      return;
    }

    setBusy(provider);
    setGlobalError("");
    setSuccess("");

    try {
      const body =
        await apiRequest<{
          ok: boolean;
          data:
            PublicConfig;
        }>(
          `/admin/integrations/${provider}`,
          {
            method:
              "DELETE",
          },
        );

      setConfig(
        body.data,
      );

      populateDraft(
        body.data,
      );

      setResults(
        (current) => {
          const next = {
            ...current,
          };

          delete next[
            provider
          ];

          return next;
        },
      );

      setSuccess(
        `${name} desconectada.`,
      );

      const statusBody =
        await apiRequest<SystemStatus>(
          "/admin/status",
        );

      setStatus(
        statusBody,
      );
    } catch (
      error: unknown
    ) {
      setGlobalError(
        error instanceof Error
          ? error.message
          : "No fue posible desconectar la integración.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className={
        styles.module
      }
    >
      <section
        className={
          styles.summary
        }
      >
        <div>
          <span>
            CONFIGURACIÓN CENTRAL
          </span>

          <h2>
            Credenciales e integraciones
          </h2>

          <p>
            Las claves se cifran en el servidor. El navegador nunca recibe el valor completo guardado.
          </p>
        </div>

        <div
          className={
            styles.summaryMetrics
          }
        >
          <article>
            <strong>
              {configuredCount}/5
            </strong>

            <span>
              configuradas
            </span>
          </article>

          <article>
            <strong>
              {status
                ? Object
                    .values(
                      status
                        .services,
                    )
                    .filter(
                      (
                        item,
                      ) =>
                        item.status ===
                        "online",
                    )
                    .length
                : 0}
            </strong>

            <span>
              servicios online
            </span>
          </article>
        </div>
      </section>

      {globalError ? (
        <div
          className={`${styles.notice} ${styles.error}`}
          role="alert"
        >
          {globalError}
        </div>
      ) : null}

      {success ? (
        <div
          className={`${styles.notice} ${styles.success}`}
        >
          {success}
        </div>
      ) : null}

      <section
        className={
          styles.grid
        }
      >
        {definitions.map(
          (
            definition,
          ) => {
            const currentStatus =
              statusForProvider(
                definition.id,
                status,
              );

            const testResult =
              results[
                definition.id
              ];

            const effectiveStatus =
              testResult?.status ||
              currentStatus?.status;

            const isBusy =
              busy ===
              definition.id;

            return (
              <article
                className={
                  styles.card
                }
                key={
                  definition.id
                }
              >
                <header
                  className={
                    styles.cardHeader
                  }
                >
                  <div>
                    <span
                      className={
                        styles.eyebrow
                      }
                    >
                      {definition.eyebrow}
                    </span>

                    <h3>
                      {definition.title}
                    </h3>

                    <p>
                      {definition.description}
                    </p>
                  </div>

                  <span
                    className={`${styles.status} ${
                      effectiveStatus ===
                      "online"
                        ? styles.online
                        : effectiveStatus ===
                            "missing_config"
                          ? styles.missing
                          : styles.warning
                    }`}
                  >
                    <i />

                    {statusLabel(
                      effectiveStatus,
                    )}
                  </span>
                </header>

                <div
                  className={
                    styles.fields
                  }
                >
                  {definition.fields.map(
                    (
                      field,
                    ) => {
                      const fieldValue =
                        draft[
                          definition.id
                        ][
                          field.key
                        ];

                      if (
                        field.type ===
                        "checkbox"
                      ) {
                        return (
                          <label
                            className={
                              styles.checkbox
                            }
                            key={
                              field.key
                            }
                          >
                            <input
                              type="checkbox"
                              checked={
                                Boolean(
                                  fieldValue,
                                )
                              }
                              onChange={(
                                event,
                              ) =>
                                update(
                                  definition.id,
                                  field.key,
                                  event
                                    .target
                                    .checked,
                                )
                              }
                            />

                            <span>
                              {field.label}
                            </span>
                          </label>
                        );
                      }

                      const savedValue =
                        helper(
                          definition.id,
                          field.helperKey,
                        );

                      return (
                        <label
                          className={
                            styles.field
                          }
                          key={
                            field.key
                          }
                        >
                          <span>
                            {field.label}
                          </span>

                          <input
                            type={
                              field.type
                            }
                            value={
                              String(
                                fieldValue ||
                                "",
                              )
                            }
                            placeholder={
                              field.placeholder
                            }
                            autoComplete="off"
                            onChange={(
                              event,
                            ) =>
                              update(
                                definition.id,
                                field.key,
                                event
                                  .target
                                  .value,
                              )
                            }
                          />

                          {savedValue ? (
                            <small>
                              Guardada:
                              {" "}
                              <code>
                                {savedValue}
                              </code>
                            </small>
                          ) : null}
                        </label>
                      );
                    },
                  )}
                </div>

                <div
                  className={
                    styles.diagnostic
                  }
                >
                  <div>
                    <span>
                      Último diagnóstico
                    </span>

                    <strong>
                      {testResult
                        ?.message ||
                        currentStatus
                          ?.message ||
                        "Todavía no se ejecutó una prueba."}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Latencia
                    </span>

                    <strong>
                      {(testResult
                        ?.latencyMs ??
                        currentStatus
                          ?.latencyMs) !==
                      null &&
                      (testResult
                        ?.latencyMs ??
                        currentStatus
                          ?.latencyMs) !==
                      undefined
                        ? `${
                            testResult
                              ?.latencyMs ??
                            currentStatus
                              ?.latencyMs
                          } ms`
                        : "—"}
                    </strong>
                  </div>
                </div>

                {testResult
                  ?.details ? (
                  <div
                    className={
                      styles.details
                    }
                  >
                    {Object.entries(
                      testResult.details,
                    ).map(
                      ([
                        key,
                        value,
                      ]) => (
                        <div
                          key={
                            key
                          }
                        >
                          <span>
                            {key}
                          </span>

                          <strong>
                            {String(
                              value ??
                              "—",
                            )}
                          </strong>
                        </div>
                      ),
                    )}
                  </div>
                ) : null}

                <footer
                  className={
                    styles.actions
                  }
                >
                  <button
                    type="button"
                    onClick={() =>
                      void test(
                        definition.id,
                      )
                    }
                    disabled={
                      isBusy
                    }
                  >
                    {isBusy
                      ? "Procesando…"
                      : "Probar sin guardar"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void save(
                        definition.id,
                      )
                    }
                    disabled={
                      isBusy
                    }
                  >
                    Guardar
                  </button>

                  <button
                    type="button"
                    className={
                      styles.primary
                    }
                    onClick={() =>
                      void saveAndTest(
                        definition.id,
                      )
                    }
                    disabled={
                      isBusy
                    }
                  >
                    Guardar y probar
                  </button>

                  <button
                    type="button"
                    className={
                      styles.danger
                    }
                    onClick={() =>
                      void disconnect(
                        definition.id,
                      )
                    }
                    disabled={
                      isBusy
                    }
                  >
                    Desconectar
                  </button>
                </footer>
              </article>
            );
          },
        )}
      </section>

      <section
        className={
          styles.security
        }
      >
        <div
          className={
            styles.securityIcon
          }
        >
          ✓
        </div>

        <div>
          <strong>
            Almacenamiento seguro
          </strong>

          <p>
            AES-256-GCM, permisos 600, valores enmascarados, actualización en ejecución y auditoría de cambios. Los campos secretos vacíos conservan la credencial anterior.
          </p>
        </div>

        <div
          className={
            styles.updated
          }
        >
          <span>
            Última modificación
          </span>

          <strong>
            {config
              ?.updatedAt
              ? new Intl
                  .DateTimeFormat(
                    "es-ES",
                    {
                      dateStyle:
                        "short",
                      timeStyle:
                        "short",
                    },
                  )
                  .format(
                    new Date(
                      config.updatedAt,
                    ),
                  )
              : "Sin datos"}
          </strong>

          <small>
            {config
              ?.updatedBy ||
              "Sistema"}
          </small>
        </div>
      </section>
    </div>
  );
}
