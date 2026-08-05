import {
  env,
} from "../config/env.js";

import {
  salesAgentReply,
} from "../services/agent/sales-agent.service.js";

import {
  upsertContact,
} from "../services/crm/crm.repository.js";

import {
  findMessageByExternalId,
  saveMessage,
  updateMessageBody,
} from "../services/conversations/conversation.repository.js";

import {
  sendWhatsappImage,
  sendWhatsappText,
} from "../services/whatsapp/whatsapp.service.js";

import {
  getWhatsappMediaUrl,
  downloadWhatsappMedia,
} from "../services/whatsapp/whatsapp-media.service.js";

import {
  transcribeAudio,
} from "../services/audio/audio-transcription.service.js";

import {
  getOperatorMode,
} from "../services/operator/operator.service.js";

import {
  extractAndStoreMemory,
} from "../services/memory/memory-extractor.service.js";

import {
  recordCustomerInterestEvent,
} from "../services/interests/customer-interest.repository.js";

type WhatsappContact = {
  profile?: {
    name?: string;
  };

  wa_id?: string;
};

type WhatsappMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;

  text?: {
    body?: string;
  };

  image?: Record<string, unknown>;
  audio?: Record<string, unknown>;
  video?: Record<string, unknown>;
  document?: Record<string, unknown>;
  location?: Record<string, unknown>;
  interactive?: Record<string, unknown>;
};

type WhatsappChangeValue = {
  messaging_product?: string;

  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };

  contacts?: WhatsappContact[];
  messages?: WhatsappMessage[];
};

export type WhatsappWebhookPayload = {
  object?: string;

  entry?: Array<{
    id?: string;

    changes?: Array<{
      field?: string;
      value?: WhatsappChangeValue;
    }>;
  }>;
};

function parseOccurredAt(
  timestamp?: string,
) {
  if (!timestamp) {
    return new Date().toISOString();
  }

  const seconds =
    Number(timestamp);

  if (!Number.isFinite(seconds)) {
    return new Date().toISOString();
  }

  return new Date(
    seconds * 1000,
  ).toISOString();
}

function normalizeMessageType(
  type?: string,
) {
  const supported = [
    "text",
    "image",
    "audio",
    "video",
    "document",
    "location",
    "interactive",
  ];

  return supported.includes(
    type ?? "",
  )
    ? type
    : "unknown";
}

function getMediaPayload(
  message: WhatsappMessage,
) {
  switch (message.type) {
    case "image":
      return message.image ?? {};

    case "audio":
      return message.audio ?? {};

    case "video":
      return message.video ?? {};

    case "document":
      return message.document ?? {};

    case "location":
      return message.location ?? {};

    case "interactive":
      return message.interactive ?? {};

    default:
      return {};
  }
}

