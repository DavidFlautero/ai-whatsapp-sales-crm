import {
  normalizeWhapiMessageType,
} from "../services/whapi/whapi-message-normalizer.js";

import {
  Router,
} from "express";

import {
  saveMessage,
} from "../services/whapi/whapi-durable-message.service.js";


import {
  appendFile,
  mkdir,
} from "node:fs/promises";

import {
  dirname,
  resolve,
} from "node:path";



import {
  getContactByPhone,
  upsertContact,
} from "../services/crm/crm.repository.js";

import {
  queueWhapiEventsReply,
} from "../services/whapi/whapi-events-agent.service.js";

import {
  queueWhapiEventIntake,
} from "../services/whapi/whapi-event-intake-queue.service.js";

import {
  env,
} from "../config/env.js";

import {
  queueWhapiAudioTranscription,
} from "../services/whapi/whapi-audio-processing.service.js";

export const whapiRoutes =
  Router();


const logFile =
  resolve(
    process.cwd(),
    "data",
    "whapi-webhook.jsonl",
  );


function secretValid(
  candidate: unknown,
) {
  const expected =
    process.env
      .WHAPI_WEBHOOK_SECRET
      ?.trim();


  /*
   * Si configuramos secret,
   * toda llamada real debe traerlo.
   */
  if (
    !expected
  ) {
    return false;
  }


  return (
    typeof candidate
      === "string"
    &&
    candidate === expected
  );
}


async function persist(
  payload: unknown,
) {
  try {
    await mkdir(
      dirname(
        logFile,
      ),
      {
        recursive:
          true,
      },
    );


    await appendFile(
      logFile,
      JSON.stringify({
        received_at:
          new Date()
            .toISOString(),

        payload,
      })
      +
      "\n",
      {
        encoding:
          "utf-8",
      },
    );
  }
  catch (
    error
  ) {
    console.error(
      "[WHAPI LOG ERROR]",
      error,
    );
  }
}


function messagesFrom(
  payload: any,
) {
  if (
    Array.isArray(
      payload?.messages,
    )
  ) {
    return payload.messages;
  }


  if (
    payload?.message
  ) {
    return [
      payload.message,
    ];
  }


  return [];
}


whapiRoutes.get(
  "/health",
  (
    _request,
    response,
  ) => {
    response.json({
      ok:
        true,

      provider:
        "whapi",

      webhook:
        "ready",

      tokenConfigured:
        Boolean(
          process.env
            .WHAPI_TOKEN
            ?.trim(),
        ),

      secretConfigured:
        Boolean(
          process.env
            .WHAPI_WEBHOOK_SECRET
            ?.trim(),
        ),

      now:
        new Date()
          .toISOString(),
    });
  },
);



