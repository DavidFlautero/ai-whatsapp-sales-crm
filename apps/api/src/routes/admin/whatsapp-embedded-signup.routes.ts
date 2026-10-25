import {
  Router,
} from "express";

import {
  z,
} from "zod";

import type {
  Request,
  Response,
} from "express";

import {
  requireRoles,
} from "../../middlewares/auth.middleware.js";

import {
  getPublicIntegrationConfig,
  saveIntegrationConfig,
} from "../../services/integrations/integration-secrets.repository.js";

export const adminWhatsappEmbeddedSignupRoutes =
  Router();

const completeSchema =
  z.object({
    code:
      z.string().min(1),

    wabaId:
      z.string().min(1),

    phoneNumberId:
      z.string()
        .optional()
        .nullable(),
  });

function actor(
  req: Request,
) {
  if (!req.authUser) {
    throw new Error(
      "Missing authenticated user",
    );
  }

  return {
    id:
      req.authUser.id,

    email:
      req.authUser.email,
  };
}

function metaSettings() {
  const appId =
    process.env
      .META_WHATSAPP_APP_ID
      ?.trim() || "";

  const appSecret =
    process.env
      .META_WHATSAPP_APP_SECRET
      ?.trim() || "";

  const configId =
    process.env
      .META_WHATSAPP_CONFIG_ID
      ?.trim() || "";

  const graphVersion =
    process.env
      .META_WHATSAPP_GRAPH_VERSION
      ?.trim() ||
    "v26.0";

  return {
    appId,
    appSecret,
    configId,
    graphVersion,
  };
}

async function readMetaResponse<T>(
  response: globalThis.Response,
): Promise<T> {
  const body =
    await response
      .json()
      .catch(
        () => null,
      ) as
      | T
      | {
          error?: {
            message?: string;
            type?: string;
            code?: number;
          };
        }
      | null;

  if (!response.ok) {
    const errorBody =
      body as {
        error?: {
          message?: string;
          type?: string;
          code?: number;
        };
      } | null;

    throw new Error(
      errorBody
        ?.error
        ?.message ||
      `Meta Graph API error ${response.status}`,
    );
  }

  return body as T;
}

adminWhatsappEmbeddedSignupRoutes.get(
  "/config",

  requireRoles(
    "superadmin",
    "owner",
    "admin",
  ),

  async (
    _req: Request,
    res: Response,
  ) => {
    const {
      appId,
      appSecret,
      configId,
      graphVersion,
    } =
      metaSettings();

    return res.json({
      ok: true,

      data: {
        appId,
        configId,
        graphVersion,

        ready:
          Boolean(
            appId &&
            appSecret &&
            configId,
          ),

        serverSecretConfigured:
          Boolean(
            appSecret,
          ),
      },
    });
  },
);