export async function handleWhatsappIncoming(
  payload: WhatsappWebhookPayload,
) {
  const companyId =
    env.DEFAULT_COMPANY_ID;

  const changes =
    payload.entry?.flatMap(
      (entry) =>
        entry.changes
        ?? [],
    )
    ?? [];

  for (
    const change
    of changes
  ) {
    const value =
      change.value;

    if (!value?.messages?.length) {
      continue;
    }

    const contactNames =
      new Map<string, string>();

    for (
      const contact
      of value.contacts
      ?? []
    ) {
      const waId =
        contact.wa_id;

      const name =
        contact.profile
          ?.name
          ?.trim();

      if (
        waId
        && name
      ) {
        contactNames.set(
          waId,
          name,
        );
      }
    }

    for (
      const message
      of value.messages
    ) {
      try {
        const from =
          message.from
            ?.trim();

        if (!from) {
          continue;
        }

        const externalMessageId =
          message.id
          ?? null;

        if (externalMessageId) {
          const existing =
            await findMessageByExternalId(
              externalMessageId,
              companyId,
            );

          if (existing) {
            console.log(
              "[WHATSAPP DUPLICATE IGNORED]",
              {
                companyId,
                externalMessageId,
              },
            );

            continue;
          }
        }

        const messageType =
          normalizeMessageType(
            message.type,
          );

        const text =
          message.text
            ?.body
            ?.trim()
          ?? null;

        await upsertContact(
          {
            phone:
              from,

            name:
              contactNames.get(
                from,
              ),

            metadata:
              contactNames.has(
                from,
              )
                ? {
                    name_source:
                      "whatsapp_profile",

                    name_confirmed:
                      false,
                  }
                : {},

            last_message:
              text
              ?? `[${messageType}]`,
          },
          companyId,
        );

        const inbound =
          await saveMessage(
            {
              contact_phone:
                from,

              external_message_id:
                externalMessageId,

              direction:
                "inbound",

              channel:
                "whatsapp",

              message_type:
                messageType,

              body:
                text
                ?? undefined,

              media:
                getMediaPayload(
                  message,
                ),

              raw_payload: {
                message,

                metadata:
                  value.metadata
                  ?? {},
              },

              delivery_status:
                "received",

              occurred_at:
                parseOccurredAt(
                  message.timestamp,
                ),
            },
            companyId,
          );

        if (inbound.duplicate) {
          continue;
        }

        let customerMessage =
          text;

        if (
          messageType
          === "audio"
        ) {
          const audioPayload =
            message.audio
            ?? {};

          const mediaId =
            typeof audioPayload.id
            === "string"
              ? audioPayload.id
              : null;

          if (!mediaId) {
            console.error(
              "[WHATSAPP AUDIO WITHOUT MEDIA ID]",
              {
                companyId,
                from,
                externalMessageId,
              },
            );

            continue;
          }

          const mediaUrl =
            await getWhatsappMediaUrl(
              mediaId,
            );

          const audioBuffer =
            await downloadWhatsappMedia(
              mediaUrl,
            );

          customerMessage =
            (
              await transcribeAudio({
                buffer:
                  audioBuffer,

                filename:
                  `${externalMessageId ?? mediaId}.ogg`,

                mimeType:
                  typeof audioPayload.mime_type
                  === "string"
                    ? audioPayload.mime_type
                    : "audio/ogg",
              })
            ).trim();

          if (!customerMessage) {
            console.error(
              "[WHATSAPP AUDIO EMPTY TRANSCRIPTION]",
              {
                companyId,
                from,
                mediaId,
              },
            );

            continue;
          }

          if (inbound.message.id) {
            await updateMessageBody(
              inbound.message.id,
              customerMessage,
              companyId,
            );
          }

          console.log(
            "[WHATSAPP AUDIO TRANSCRIBED]",
            {
              companyId,
              from,
              mediaId,
              transcriptionLength:
                customerMessage.length,
            },
          );
        } else if (
          messageType
          !== "text"
          || !customerMessage
        ) {
          console.log(
            "[WHATSAPP NON-TEXT STORED]",
            {
              companyId,
              from,
              messageType,
            },
          );

          continue;
        }

        const operatorMode =
          await getOperatorMode(
            from,
            companyId,
          );

        if (
          operatorMode.status
          === "human"
          || operatorMode.status
          === "paused"
        ) {
          console.log(
            "[WHATSAPP AI PAUSED]",
            {
              companyId,
              from,
              operatorStatus:
                operatorMode.status,
              assignedTo:
                operatorMode.assigned_to
                ?? null,
            },
          );

          continue;
        }

        await extractAndStoreMemory({
          phone:
            from,

          message:
            customerMessage,

          companyId,

          messageId:
            inbound.message.id,
        });

        const reply =
          await salesAgentReply({
            phone:
              from,

            message:
              customerMessage,

            companyId,

            currentMessageId:
              inbound.message.id,
          });

        const sentMessages = [];

        if (
          reply.media.length
          > 0
        ) {
          for (
            const [
              index,
              media,
            ]
            of reply.media.entries()
          ) {
            const sent =
              await sendWhatsappImage({
                to:
                  from,

                imageUrl:
                  media.url,

                caption:
                  index === 0
                    ? reply.text
                        .slice(0, 900)
                    : undefined,
              });

            sentMessages.push(
              {
                sent,
                media,
                body:
                  index === 0
                    ? reply.text
                    : "",
              },
            );
          }
        } else {
          const sent =
            await sendWhatsappText({
              to:
                from,

              text:
                reply.text,
            });

          sentMessages.push(
            {
              sent,
              media:
                null,
              body:
                reply.text,
            },
          );
        }

        const shownProductKeys =
          new Set<string>();

        for (
          const item
          of sentMessages
        ) {
          const storedOutbound =
            await saveMessage(
            {
              contact_phone:
                from,

              external_message_id:
                item.sent.externalMessageId,

              direction:
                "outbound",

              channel:
                "whatsapp",

              message_type:
                item.media
                  ? "image"
                  : "text",

              body:
                item.body,

              media:
                item.media
                  ? {
                      type:
                        item.media.type,

                      url:
                        item.media.url,

                      role:
                        item.media.role,

                      productId:
                        item.media.productId,

                      variantId:
                        item.media.variantId,

                      sku:
                        item.media.sku,
                    }
                  : undefined,

              raw_payload:
                item.sent.raw,

              delivery_status:
                item.sent.status
                === "accepted"
                  ? "queued"
                  : "sent",

              occurred_at:
                new Date()
                  .toISOString(),
            },
            companyId,
          );

          if (item.media) {
            const shownProductKey =
              item.media.variantId
              ?? item.media.productId
              ?? item.media.sku
              ?? item.media.url;

            if (
              shownProductKeys.has(
                shownProductKey,
              )
            ) {
              continue;
            }

            shownProductKeys.add(
              shownProductKey,
            );

            await recordCustomerInterestEvent(
              {
                contact_phone:
                  from,

                event_type:
                  "product_shown",

                product_id:
                  item.media.productId
                  ?? null,

                variant_id:
                  item.media.variantId
                  ?? null,

                sku:
                  item.media.sku
                  ?? null,

                value:
                  item.media.sku
                  ?? "producto_mostrado",

                source:
                  "sales_agent",

                message_id:
                  storedOutbound
                    .message
                    .id
                  ?? null,

                metadata: {
                  image_url:
                    item.media.url,

                  image_role:
                    item.media.role
                    ?? null,
                },
              },
              companyId,
            );
          }
        }

        const lastSent =
          sentMessages[
            sentMessages.length - 1
          ];

        console.log(
          "[WHATSAPP MESSAGE PROCESSED]",
          {
            companyId,
            from,

            inboundMessageId:
              externalMessageId,

            outboundMessageId:
              lastSent?.sent.externalMessageId
              ?? null,
          },
        );
      } catch (error) {
        console.error(
          "[WHATSAPP MESSAGE PROCESSING ERROR]",
          {
            messageId:
              message.id,

            from:
              message.from,

            error,
          },
        );
      }
    }
  }
}
