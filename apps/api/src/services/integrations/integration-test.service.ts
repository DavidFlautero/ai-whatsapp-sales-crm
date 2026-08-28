import {
  isIP,
} from "node:net";

import {
  lookup,
} from "node:dns/promises";

import {
  readIntegrationSecrets,
  type IntegrationProvider,
} from "./integration-secrets.repository.js";

export type IntegrationTestResult = {
  provider:
    IntegrationProvider;

  status:
    | "online"
    | "missing_config"
    | "invalid_credentials"
    | "invalid_config"
    | "degraded"
    | "unreachable"
    | "error";

  configured: boolean;
  checkedAt: string;
  latencyMs: number | null;
  message: string;

  details?: Record<
    string,
    string | number | boolean | null
  >;
};

function text(
  values:
    Record<
      string,
      unknown
    >,

  field: string,

  fallback: string,
) {
  const candidate =
    values[field];

  if (
    typeof candidate ===
      "string" &&
    candidate.trim()
  ) {
    return candidate.trim();
  }

  return fallback;
}

function privateIpv4(
  address: string,
) {
  const parts =
    address
      .split(".")
      .map(Number);

  if (
    parts.length !== 4
  ) {
    return false;
  }

  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (
      parts[0] === 169 &&
      parts[1] === 254
    ) ||
    (
      parts[0] === 172 &&
      parts[1] >= 16 &&
      parts[1] <= 31
    ) ||
    (
      parts[0] === 192 &&
      parts[1] === 168
    ) ||
    parts[0] === 0
  );
}

function privateIpv6(
  address: string,
) {
  const normalized =
    address.toLowerCase();

  return (
    normalized === "::1" ||
    normalized.startsWith(
      "fc",
    ) ||
    normalized.startsWith(
      "fd",
    ) ||
    normalized.startsWith(
      "fe80:",
    )
  );
}

async function publicHttpsUrl(
  raw: string,
) {
  const parsed =
    new URL(raw);

  if (
    parsed.protocol !==
    "https:"
  ) {
    throw new Error(
      "La URL debe utilizar HTTPS.",
    );
  }

  if (
    parsed.username ||
    parsed.password
  ) {
    throw new Error(
      "La URL no puede incluir credenciales.",
    );
  }

  const hostname =
    parsed.hostname
      .toLowerCase();

  if (
    hostname ===
      "localhost" ||
    hostname.endsWith(
      ".local",
    )
  ) {
    throw new Error(
      "La URL no puede apuntar a una dirección local.",
    );
  }

  if (isIP(hostname)) {
    if (
      (
        isIP(hostname) === 4 &&
        privateIpv4(hostname)
      ) ||
      (
        isIP(hostname) === 6 &&
        privateIpv6(hostname)
      )
    ) {
      throw new Error(
        "La URL no puede apuntar a una red privada.",
      );
    }

    return parsed;
  }

  const addresses =
    await lookup(
      hostname,
      {
        all: true,
      },
    );

  for (
    const result
    of addresses
  ) {
    if (
      (
        result.family === 4 &&
        privateIpv4(
          result.address,
        )
      ) ||
      (
        result.family === 6 &&
        privateIpv6(
          result.address,
        )
      )
    ) {
      throw new Error(
        "El dominio resuelve a una red privada.",
      );
    }
  }

  return parsed;
}

async function timedFetch(
  url: string,
  init:
    RequestInit = {},
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      12000,
    );

  const started =
    Date.now();

  try {
    const response =
      await fetch(
        url,
        {
          ...init,
          signal:
            controller.signal,
        },
      );

    return {
      response,
      latencyMs:
        Date.now() -
        started,
    };
  } finally {
    clearTimeout(
      timeout,
    );
  }
}

function httpFailure(
  provider:
    IntegrationProvider,

  response:
    Response,

  latencyMs: number,
): IntegrationTestResult {
  if (
    response.status ===
      401 ||
    response.status ===
      403
  ) {
    return {
      provider,
      status:
        "invalid_credentials",
      configured: true,

      checkedAt:
        new Date()
          .toISOString(),

      latencyMs,

      message:
        `Credenciales rechazadas (HTTP ${response.status}).`,
    };
  }

  if (
    response.status ===
      400 ||
    response.status ===
      404
  ) {
    return {
      provider,
      status:
        "invalid_config",
      configured: true,

      checkedAt:
        new Date()
          .toISOString(),

      latencyMs,

      message:
        `La configuración no coincide con el servicio (HTTP ${response.status}).`,
    };
  }

  if (
    response.status ===
      408 ||
    response.status ===
      429 ||
    response.status >= 500
  ) {
    return {
      provider,
      status:
        "degraded",
      configured: true,

      checkedAt:
        new Date()
          .toISOString(),

      latencyMs,

      message:
        `El servicio respondió con disponibilidad limitada (HTTP ${response.status}).`,
    };
  }

  return {
    provider,
    status: "error",
    configured: true,

    checkedAt:
      new Date()
        .toISOString(),

    latencyMs,

    message:
      `El servicio respondió con HTTP ${response.status}.`,
  };
}

