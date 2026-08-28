import { env } from "../../config/env.js";

export async function getWhatsappMediaUrl(
  mediaId: string,
): Promise<string> {
  const graphVersion =
    env.WHATSAPP_GRAPH_VERSION.replace(/^v?/, "v");

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${mediaId}`,
    {
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      },
    },
  );

  const data = await response.json() as {
    url?: string;
    error?: unknown;
  };

  if (!response.ok || !data.url) {
    console.error("[WHATSAPP MEDIA URL ERROR]", data);
    throw new Error("Could not get WhatsApp media URL");
  }

  return data.url;
}

export async function downloadWhatsappMedia(
  mediaUrl: string,
  options?: {
    maxBytes?: number;
  },
): Promise<Buffer> {
  const response = await fetch(
    mediaUrl,
    {
      headers: {
        Authorization:
          `Bearer ${env.WHATSAPP_TOKEN}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Could not download WhatsApp media: ${response.status}`,
    );
  }

  const maxBytes =
    options?.maxBytes;

  if (
    maxBytes
    && maxBytes > 0
  ) {
    const contentLength =
      Number(
        response.headers.get(
          "content-length",
        ),
      );

    if (
      Number.isFinite(
        contentLength,
      )
      && contentLength > maxBytes
    ) {
      throw new Error(
        "WHATSAPP_MEDIA_TOO_LARGE",
      );
    }

    if (!response.body) {
      throw new Error(
        "WHATSAPP_MEDIA_BODY_MISSING",
      );
    }

    const reader =
      response.body.getReader();

    const chunks:
      Buffer[] = [];

    let total =
      0;

    try {
      while (true) {
        const {
          done,
          value,
        } =
          await reader.read();

        if (done) {
          break;
        }

        if (!value) {
          continue;
        }

        total +=
          value.byteLength;

        if (
          total > maxBytes
        ) {
          await reader.cancel();

          throw new Error(
            "WHATSAPP_MEDIA_TOO_LARGE",
          );
        }

        chunks.push(
          Buffer.from(
            value,
          ),
        );
      }
    } finally {
      reader.releaseLock();
    }

    return Buffer.concat(
      chunks,
      total,
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  return Buffer.from(
    arrayBuffer,
  );
}


export async function uploadWhatsappMedia(
  input: {
    buffer: Buffer;
    mimeType: string;
    filename?: string;
  },
): Promise<string> {
  const token =
    env.WHATSAPP_TOKEN
      ?.trim();

  const phoneNumberId =
    env.WHATSAPP_PHONE_NUMBER_ID
      ?.trim();

  if (!token) {
    throw new Error(
      "WHATSAPP_TOKEN_NOT_CONFIGURED",
    );
  }

  if (!phoneNumberId) {
    throw new Error(
      "WHATSAPP_PHONE_NUMBER_ID_NOT_CONFIGURED",
    );
  }

  const graphVersion =
    env.WHATSAPP_GRAPH_VERSION
      .replace(
        /^v?/,
        "v",
      );

  const form =
    new FormData();

  form.append(
    "messaging_product",
    "whatsapp",
  );

  form.append(
    "type",
    input.mimeType,
  );

  form.append(
    "file",
    new Blob(
      [
        new Uint8Array(
          input.buffer,
        ),
      ],
      {
        type:
          input.mimeType,
      },
    ),
    input.filename
    ?? (
      input.mimeType
        === "application/pdf"
        ? "comprobante.pdf"
        : "comprobante.jpg"
    ),
  );

  console.log(
    "[WHATSAPP MEDIA UPLOAD]",
    {
      mimeType:
        input.mimeType,

      bytes:
        input.buffer.length,
    },
  );

  const response =
    await fetch(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/media`,
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,
        },

        body:
          form,
      },
    );

  const payload =
    await response
      .json()
      .catch(
        () => ({}),
      ) as {
        id?: string;
        error?: unknown;
      };

  if (
    !response.ok
    || !payload.id
  ) {
    console.error(
      "[WHATSAPP MEDIA UPLOAD ERROR]",
      {
        status:
          response.status,

        payload,
      },
    );

    throw new Error(
      "WHATSAPP_MEDIA_UPLOAD_FAILED",
    );
  }

  return payload.id;
}