whapiRoutes.post(
  "/webhook",
  async (request, response) => {

    const secret = request.get("x-whapi-secret");

    if (!secretValid(secret)) {
      console.warn("[WHAPI WEBHOOK] invalid secret");

      response.status(401).json({
        ok: false,
        error: "INVALID_WHAPI_WEBHOOK_SECRET",
      });

      return;
    }

    const payload = request.body;

    await persist(payload);

    const eventType = payload?.event?.type;

    if (eventType && eventType !== "messages") {
      response.json({ ok: true });
      return;
    }

    const messages = messagesFrom(payload);

    try {

      let savedCount = 0;
      let duplicateCount = 0;

      for (const message of messages) {

        const fromMe = message?.from_me === true;

        const chatId = String(
          message?.chat_id ?? ""
        );

        if (
          chatId.endsWith("@g.us") ||
          chatId.endsWith("@broadcast")
        ) {
          continue;
        }

        const rawFrom = String(
          fromMe
            ? (message?.chat_id ?? message?.to ?? "")
            : (message?.from ?? message?.chat_id ?? "")
        );

        const phone = rawFrom
          .split("@")[0]
          .replace(/\D/g, "");

        if (
          phone.length < 8 ||
          phone.length > 15
        ) {
          console.warn(
            "[WHAPI SKIP] invalid phone"
          );
          continue;
        }

        const externalId =
          typeof message?.id === "string"
            ? message.id.trim()
            : "";

        if (!externalId) {
          throw new Error(
            "WHAPI_MESSAGE_ID_REQUIRED"
          );
        }

        const rawType =
          typeof message?.type === "string"
            ? message.type
            : "text";

        // Normalizar tipos al contrato de PostgreSQL.
        // El tipo original permanece en raw_payload.
        const normalizedType =
          rawType.trim().toLowerCase();

        const candidateType =
          normalizedType === "voice" ||
          normalizedType === "ptt"
            ? "audio"
            : normalizedType;

        const allowedTypes = new Set([
          "text",
          "image",
          "audio",
          "video",
          "document",
          "location",
          "interactive",
          "unknown",
        ]);

        const messageType =
          normalizeWhapiMessageType(rawType);

        const isConversationalText =
          ["text", "chat", "extended_text"].includes(
            rawType.trim().toLowerCase(),
          );

        const bodyValue =
          message?.text?.body ??
          message?.body ??
          message?.caption ??
          message?.[rawType]?.caption ??
          message?.link_preview?.url;

        const body =
          typeof bodyValue === "string" &&
          bodyValue.trim()
            ? bodyValue.trim()
            : `[${messageType}]`;

        const rawTimestamp = Number(
          message?.timestamp
        );

        const timestampMs =
          rawTimestamp > 1e12
            ? rawTimestamp
            : rawTimestamp * 1000;

        const parsedDate = new Date(timestampMs);

        const occurredAt =
          Number.isFinite(rawTimestamp) &&
          rawTimestamp > 0 &&
          !Number.isNaN(parsedDate.getTime())
            ? parsedDate.toISOString()
            : undefined;

        const mediaBlock =
          message?.[rawType] ??
          message?.media;

        const media =
          mediaBlock &&
          typeof mediaBlock === "object" &&
          !Array.isArray(mediaBlock)
            ? {
                ...mediaBlock,
                provider: "whapi",
              }
            : {
                provider: "whapi",
              };

        const result = await saveMessage({
          contact_phone: phone,

          external_message_id: externalId,

          direction: fromMe ? "outbound" : "inbound",

          channel: "whatsapp",

          message_type: messageType,

          body,

          media,

          raw_payload: {
            provider: "whapi",
            message,
          },

          delivery_status: fromMe ? "sent" : "received",

          occurred_at: occurredAt,
        });

        if (
          !fromMe &&
          !result.duplicate &&
          messageType === "audio"
        ) {
          const internalMessageId = result.message?.id;

          if (internalMessageId) {
            queueWhapiAudioTranscription({
              messageId: internalMessageId,
              companyId: env.DEFAULT_COMPANY_ID,
            });
          } else {
            console.error(
              "[WHAPI AUDIO] Missing internal message ID",
            );
          }
        }

        if (result.duplicate) {
          duplicateCount++;
        } else {
          savedCount++;
        }

        // Recuperar nombre disponible en WhatsApp.

        const displayName =
          typeof (fromMe ? undefined : message?.from_name) === "string"
            ? message.from_name.trim().slice(0, 100)
            : "";

        const validName =
          displayName.length >= 2 &&
          !/^\+?\d+$/.test(displayName) &&
          !["sender", "receiver", "unknown"]
            .includes(displayName.toLowerCase());

        if (validName) {
          try {
            const existing =
              await getContactByPhone(
                phone,
                env.DEFAULT_COMPANY_ID,
              );

            if (
              !existing?.name?.trim() &&
              !existing?.business_name?.trim()
            ) {
              await upsertContact({
                phone,
                name: displayName,
                metadata: {
                  name_source: "whatsapp_profile",
                  name_confirmed: false,
                  whapi_display_name: displayName,
                },
              }, env.DEFAULT_COMPANY_ID);

              console.log("[WHAPI CONTACT NAMED]", {
                phoneLast4: phone.slice(-4),
              });
            }
          } catch (error) {
            console.error(
              "[WHAPI CONTACT NAME ERROR]",
              error,
            );
          }
        }

        // Solo mensajes nuevos de texto.

        if (!result.duplicate && isConversationalText) {
          console.log("[CRM INTAKE ROUTING]", {
            fromMe,
            hasText:
              typeof bodyValue === "string" &&
              bodyValue.trim().length > 0,
            enabled:
              process.env.CRM_INTAKE_CAPTURE_ENABLED === "true",
          });
        }

        if (
          !fromMe &&
          !result.duplicate &&
          isConversationalText &&
          typeof bodyValue === "string" &&
          bodyValue.trim().length > 0
        ) {
          queueWhapiEventsReply({
            phone,
            text: body,
            sourceMessageId: externalId,
          });

          // Captación comercial independiente
          // del agente de respuestas.
          //
          // Desactivada salvo que:
          // CRM_INTAKE_CAPTURE_ENABLED=true
          // CRM_INTAKE_ALL_CONTACTS_V2
          // Registro comercial para todos los contactos.
          // No envia mensajes ni confirma reservas.
          queueWhapiEventIntake({
            companyId: env.DEFAULT_COMPANY_ID,
            phone,
            sourceMessageId: externalId,
            text: body,
            customerName: validName
              ? displayName
              : undefined,
          });
        }

        console.log("[WHAPI SAVED]", {
          id: externalId,
          phoneLast4: phone.slice(-4),
          duplicate: result.duplicate,
          type: messageType,
        });
      }

      response.json({
        ok: true,
        saved: savedCount,
        duplicates: duplicateCount,
      });

    } catch (error) {

      console.error(
        "[WHAPI CRM ERROR]",
        error
      );

      response.status(503).json({
        ok: false,
        error: "WHAPI_CRM_SAVE_FAILED",
      });
    }
  },
);