function missing(
  provider:
    IntegrationProvider,

  message: string,
): IntegrationTestResult {
  return {
    provider,
    status:
      "missing_config",
    configured: false,

    checkedAt:
      new Date()
        .toISOString(),

    latencyMs: null,
    message,
  };
}

export async function testIntegration(
  provider:
    IntegrationProvider,

  candidate:
    Record<
      string,
      unknown
    > = {},
): Promise<IntegrationTestResult> {
  const current =
    await readIntegrationSecrets();

  try {
    switch (provider) {
      case "whatsapp": {
        const token =
          text(
            candidate,
            "token",
            current
              .whatsapp.token,
          );

        const phoneNumberId =
          text(
            candidate,
            "phoneNumberId",
            current
              .whatsapp
              .phoneNumberId,
          );

        const graphVersion =
          text(
            candidate,
            "graphVersion",
            current
              .whatsapp
              .graphVersion ||
              "v20.0",
          );

        if (
          !token ||
          !phoneNumberId
        ) {
          return missing(
            provider,
            "Faltan el token o el Phone Number ID.",
          );
        }

        const url =
          `https://graph.facebook.com/${encodeURIComponent(
            graphVersion,
          )}/${encodeURIComponent(
            phoneNumberId,
          )}?fields=id,display_phone_number,verified_name,quality_rating`;

        const {
          response,
          latencyMs,
        } = await timedFetch(
          url,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          return httpFailure(
            provider,
            response,
            latencyMs,
          );
        }

        const body =
          await response
            .json()
            .catch(
              () => ({}),
            ) as Record<
              string,
              unknown
            >;

        return {
          provider,
          status: "online",
          configured: true,

          checkedAt:
            new Date()
              .toISOString(),

          latencyMs,

          message:
            "WhatsApp Cloud API validó el token y el número.",

          details: {
            phoneNumberId,

            displayPhoneNumber:
              typeof body
                .display_phone_number ===
                "string"
                ? body
                    .display_phone_number
                : null,

            verifiedName:
              typeof body
                .verified_name ===
                "string"
                ? body
                    .verified_name
                : null,

            qualityRating:
              typeof body
                .quality_rating ===
                "string"
                ? body
                    .quality_rating
                : null,
          },
        };
      }

      case "anthropic": {
        const apiKey =
          text(
            candidate,
            "apiKey",
            current
              .anthropic.apiKey,
          );

        if (!apiKey) {
          return missing(
            provider,
            "Falta la API key de Anthropic.",
          );
        }

        const {
          response,
          latencyMs,
        } = await timedFetch(
          "https://api.anthropic.com/v1/models?limit=1",
          {
            headers: {
              "x-api-key":
                apiKey,

              "anthropic-version":
                "2023-06-01",
            },
          },
        );

        if (!response.ok) {
          return httpFailure(
            provider,
            response,
            latencyMs,
          );
        }

        return {
          provider,
          status: "online",
          configured: true,

          checkedAt:
            new Date()
              .toISOString(),

          latencyMs,

          message:
            "Anthropic validó la credencial.",
        };
      }

      case "vision": {
        const apiKey =
          text(
            candidate,
            "apiKey",
            current
              .vision
              ?.apiKey
            ?? "",
          );

        const model =
          text(
            candidate,
            "model",
            current
              .vision
              ?.model
            ?? "",
          );

        if (
          !apiKey
          || !model
        ) {
          return missing(
            provider,
            "Faltan la API key y el modelo de visión.",
          );
        }

        const {
          response,
          latencyMs,
        } = await timedFetch(
          "https://api.anthropic.com/v1/models?limit=100",
          {
            headers: {
              "x-api-key":
                apiKey,

              "anthropic-version":
                "2023-06-01",
            },
          },
        );

        if (!response.ok) {
          return httpFailure(
            provider,
            response,
            latencyMs,
          );
        }

        const body =
          await response
            .json()
            .catch(
              () => ({}),
            ) as {
              data?: Array<{
                id?: unknown;
              }>;
            };

        const available =
          Array.isArray(
            body.data,
          )
            ? body.data.some(
                (item) =>
                  item?.id
                  === model,
              )
            : false;

        if (!available) {
          return {
            provider,

            status:
              "invalid_config",

            configured:
              true,

            checkedAt:
              new Date()
                .toISOString(),

            latencyMs,

            message:
              `La key es válida, pero el modelo "${model}" no apareció entre los modelos disponibles.`,

            details: {
              model,
            },
          };
        }

        return {
          provider,

          status:
            "online",

          configured:
            true,

          checkedAt:
            new Date()
              .toISOString(),

          latencyMs,

          message:
            "Visión validó la API key y el modelo.",

          details: {
            model,
          },
        };
      }

      case "groq": {
        const apiKey =
          text(
            candidate,
            "apiKey",
            current
              .groq.apiKey,
          );

        if (!apiKey) {
          return missing(
            provider,
            "Falta la API key de Groq.",
          );
        }

        const {
          response,
          latencyMs,
        } = await timedFetch(
          "https://api.groq.com/openai/v1/models",
          {
            headers: {
              Authorization:
                `Bearer ${apiKey}`,
            },
          },
        );

        if (!response.ok) {
          return httpFailure(
            provider,
            response,
            latencyMs,
          );
        }

        return {
          provider,
          status: "online",
          configured: true,

          checkedAt:
            new Date()
              .toISOString(),

          latencyMs,

          message:
            "Groq validó la credencial de audio.",
        };
      }

      case "supabase": {
        const url =
          text(
            candidate,
            "url",
            current
              .supabase.url,
          )
            .replace(
              /\/+$/,
              "",
            );

        const serviceRoleKey =
          text(
            candidate,
            "serviceRoleKey",
            current
              .supabase
              .serviceRoleKey,
          );

        const anonKey =
          text(
            candidate,
            "anonKey",
            current
              .supabase
              .anonKey,
          );

        const apiKey =
          serviceRoleKey ||
          anonKey;

        if (
          !url ||
          !apiKey
        ) {
          return missing(
            provider,
            "Faltan la URL y una key de Supabase.",
          );
        }

        await publicHttpsUrl(
          url,
        );

        const {
          response,
          latencyMs,
        } = await timedFetch(
          `${url}/rest/v1/`,
          {
            headers: {
              apikey:
                apiKey,

              Authorization:
                `Bearer ${apiKey}`,

              Accept:
                "application/json",
            },
          },
        );

        if (!response.ok) {
          return httpFailure(
            provider,
            response,
            latencyMs,
          );
        }

        return {
          provider,
          status: "online",
          configured: true,

          checkedAt:
            new Date()
              .toISOString(),

          latencyMs,

          message:
            "Supabase respondió correctamente.",

          details: {
            url,
            credential:
              serviceRoleKey
                ? "service_role"
                : "anon",
          },
        };
      }

      case "ninox": {
        const baseUrl =
          text(
            candidate,
            "baseUrl",
            current
              .ninox.baseUrl ||
              "https://api.ninox.com/v1",
          )
            .replace(
              /\/+$/,
              "",
            );

        const apiKey =
          text(
            candidate,
            "apiKey",
            current
              .ninox.apiKey,
          );

        if (!apiKey) {
          return missing(
            provider,
            "Falta la API key de Ninox.",
          );
        }

        await publicHttpsUrl(
          baseUrl,
        );

        const healthUrl =
          `${baseUrl}/integraciones/terceros/GetDataCurva`;

        const {
          response,
          latencyMs,
        } = await timedFetch(
          healthUrl,
          {
            headers: {
              "X-NX-TOKEN":
                apiKey,

              Accept:
                "application/json",
            },
          },
        );

        if (!response.ok) {
          const raw =
            await response
              .text()
              .catch(
                () => "",
              );

          if (
            response.status === 403
            && /600 segundos|esperar/i.test(
              raw,
            )
          ) {
            return {
              provider,

              status:
                "online",

              configured:
                true,

              checkedAt:
                new Date()
                  .toISOString(),

              latencyMs,

              message:
                "Ninox está conectado. El catálogo está dentro de su ventana de espera de 10 minutos.",

              details: {
                rateLimited:
                  true,

                retryAfterSeconds:
                  600,
              },
            };
          }

          return httpFailure(
            provider,
            response,
            latencyMs,
          );
        }

        return {
          provider,
          status: "online",
          configured: true,

          checkedAt:
            new Date()
              .toISOString(),

          latencyMs,

          message:
            "Ninox validó la credencial.",

          details: {
            baseUrl,
          },
        };
      }
    }
  } catch (
    error: unknown
  ) {
    const message =
      error instanceof Error
        ? error.message
        : "Error desconocido.";

    const aborted =
      error instanceof
        DOMException &&
      error.name ===
        "AbortError";

    return {
      provider,

      status:
        aborted
          ? "unreachable"
          : "error",

      configured: true,

      checkedAt:
        new Date()
          .toISOString(),

      latencyMs: null,

      message:
        aborted
          ? "La prueba superó el tiempo máximo de espera."
          : message,
    };
  }
}
