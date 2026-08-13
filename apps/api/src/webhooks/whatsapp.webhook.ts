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
  getConversationByPhone,
  saveMessage,
  updateConversationMetadata,
  updateMessageBody,
} from "../services/conversations/conversation.repository.js";

import {
  sendWhatsappImage,
  sendWhatsappImageById,
  sendWhatsappDocumentById,
  sendWhatsappText,
} from "../services/whatsapp/whatsapp.service.js";

import {
  getWhatsappMediaUrl,
  downloadWhatsappMedia,
  uploadWhatsappMedia,
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

import {
  isAwaitingPaymentReceipt,
  paymentSubmissionReply,
  paymentWorkflowFromMetadata,
  receiveWhatsappPaymentSubmission,
} from "../services/payments/payment-submission.service.js";

import {
  validatePaymentMediaBuffer,
  validatePaymentMediaMetadata,
} from "../services/payments/payment-media-security.service.js";

import {
  handlePaymentOwnerWhatsappCommand,
} from "../services/payments/payment-owner-whatsapp.service.js";

import {
  handlePaymentOwnerReviewWhatsappCommand,
} from "../services/payments/payment-owner-review-whatsapp.service.js";

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

  const messageCount =
    changes.reduce(
      (
        total,
        change,
      ) =>
        total
        + (
          change.value
            ?.messages
            ?.length
          ?? 0
        ),
      0,
    );

  console.log(
    "[WHATSAPP WEBHOOK PROCESSING]",
    {
      companyId,

      entryCount:
        payload.entry
          ?.length
        ?? 0,

      changeCount:
        changes.length,

      messageCount,
    },
  );

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

        /*
         * Una imagen puede significar:
         *
         * A) comprobante de pago esperado
         * B) búsqueda visual de una prenda
         *
         * Nunca mezclamos ambos flujos.
         */
        let imageForVision =
          false;


        if (
          messageType
          === "image"
        ) {
          const imageConversation =
            await getConversationByPhone(
              from,
              companyId,
            );


          const imagePaymentWorkflow =
            paymentWorkflowFromMetadata(
              imageConversation
                ?.metadata,
            );


          if (
            !isAwaitingPaymentReceipt(
              imagePaymentWorkflow,
            )
          ) {
            const imagePayload =
              message.image
              ?? {};


            const caption =
              typeof imagePayload.caption
                === "string"
                ? imagePayload.caption
                    .trim()
                : "";


            customerMessage =
              caption
              || "Busco una prenda similar a la imagen que acabo de enviar.";


            imageForVision =
              true;


            if (
              inbound.message.id
            ) {
              await updateMessageBody(
                inbound.message.id,
                customerMessage,
                companyId,
              );
            }


            console.log(
              "[WHATSAPP IMAGE TO VISION]",
              {
                companyId,

                from,

                messageId:
                  inbound.message.id,

                hasCaption:
                  Boolean(
                    caption,
                  ),
              },
            );
          }
        }


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
          (
            messageType
            === "image"
            || messageType
            === "document"
          )
          && !imageForVision
        ) {
          const conversation =
            await getConversationByPhone(
              from,
              companyId,
            );

          const paymentWorkflow =
            paymentWorkflowFromMetadata(
              conversation?.metadata,
            );

          if (
            !isAwaitingPaymentReceipt(
              paymentWorkflow,
            )
          ) {
            console.log(
              "[WHATSAPP MEDIA NOT PAYMENT RECEIPT]",
              {
                companyId,
                from,
                messageType,
                externalMessageId,

                paymentWorkflowStatus:
                  paymentWorkflow?.status
                  ?? null,
              },
            );

            continue;
          }

          const internalMessageId =
            inbound.message.id;

          if (!internalMessageId) {
            console.error(
              "[PAYMENT SUBMISSION MESSAGE ID MISSING]",
              {
                companyId,
                from,
                externalMessageId,
                messageType,
              },
            );

            continue;
          }

          /*
           * SECURITY GATE PARA COMPROBANTES
           *
           * No confiamos únicamente en mime_type.
           * Validamos tipo declarado + contenido real
           * antes de registrar la submission.
           */
          try {
            const mediaPayload =
              getMediaPayload(
                message,
              );

            const whatsappMediaId =
              typeof mediaPayload.id
              === "string"
                ? mediaPayload.id.trim()
                : "";

            const declaredMimeType =
              typeof mediaPayload.mime_type
              === "string"
                ? mediaPayload.mime_type.trim()
                : "";

            if (!whatsappMediaId) {
              throw new Error(
                "PAYMENT_MEDIA_ID_MISSING",
              );
            }

            const metadataValidation =
              validatePaymentMediaMetadata({
                mediaType:
                  messageType,

                mimeType:
                  declaredMimeType,
              });

            const mediaUrl =
              await getWhatsappMediaUrl(
                whatsappMediaId,
              );

            const mediaBuffer =
              await downloadWhatsappMedia(
                mediaUrl,
                {
                  maxBytes:
                    8 * 1024 * 1024,
                },
              );

            const bufferValidation =
              validatePaymentMediaBuffer({
                buffer:
                  mediaBuffer,

                mimeType:
                  metadataValidation.mimeType,
              });

            console.log(
              "[PAYMENT MEDIA VALIDATED]",
              {
                companyId,
                from,
                externalMessageId,
                messageType,

                mimeType:
                  bufferValidation.mimeType,

                size:
                  bufferValidation.size,
              },
            );
          } catch (caught) {
            const error =
              caught instanceof Error
                ? caught.message
                : "PAYMENT_MEDIA_VALIDATION_FAILED";

            console.error(
              "[PAYMENT MEDIA REJECTED]",
              {
                companyId,
                from,
                externalMessageId,
                messageType,
                error,
              },
            );

            const replyText =
              "No pude aceptar ese archivo como comprobante. "
              + "Enviame una imagen JPG, PNG o WEBP, "
              + "o un PDF válido de hasta 8 MB.";

            const sent =
              await sendWhatsappText({
                to:
                  from,

                text:
                  replyText,
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
                  replyText,

                raw_payload:
                  sent.raw,

                delivery_status:
                  sent.status,

                occurred_at:
                  new Date()
                    .toISOString(),
              },
              companyId,
            );

            continue;
          }

          try {
            const submission =
              await receiveWhatsappPaymentSubmission({
                companyId,

                messageId:
                  internalMessageId,
              });

            await updateConversationMetadata(
              from,
              {
                payment_workflow: {
                  ...paymentWorkflow!,

                  status:
                    "receipt_received",

                  submissionId:
                    submission.submission?.id
                    ?? null,

                  updatedAt:
                    new Date()
                      .toISOString(),
                },
              },
              companyId,
            );

            const replyText =
              paymentSubmissionReply(
                submission,
              );

            const sent =
              await sendWhatsappText({
                to:
                  from,

                text:
                  replyText,
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
                  replyText,

                raw_payload:
                  sent.raw,

                delivery_status:
                  sent.status,

                occurred_at:
                  new Date()
                    .toISOString(),
              },
              companyId,
            );

            console.log(
              "[PAYMENT SUBMISSION RECEIVED]",
              {
                companyId,
                from,

                messageId:
                  internalMessageId,

                externalMessageId,

                submissionId:
                  submission.submission?.id
                  ?? null,

                created:
                  submission.created,

                duplicate:
                  submission.duplicate,

                customerResolved:
                  submission.customerResolved,

                orderResolved:
                  submission.orderResolved,

                orderId:
                  submission.order?.id
                  ?? null,

                orderNumber:
                  submission.order
                    ?.orderNumber
                  ?? null,
              },
            );
          } catch (caught) {
            const error =
              caught instanceof Error
                ? caught.message
                : "PAYMENT_SUBMISSION_FAILED";

            console.error(
              "[PAYMENT SUBMISSION ERROR]",
              {
                companyId,
                from,

                messageId:
                  internalMessageId,

                externalMessageId,
                messageType,
                error,
              },
            );

            /*
             * El mensaje original ya quedó almacenado.
             * No confirmamos recepción financiera cuando
             * la creación del pendiente falló.
             */
            const failureText = [
              "Recibí el archivo, pero no pude registrarlo como comprobante.",
              "",
              "No se acreditó ningún pago.",
              "Administración deberá revisarlo manualmente.",
            ].join("\n");

            const sent =
              await sendWhatsappText({
                to:
                  from,

                text:
                  failureText,
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
                  failureText,

                raw_payload:
                  sent.raw,

                delivery_status:
                  sent.status,

                occurred_at:
                  new Date()
                    .toISOString(),
              },
              companyId,
            );
          }

          /*
           * La imagen o PDF de comprobante no pasa
           * por el agente comercial.
           */
          continue;
        } else if (
          (
            !imageForVision
            && messageType
              !== "text"
          )
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

        const ownerPaymentReview =
          await handlePaymentOwnerReviewWhatsappCommand({
            companyId,

            phone:
              from,

            message:
              customerMessage,

            messageId:
              externalMessageId
              ?? inbound.message.id
              ?? `${from}:${Date.now()}`,
          });

        if (
          ownerPaymentReview.handled
        ) {
          const replyText =
            ownerPaymentReview.text
            ?? "Operación procesada.";

          for (
            const [
              mediaIndex,
              media,
            ]
            of (
              ownerPaymentReview.media
              ?? []
            ).entries()
          ) {
            if (
              !media.whatsappMediaId
            ) {
              continue;
            }

            try {
              const sourceMediaUrl =
                await getWhatsappMediaUrl(
                  media.whatsappMediaId,
                );

              const buffer =
                await downloadWhatsappMedia(
                  sourceMediaUrl,
                  {
                    maxBytes:
                      16
                      * 1024
                      * 1024,
                  },
                );

              const mimeType =
                media.mimeType
                ?.trim()
                || (
                  media.mediaType
                    === "document"
                    ? "application/pdf"
                    : "image/jpeg"
                );

              const uploadedMediaId =
                await uploadWhatsappMedia({
                  buffer,
                  mimeType,

                  filename:
                    mimeType
                      === "application/pdf"
                      ? `comprobante-${mediaIndex + 1}.pdf`
                      : `comprobante-${mediaIndex + 1}.jpg`,
                });

              const caption =
                (
                  ownerPaymentReview.media
                    ?.length
                  ?? 0
                ) > 1
                  ? `Comprobante ${mediaIndex + 1}`
                  : "Comprobante de transferencia";

              if (
                media.mediaType
                  === "document"
                || mimeType
                  === "application/pdf"
              ) {
                await sendWhatsappDocumentById({
                  to:
                    from,

                  mediaId:
                    uploadedMediaId,

                  filename:
                    `comprobante-${mediaIndex + 1}.pdf`,

                  caption,
                });
              } else {
                await sendWhatsappImageById({
                  to:
                    from,

                  mediaId:
                    uploadedMediaId,

                  caption,
                });
              }

              console.log(
                "[PAYMENT OWNER REVIEW MEDIA SENT]",
                {
                  companyId,
                  from,

                  mediaIndex,

                  sourceMediaId:
                    media.whatsappMediaId,

                  uploadedMediaId,

                  mimeType,
                },
              );
            } catch (error) {
              console.error(
                "[PAYMENT OWNER REVIEW MEDIA ERROR]",
                {
                  companyId,
                  from,

                  mediaIndex,

                  messageId:
                    media.messageId,

                  error:
                    error instanceof Error
                      ? error.message
                      : String(error),
                },
              );
            }
          }

          const sent =
            await sendWhatsappText({
              to:
                from,

              text:
                replyText,
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
                replyText,

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
            "[PAYMENT OWNER REVIEW WHATSAPP]",
            {
              companyId,
              from,

              hasMedia:
                Boolean(
                  ownerPaymentReview.media
                    ?.length,
                ),
            },
          );

          if (
            ownerPaymentReview.notifyCustomer
              ?.phone
            && ownerPaymentReview.notifyCustomer
              .text
          ) {
            try {
              const customerNotification =
                await sendWhatsappText({
                  to:
                    ownerPaymentReview
                      .notifyCustomer
                      .phone,

                  text:
                    ownerPaymentReview
                      .notifyCustomer
                      .text,
                });

              await saveMessage(
                {
                  contact_phone:
                    ownerPaymentReview
                      .notifyCustomer
                      .phone,

                  external_message_id:
                    customerNotification
                      .externalMessageId,

                  direction:
                    "outbound",

                  channel:
                    "whatsapp",

                  message_type:
                    "text",

                  body:
                    ownerPaymentReview
                      .notifyCustomer
                      .text,

                  raw_payload:
                    customerNotification.raw,

                  delivery_status:
                    customerNotification.status
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
                "[PAYMENT CUSTOMER NOTIFIED]",
                {
                  companyId,

                  phone:
                    ownerPaymentReview
                      .notifyCustomer
                      .phone,
                },
              );
            } catch (error) {
              console.error(
                "[PAYMENT CUSTOMER NOTIFY ERROR]",
                {
                  companyId,

                  phone:
                    ownerPaymentReview
                      .notifyCustomer
                      .phone,

                  error:
                    error instanceof Error
                      ? error.message
                      : String(error),
                },
              );
            }
          }

          continue;
        }

        const ownerPaymentCommand =
      await handlePaymentOwnerWhatsappCommand({
        companyId,

        phone:
          from,

        message:
          customerMessage,

        messageId:
          externalMessageId
          ?? inbound.message.id
          ?? `${from}:${Date.now()}`,
      });

    if (
      ownerPaymentCommand.handled
    ) {
      const replyText =
        ownerPaymentCommand.text
        ?? "Operación procesada.";

      const sent =
        await sendWhatsappText({
          to:
            from,

          text:
            replyText,
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
            replyText,

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
        "[PAYMENT OWNER WHATSAPP COMMAND]",
        {
          companyId,
          from,

          messageId:
            externalMessageId
            ?? inbound.message.id
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
          (reply.media ?? []).length
          > 0
        ) {
          for (
            const [
              index,
              media,
            ]
            of (reply.media ?? []).entries()
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
