import {
  postWhatsappMessage,
  type WhatsappApiResponse,
} from "./whatsapp.client.js";

export type SendWhatsappTextResult = {
  externalMessageId:
    string | null;

  status:
    string;

  raw:
    WhatsappApiResponse;
};

export async function sendWhatsappText(
  input: {
    to: string;
    text: string;
  },
): Promise<SendWhatsappTextResult> {
  console.log(
    "[WHATSAPP SEND TEXT]",
    {
      to:
        input.to,

      textLength:
        input.text.length,
    },
  );

  const response =
    await postWhatsappMessage({
      messaging_product:
        "whatsapp",

      recipient_type:
        "individual",

      to:
        input.to,

      type:
        "text",

      text: {
        preview_url:
          false,

        body:
          input.text,
      },
    });

  const sentMessage =
    response.messages?.[0];

  return {
    externalMessageId:
      sentMessage?.id
      ?? null,

    status:
      sentMessage?.message_status
      ?? "sent",

    raw:
      response,
  };
}
