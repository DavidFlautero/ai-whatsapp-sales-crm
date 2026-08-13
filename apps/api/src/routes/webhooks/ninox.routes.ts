import {
  timingSafeEqual,
} from "node:crypto";

import {
  Router,
} from "express";

import {
  readIntegrationSecrets,
} from "../../services/integrations/integration-secrets.repository.js";

import {
  handleNinoxWebhook,
} from "../../services/ninox/ninox.webhook.js";

import {
  scheduleCatalogMediaMonitor,
} from "../../services/catalog/catalog-media-monitor.service.js";


function secretsMatch(
  received: string,
  expected: string,
) {
  const receivedBuffer =
    Buffer.from(
      received,
    );

  const expectedBuffer =
    Buffer.from(
      expected,
    );

  if (
    receivedBuffer.length
    !== expectedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    receivedBuffer,
    expectedBuffer,
  );
}


export const ninoxWebhookRoutes =
  Router();


ninoxWebhookRoutes.post(
  "/articles",

  async (
    req,
    res,
  ) => {

    const startedAt =
      Date.now();

    try {
      const integrations =
        await readIntegrationSecrets();

      const expectedSecret =
        integrations
          .ninox
          .webhookSecret
          .trim();


      if (!expectedSecret) {
        return res
          .status(503)
          .json({
            ok:
              false,

            error:
              "Ninox webhook is not configured",
          });
      }


      const receivedHeader =
        req.get(
          "X-Ninox-Webhook-Secret",
        );


      if (
        !receivedHeader
        || !secretsMatch(
          receivedHeader,
          expectedSecret,
        )
      ) {
        return res
          .status(401)
          .json({
            ok:
              false,

            error:
              "Unauthorized",
          });
      }


      const result =
        await handleNinoxWebhook(
          req.body,
        );


      console.log(
        "[NINOX WEBHOOK OK]",
        {
          action:
            result.action,

          articleIds:
            result.articleIds,

          variantsReceived:
            result.variantsReceived,

          variantsStored:
            result.variantsStored,

          totalCached:
            result.totalCached,

          latencyMs:
            Date.now()
            - startedAt,
        },
      );


      /*
       * Ninox exige 200 OK cuando
       * procesamos correctamente.
       */

      /*
       * NINOX -> CATALOG MEDIA MONITOR
       *
       * No esperamos al detector:
       * el webhook responde rápido.
       * El debounce agrupa ráfagas.
       * El cron actúa como backstop.
       */
      scheduleCatalogMediaMonitor({
        companyId:
          process.env
            .DEFAULT_COMPANY_ID
          || "fulanitas",

        source:
          "ninox-webhook",
      });


return res
        .status(200)
        .json(
          result,
        );

    } catch (error) {

      const message =
        error instanceof Error
          ? error.message
          : String(error);


      if (
        message ===
          "NINOX_WEBHOOK_INVALID_PAYLOAD"
        || message ===
          "NINOX_WEBHOOK_INVALID_ARTICLE_ID"
        || message ===
          "NINOX_WEBHOOK_NO_VALID_VARIANTS"
      ) {
        console.warn(
          "[NINOX WEBHOOK INVALID]",
          {
            message,

            latencyMs:
              Date.now()
              - startedAt,
          },
        );

        return res
          .status(400)
          .json({
            ok:
              false,

            error:
              message,
          });
      }


      console.error(
        "[NINOX WEBHOOK ERROR]",
        error,
      );


      return res
        .status(500)
        .json({
          ok:
            false,

          error:
            "Internal server error",
        });
    }
  },
);
