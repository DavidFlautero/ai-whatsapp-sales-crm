import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import type {
  Request,
  Response,
} from "express";

import {
  env,
} from "../config/env.js";

import {
  handleWhatsappIncoming,
  type WhatsappWebhookPayload,
} from "../webhooks/whatsapp.webhook.js";

import {
  countWhatsappCallingEvents,
  handleWhatsappCallingWebhook,
} from "../webhooks/whatsapp-calling.webhook.js";

type RequestWithRawBody =
  Request & {
    rawBody?: Buffer;
  };

function validateWhatsappSignature(
  req: Request,
) {
  const appSecret =
    process.env
      .WHATSAPP_APP_SECRET
      ?.trim();

  if (!appSecret) {
    return {
      configured:
        false,
      valid:
        true,
    };
  }

  const signature =
    req.get(
      "x-hub-signature-256",
    )?.trim();

  const rawBody =
    (
      req as RequestWithRawBody
    ).rawBody;

  if (
    !signature
    || !rawBody
  ) {
    return {
      configured:
        true,
      valid:
        false,
    };
  }

  const digest =
    createHmac(
      "sha256",
      appSecret,
    )
      .update(rawBody)
      .digest("hex");

  const expected =
    Buffer.from(
      `sha256=${digest}`,
      "utf8",
    );

  const received =
    Buffer.from(
      signature,
      "utf8",
    );

  return {
    configured:
      true,
    valid:
      expected.length
        === received.length
      && timingSafeEqual(
        expected,
        received,
      ),
  };
}

export async function verifyWhatsappWebhook(
  req: Request,
  res: Response,
) {
  const mode =
    req.query["hub.mode"];

  const token =
    req.query["hub.verify_token"];

  const challenge =
    req.query["hub.challenge"];

  if (
    mode === "subscribe"
    && token
      === env.WHATSAPP_VERIFY_TOKEN
  ) {
    return res
      .status(200)
      .send(challenge);
  }

  return res.sendStatus(403);
}

export function receiveWhatsappWebhook(
  req: Request,
  res: Response,
) {
  const signature =
    validateWhatsappSignature(
      req,
    );

  if (!signature.valid) {
    console.warn(
      "[WHATSAPP WEBHOOK INVALID SIGNATURE]",
      {
        receivedAt:
          new Date()
            .toISOString(),
      },
    );

    return res.sendStatus(401);
  }

  const entryCount =
    Array.isArray(req.body?.entry)
      ? req.body.entry.length
      : 0;

  const callingEventCount =
    countWhatsappCallingEvents(
      req.body,
    );

  console.log(
    "[WHATSAPP WEBHOOK RECEIVED]",
    {
      object:
        typeof req.body?.object
        === "string"
          ? req.body.object
          : null,

      entryCount,

      callingEventCount,

      signatureVerification:
        signature.configured
          ? "verified"
          : "not_configured",

      receivedAt:
        new Date()
          .toISOString(),
    },
  );

  res.sendStatus(200);

  if (callingEventCount > 0) {
    void handleWhatsappCallingWebhook(
      req.body,
    ).catch(
      (error) => {
        console.error(
          "[WHATSAPP CALLING WEBHOOK ERROR]",
          error,
        );
      },
    );
  }

  void handleWhatsappIncoming(
    req.body as WhatsappWebhookPayload,
  ).catch(
    (error) => {
      console.error(
        "[WHATSAPP WEBHOOK ERROR]",
        error,
      );
    },
  );
}