adminWhatsappEmbeddedSignupRoutes.post(
  "/complete",

  requireRoles(
    "superadmin",
    "owner",
    "admin",
  ),

  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const input =
        completeSchema.parse(
          req.body,
        );

      const {
        appId,
        appSecret,
        configId,
        graphVersion,
      } =
        metaSettings();

      if (
        !appId ||
        !appSecret ||
        !configId
      ) {
        return res
          .status(503)
          .json({
            ok: false,

            error:
              "META_EMBEDDED_SIGNUP_NOT_CONFIGURED",

            message:
              "Falta configurar la aplicación de Meta para Embedded Signup.",
          });
      }

      /*
       * 1. Intercambiar el código temporal
       *    por el access token del negocio.
       *
       * El App Secret nunca sale del backend.
       */
      const params =
        new URLSearchParams({
          client_id:
            appId,

          client_secret:
            appSecret,

          code:
            input.code,
        });

      const tokenResponse =
        await fetch(
          `https://graph.facebook.com/${graphVersion}/oauth/access_token?${params.toString()}`,
          {
            method:
              "GET",
          },
        );

      const tokenBody =
        await readMetaResponse<{
          access_token: string;
          token_type?: string;
        }>(
          tokenResponse,
        );

      const accessToken =
        tokenBody.access_token;

      if (!accessToken) {
        throw new Error(
          "Meta no devolvió access_token.",
        );
      }

      /*
       * 2. Suscribir nuestra app al WABA.
       */
      const subscribeResponse =
        await fetch(
          `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(input.wabaId)}/subscribed_apps`,
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          },
        );

      await readMetaResponse<{
        success?: boolean;
      }>(
        subscribeResponse,
      );

      /*
       * 3. En Coexistence el evento FINISH puede
       *    traer solo waba_id.
       *
       * Si no tenemos phone_number_id,
       * lo descubrimos desde el WABA.
       */
      let phoneNumberId =
        input.phoneNumberId
          ?.trim() || "";

      let phoneDetails: {
        id: string;
        display_phone_number?: string;
        verified_name?: string;
        is_on_biz_app?: boolean;
        platform_type?: string;
      } | null =
        null;

      const phoneListResponse =
        await fetch(
          `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(input.wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name`,
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          },
        );

      const phoneList =
        await readMetaResponse<{
          data?: Array<{
            id: string;
            display_phone_number?: string;
            verified_name?: string;
          }>;
        }>(
          phoneListResponse,
        );

      const candidates =
        phoneList.data || [];

      if (
        !phoneNumberId &&
        candidates.length === 1
      ) {
        phoneNumberId =
          candidates[0]?.id || "";
      }

      if (
        !phoneNumberId &&
        candidates.length > 1
      ) {
        for (
          const candidate
          of candidates
        ) {
          const detailResponse =
            await fetch(
              `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(candidate.id)}?fields=id,display_phone_number,verified_name,is_on_biz_app,platform_type`,
              {
                headers: {
                  Authorization:
                    `Bearer ${accessToken}`,
                },
              },
            );

          const detail =
            await readMetaResponse<{
              id: string;
              display_phone_number?: string;
              verified_name?: string;
              is_on_biz_app?: boolean;
              platform_type?: string;
            }>(
              detailResponse,
            );

          if (
            detail
              .is_on_biz_app ===
            true
          ) {
            phoneNumberId =
              detail.id;

            phoneDetails =
              detail;

            break;
          }
        }
      }

      if (!phoneNumberId) {
        throw new Error(
          "No fue posible identificar el Phone Number ID del número conectado.",
        );
      }

      /*
       * 4. Consultar el estado final del número.
       */
      if (!phoneDetails) {
        const detailResponse =
          await fetch(
            `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name,is_on_biz_app,platform_type`,
            {
              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
              },
            },
          );

        phoneDetails =
          await readMetaResponse<{
            id: string;
            display_phone_number?: string;
            verified_name?: string;
            is_on_biz_app?: boolean;
            platform_type?: string;
          }>(
            detailResponse,
          );
      }

      /*
       * 5. Guardar en nuestro store cifrado.
       *
       * verifyToken existente se conserva porque
       * no lo estamos reemplazando.
       */
      const publicConfig =
        await saveIntegrationConfig(
          "whatsapp",

          {
            token:
              accessToken,

            phoneNumberId,

            businessAccountId:
              input.wabaId,

            graphVersion,
          },

          actor(req),
        );

      return res.json({
        ok: true,

        data: {
          connected:
            true,

          wabaId:
            input.wabaId,

          phoneNumberId,

          displayPhoneNumber:
            phoneDetails
              ?.display_phone_number ||
            null,

          verifiedName:
            phoneDetails
              ?.verified_name ||
            null,

          coexistence:
            phoneDetails
              ?.is_on_biz_app ===
            true,

          platformType:
            phoneDetails
              ?.platform_type ||
            null,

          config:
            publicConfig,
        },
      });
    } catch (
      error: unknown
    ) {
      console.error(
        "[WHATSAPP EMBEDDED SIGNUP]",
        error,
      );

      if (
        error instanceof
        z.ZodError
      ) {
        return res
          .status(400)
          .json({
            ok: false,

            error:
              "VALIDATION_ERROR",

            message:
              error.issues[0]
                ?.message ||
              "Datos inválidos.",
          });
      }

      return res
        .status(500)
        .json({
          ok: false,

          error:
            "WHATSAPP_EMBEDDED_SIGNUP_ERROR",

          message:
            error instanceof
              Error
              ? error.message
              : "No fue posible completar la conexión con WhatsApp.",
        });
    }
  },
);
