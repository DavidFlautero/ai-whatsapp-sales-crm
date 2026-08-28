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

export type SendWhatsappImageResult = {
  externalMessageId:
    string | null;

  status:
    string;

  raw:
    WhatsappApiResponse;
};

export async function sendWhatsappImage(
  input: {
    to: string;
    imageUrl: string;
    caption?: string;
  },
): Promise<SendWhatsappImageResult> {
  console.log(
    "[WHATSAPP SEND IMAGE]",
    {
      to:
        input.to,

      imageUrl:
        input.imageUrl,

      captionLength:
        input.caption?.length
        ?? 0,
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
        "image",

      image: {
        link:
          input.imageUrl,

        ...(input.caption
          ? {
              caption:
                input.caption,
            }
          : {}),
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



export async function sendWhatsappImageById(
  input: {
    to: string;
    mediaId: string;
    caption?: string;
  },
): Promise<SendWhatsappImageResult> {
  console.log(
    "[WHATSAPP SEND IMAGE BY ID]",
    {
      to:
        input.to,

      mediaId:
        input.mediaId,

      captionLength:
        input.caption?.length
        ?? 0,
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
        "image",

      image: {
        id:
          input.mediaId,

        ...(input.caption
          ? {
              caption:
                input.caption,
            }
          : {}),
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


export async function sendWhatsappDocumentById(
  input: {
    to: string;
    mediaId: string;
    filename?: string;
    caption?: string;
  },
): Promise<SendWhatsappImageResult> {
  console.log(
    "[WHATSAPP SEND DOCUMENT BY ID]",
    {
      to:
        input.to,

      mediaId:
        input.mediaId,
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
        "document",

      document: {
        id:
          input.mediaId,

        filename:
          input.filename
          ?? "comprobante.pdf",

        ...(input.caption
          ? {
              caption:
                input.caption,
            }
          : {}),
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
