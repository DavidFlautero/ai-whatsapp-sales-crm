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
  res.sendStatus(200);

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
