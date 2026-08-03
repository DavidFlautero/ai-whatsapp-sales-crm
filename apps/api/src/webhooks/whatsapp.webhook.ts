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
} from "../services/conversations/conversation.repository.js";

import {
  sendWhatsappText,
} from "../services/whatsapp/whatsapp.service.js";

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

        if (
          messageType
          !== "text"
          || !text
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

        const reply =
          await salesAgentReply({
            phone:
              from,

            message:
              text,

            companyId,
          });

        const sent =
          await sendWhatsappText({
            to:
              from,

            text:
              reply,
          });

        await saveMessage(
          {
            contact_phone:
              from,

            external_message_id:
              sent.externalMessageId,

            direction:
              "outbound",

            channel:
              "whatsapp",

            message_type:
              "text",

            body:
              reply,

            raw_payload:
              sent.raw,

            delivery_status:
              sent.status
              === "accepted"
                ? "queued"
                : "sent",

            occurred_at:
              new Date()
                .toISOString(),
          },
          companyId,
        );

        console.log(
          "[WHATSAPP MESSAGE PROCESSED]",
          {
            companyId,
            from,

            inboundMessageId:
              externalMessageId,

            outboundMessageId:
              sent.externalMessageId,
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
