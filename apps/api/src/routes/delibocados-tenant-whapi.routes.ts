import { queueDelibocadosImageVision } from "../services/whapi/delibocados-image-vision.service.js";
import { queueWhapiAudioTranscription } from "../services/whapi/whapi-audio-processing.service.js";
import { captureRestaurantWhatsappName } from "../services/crm/restaurant-whatsapp-profile.service.js";
import { captureRestaurantPaymentProof } from "../services/restaurant-ops/restaurant-payment-intake.service.js";
import { queueDelibocadosLiveReply } from "../services/whapi/delibocados-live-reply.service.js";
import { Router } from "express";
import { readFileSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";

import { saveMessage } from "../services/whapi/whapi-durable-message.service.js";
import { normalizeWhapiMessageType } from "../services/whapi/whapi-message-normalizer.js";
import { parseIncomingWhapiPoint } from "../services/whapi/whapi-location-parser.service.js";

export const delibocadosTenantWhapiRoutes = Router();

const COMPANY = "delibocados";
const SECRET_FILE = "/root/delibocados-whapi-webhook.secret";

function authorized(candidate: string | undefined): boolean {
  try {
    const expected = readFileSync(SECRET_FILE, "utf8").trim();
    const received = String(candidate ?? "").trim();

    if (!expected || !received) return false;

    const a = Buffer.from(expected);
    const b = Buffer.from(received);

    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

delibocadosTenantWhapiRoutes.get("/health", (_req, res) => {
  res.json({
    ok: true,
    companyId: COMPANY,
    receiver: "ready"
  });
});

delibocadosTenantWhapiRoutes.post("/webhook", async (req, res) => {
  if (!authorized(req.get("x-delibocados-webhook-secret"))) {
    res.status(401).json({
      ok: false,
      error: "INVALID_WEBHOOK_SECRET"
    });
    return;
  }

  const payload = req.body;

  const eventType = payload?.event?.type ?? payload?.event;

  if (eventType && eventType !== "messages") {
    res.json({ ok: true, ignored: true });
    return;
  }

  const messages = Array.isArray(payload?.messages)
    ? payload.messages
    : payload?.message
      ? [payload.message]
      : [];

  if (messages.length > 50) {
    res.status(413).json({
      ok: false,
      error: "TOO_MANY_MESSAGES"
    });
    return;
  }

  let saved = 0;
  let duplicates = 0;
  let ignored = 0;
  let paymentIntakeFailures = 0;

  try {
    for (const message of messages) {
      const fromMe = message?.from_me === true;

      const chatId = String(message?.chat_id ?? "");

      if (
        chatId.endsWith("@g.us") ||
        chatId.endsWith("@broadcast")
      ) {
        ignored++;
        continue;
      }

      const rawPhone = String(
        fromMe
          ? (message?.chat_id ?? message?.to ?? "")
          : (message?.from ?? message?.chat_id ?? "")
      );

      const phone = rawPhone
        .split("@")[0]
        .replace(/\D/g, "");

      const externalId = String(message?.id ?? "").trim();

      if (
        !/^[0-9]{8,15}$/.test(phone) ||
        !externalId ||
        externalId.length > 255
      ) {
        ignored++;
        continue;
      }

      const rawType = String(message?.type ?? "text");
      const messageType = normalizeWhapiMessageType(rawType);

      const bodyValue =
        message?.text?.body ??
        message?.body ??
        message?.caption ??
        message?.[rawType]?.caption;

      const body =
        typeof bodyValue === "string" && bodyValue.trim()
          ? bodyValue.trim().slice(0, 8000)
          : `[${messageType}]`;

      const timestamp = Number(message?.timestamp);

      const occurredAt =
        Number.isFinite(timestamp) && timestamp > 0
          ? new Date(
              timestamp > 1e12 ? timestamp : timestamp * 1000
            )
          : null;

      const result = await saveMessage(
        {
          contact_phone: phone,
          external_message_id: externalId,
          direction: fromMe ? "outbound" : "inbound",
          channel: "whatsapp",
          message_type: messageType,
          body,
          media: {
              ...(
                (() => {
                  const value =
                    message?.[rawType] ??
                    message?.audio ??
                    message?.voice ??
                    message?.media;

                  return value &&
                    typeof value === "object" &&
                    !Array.isArray(value)
                    ? value
                    : {};
                })()
              ),
              provider: "whapi"
            },
          raw_payload: {
            provider: "whapi",
            message
          },
          delivery_status: fromMe ? "sent" : "received",
          occurred_at:
            occurredAt && !Number.isNaN(occurredAt.getTime())
              ? occurredAt.toISOString()
              : undefined
        },
        COMPANY
      );

      let pendingTransferProof = false;

      // Display names are provisional. CRM enrichment never blocks the webhook.
      if (!fromMe && !result.duplicate) {
        try {
          await captureRestaurantWhatsappName({
            companyId: COMPANY,
            phone,
            profileName: message?.from_name
          });
        } catch {
          console.warn("[DELIBOCADOS PROFILE] Enrichment failed", {
            last4: phone.slice(-4)
          });
        }
      }

        if (
          !fromMe &&
          (messageType === "image" || messageType === "document") &&
          result.message?.id
        ) {
          try {
            const receipt = await captureRestaurantPaymentProof({
              companyId: COMPANY,
              phone,
              internalMessageId: result.message.id,
              externalMessageId: externalId,
              kind: messageType,
              caption: body === "[" + messageType + "]" ? "" : body
            });
            pendingTransferProof = receipt.reason !== "NO_PENDING_TRANSFER";
            if (pendingTransferProof) {
              console.log("[DELIBOCADOS PAYMENT INTAKE]", {
                last4: phone.slice(-4),
                received: receipt.received,
                reason: receipt.reason,
                orderNumber: receipt.orderNumber ?? null
              });
            }
          } catch (error) {
            // The same message is safe to retry: saving and proof submission are idempotent.
            paymentIntakeFailures++;
            console.warn("[DELIBOCADOS PAYMENT INTAKE ERROR]", {
              type: error instanceof Error ? error.name : "UNKNOWN"
            });
          }
        }

      if (result.duplicate) {
        duplicates++;
      } else {
        saved++;

        if (
          !fromMe &&
          messageType === "image" &&
          !pendingTransferProof &&
          result.message?.id
        ) {
          queueDelibocadosImageVision({
            messageId: result.message.id,
            phone,
            sourceMessageId: externalId,
            occurredAt: occurredAt && !Number.isNaN(occurredAt.getTime())
              ? occurredAt.toISOString() : undefined,
            caption: body === "[image]" ? undefined : body
          });
        }

        if (
          !fromMe &&
          messageType === "audio" &&
          result.message?.id
        ) {
          queueWhapiAudioTranscription({
            messageId: result.message.id,
            companyId: COMPANY,
            contactPhone: phone,
            sourceMessageId: externalId,
            occurredAt:
              occurredAt && !Number.isNaN(occurredAt.getTime())
                ? occurredAt.toISOString() : undefined,
          });
        }


          if (
            !fromMe &&
            messageType === "location" &&
            result.message?.id
          ) {
            const location=parseIncomingWhapiPoint(message);
            if(location){
              queueDelibocadosLiveReply({
                occurredAt:occurredAt&&!Number.isNaN(occurredAt.getTime())
                  ? occurredAt.toISOString():undefined,
                companyId:COMPANY,
                phone,
                sourceMessageId:externalId,
                text:"[Ubicación compartida por WhatsApp]",
                location
              });
            } else {
              console.warn("[DELIBOCADOS WHAPI] Invalid location payload",{
                last4:phone.slice(-4)
              });
            }
          }

          if (
            !fromMe &&
            messageType === "text" &&
            body !== "[text]"
          ) {
            queueDelibocadosLiveReply({
              occurredAt:
                occurredAt && !Number.isNaN(occurredAt.getTime())
                  ? occurredAt.toISOString()
                  : undefined,
              companyId: COMPANY,
              phone,
              sourceMessageId: externalId,
              text: body
            });
          }

      }
    }

    console.log("[DELIBOCADOS WHAPI]", {
      saved,
      duplicates,
      ignored
    });

    if (paymentIntakeFailures > 0) {
      res.status(503).json({
        ok: false, error: "PAYMENT_INTAKE_RETRY_REQUIRED",
        saved, duplicates, ignored
      });
      return;
    }
    res.json({
      ok: true,
      companyId: COMPANY,
      saved,
      duplicates,
      ignored
    });

  } catch (error) {
    console.error("[DELIBOCADOS WEBHOOK ERROR]", {
      type: error instanceof Error ? error.name : "UNKNOWN"
    });

    res.status(503).json({
      ok: false,
      error: "MESSAGE_PERSISTENCE_FAILED"
    });
  }
});
