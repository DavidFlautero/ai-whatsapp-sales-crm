import {
  timingSafeEqual,
} from "node:crypto";

import {
  Router,
} from "express";

import {
  z,
} from "zod";

import {
  SupabaseRpcError,
  supabaseRpc,
} from "../../services/db/supabase-rest.client.js";

import {
  readIntegrationSecrets,
} from "../../services/integrations/integration-secrets.repository.js";


const COMPANY_ID =
  "fulanitas";


const payloadSchema =
  z.object({
    sku:
      z.string()
        .trim()
        .min(1)
        .max(160),

    onHand:
      z.number()
        .int()
        .nonnegative(),

    idempotencyKey:
      z.string()
        .trim()
        .min(8)
        .max(240),

    warehouseCode:
      z.string()
        .trim()
        .min(1)
        .max(80)
        .optional()
        .default("CENTRAL"),

    metadata:
      z.record(
        z.string(),
        z.unknown(),
      )
        .optional()
        .default({}),
  })
    .strict();


function secretsMatch(
  received: string,
  expected: string,
) {
  const receivedBuffer =
    Buffer.from(received);

  const expectedBuffer =
    Buffer.from(expected);

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


function rpcErrorStatus(
  error: SupabaseRpcError,
) {
  if (
    error.message.startsWith(
      "VARIANT_NOT_FOUND",
    )
    || error.message.startsWith(
      "WAREHOUSE_NOT_FOUND",
    )
  ) {
    return 404;
  }

  if (
    error.message.startsWith(
      "IDEMPOTENCY_CONFLICT",
    )
    || error.message.startsWith(
      "EXTERNAL_STOCK_BELOW_RESERVED",
    )
  ) {
    return 409;
  }

  if (
    error.message.startsWith(
      "COMPANY_REQUIRED",
    )
    || error.message.startsWith(
      "VARIANT_SKU_REQUIRED",
    )
    || error.message.startsWith(
      "EXTERNAL_STOCK_INVALID",
    )
    || error.message.startsWith(
      "IDEMPOTENCY_KEY_INVALID",
    )
    || error.message.startsWith(
      "WAREHOUSE_CODE_REQUIRED",
    )
  ) {
    return 400;
  }

  return 500;
}


function publicRpcError(
  error: SupabaseRpcError,
) {
  const status =
    rpcErrorStatus(error);

  if (status === 500) {
    return {
      status,
      body: {
        ok: false,
        error:
          "Stock synchronization failed",
      },
    };
  }

  return {
    status,
    body: {
      ok: false,
      error:
        error.message,
    },
  };
}


export const ninoxWebhookRoutes =
  Router();


ninoxWebhookRoutes.post(
  "/articles",

  async (
    req,
    res,
  ) => {
    const integrations =
      await readIntegrationSecrets();

    const expectedSecret =
      integrations.ninox
        .webhookSecret
        .trim();

    if (!expectedSecret) {
      return res.status(503).json({
        ok: false,
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
      return res.status(401).json({
        ok: false,
        error:
          "Unauthorized",
      });
    }

    const parsed =
      payloadSchema.safeParse(
        req.body,
      );

    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error:
          "Invalid webhook payload",
        issues:
          parsed.error.issues.map(
            (issue) => ({
              path:
                issue.path.join("."),
              message:
                issue.message,
            }),
          ),
      });
    }

    const payload =
      parsed.data;

    try {
      const result =
        await supabaseRpc<
          Record<string, unknown>
        >(
          "commerce_sync_external_stock",
          {
            p_company_id:
              COMPANY_ID,

            p_variant_sku:
              payload.sku,

            p_external_on_hand:
              payload.onHand,

            p_idempotency_key:
              payload.idempotencyKey,

            p_warehouse_code:
              payload.warehouseCode,

            p_source:
              "ninox",

            p_metadata: {
              ...payload.metadata,

              webhook:
                "ninox-articles",
            },
          },
        );

      return res.status(200).json(
        result,
      );
    } catch (error) {
      if (
        error instanceof
          SupabaseRpcError
      ) {
        const response =
          publicRpcError(error);

        return res
          .status(response.status)
          .json(response.body);
      }

      console.error(
        "[ninox:webhook:error]",
        error,
      );

      return res.status(500).json({
        ok: false,
        error:
          "Internal server error",
      });
    }
  },
);
