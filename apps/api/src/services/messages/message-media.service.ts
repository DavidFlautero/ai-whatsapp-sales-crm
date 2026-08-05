import {
  env,
} from "../../config/env.js";

import {
  getMessageById,
} from "../conversations/conversation.repository.js";

import {
  downloadWhatsappMedia,
  getWhatsappMediaUrl,
} from "../whatsapp/whatsapp-media.service.js";

type MediaMetadata = {
  id?: unknown;
  url?: unknown;
  mime_type?: unknown;
  filename?: unknown;
  caption?: unknown;
};

const supportedTypes =
  new Set([
    "image",
    "audio",
    "video",
    "document",
  ]);

function stringValue(
  value: unknown,
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function fallbackMimeType(
  messageType: string,
) {
  switch (messageType) {
    case "image":
      return "image/jpeg";

    case "audio":
      return "audio/ogg";

    case "video":
      return "video/mp4";

    case "document":
      return "application/octet-stream";

    default:
      return "application/octet-stream";
  }
}

function extensionFromMimeType(
  mimeType: string,
) {
  const normalized =
    mimeType
      .split(";")[0]
      ?.trim()
      .toLowerCase();

  switch (normalized) {
    case "image/jpeg":
      return "jpg";

    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    case "image/gif":
      return "gif";

    case "audio/ogg":
      return "ogg";

    case "audio/mpeg":
      return "mp3";

    case "audio/mp4":
      return "m4a";

    case "video/mp4":
      return "mp4";

    case "application/pdf":
      return "pdf";

    default:
      return "bin";
  }
}

function sanitizeFilename(
  filename: string,
) {
  return filename
    .replace(
      /[\r\n"\\/]/g,
      "_",
    )
    .slice(0, 180);
}

function filenameFromUrl(
  url: string,
) {
  try {
    const pathname =
      new URL(url).pathname;

    const segment =
      pathname
        .split("/")
        .filter(Boolean)
        .at(-1);

    if (!segment) {
      return "";
    }

    return sanitizeFilename(
      decodeURIComponent(segment),
    );
  } catch {
    return "";
  }
}

function validateRemoteUrl(
  rawUrl: string,
) {
  let parsed: URL;

  try {
    parsed =
      new URL(rawUrl);
  } catch {
    throw new Error(
      "MESSAGE_MEDIA_URL_INVALID",
    );
  }

  if (
    parsed.protocol !== "https:"
    && parsed.protocol !== "http:"
  ) {
    throw new Error(
      "MESSAGE_MEDIA_URL_PROTOCOL_NOT_ALLOWED",
    );
  }

  return parsed.toString();
}

async function downloadRemoteMedia(
  rawUrl: string,
) {
  const url =
    validateRemoteUrl(
      rawUrl,
    );

  const response =
    await fetch(
      url,
      {
        redirect:
          "follow",

        signal:
          AbortSignal.timeout(
            20_000,
          ),

        headers: {
          Accept:
            "image/*,audio/*,video/*,application/pdf,application/octet-stream;q=0.8,*/*;q=0.5",

          "User-Agent":
            "VentasIA-MediaProxy/1.0",
        },
      },
    );

  if (!response.ok) {
    throw new Error(
      `REMOTE_MEDIA_DOWNLOAD_FAILED_${response.status}`,
    );
  }

  const declaredLength =
    Number(
      response.headers.get(
        "content-length",
      )
      ?? "0",
    );

  const maximumBytes =
    30 * 1024 * 1024;

  if (
    Number.isFinite(
      declaredLength,
    )
    && declaredLength
      > maximumBytes
  ) {
    throw new Error(
      "MESSAGE_MEDIA_TOO_LARGE",
    );
  }

  const arrayBuffer =
    await response
      .arrayBuffer();

  if (
    arrayBuffer.byteLength
    > maximumBytes
  ) {
    throw new Error(
      "MESSAGE_MEDIA_TOO_LARGE",
    );
  }

  return {
    buffer:
      Buffer.from(
        arrayBuffer,
      ),

    contentType:
      response.headers
        .get(
          "content-type",
        )
        ?.split(";")[0]
        ?.trim()
        || "",
  };
}

export async function resolveMessageMedia(
  input: {
    messageId: string;
    companyId?: string;
  },
) {
  const companyId =
    input.companyId
    ?? env.DEFAULT_COMPANY_ID;

  const messageId =
    input.messageId.trim();

  if (!messageId) {
    throw new Error(
      "MESSAGE_ID_REQUIRED",
    );
  }

  const message =
    await getMessageById(
      messageId,
      companyId,
    );

  if (!message) {
    throw new Error(
      "MESSAGE_NOT_FOUND",
    );
  }

  const messageType =
    String(
      message.message_type
      ?? "",
    );

  if (
    !supportedTypes.has(
      messageType,
    )
  ) {
    throw new Error(
      "MESSAGE_HAS_NO_DOWNLOADABLE_MEDIA",
    );
  }

  const media =
    (
      message.media
      && typeof message.media
        === "object"
        ? message.media
        : {}
    ) as MediaMetadata;

  const mediaId =
    stringValue(
      media.id,
    );

  const directUrl =
    stringValue(
      media.url,
    );

  let buffer: Buffer;
  let detectedMimeType =
    "";

  if (mediaId) {
    const temporaryUrl =
      await getWhatsappMediaUrl(
        mediaId,
      );

    buffer =
      await downloadWhatsappMedia(
        temporaryUrl,
      );
  } else if (directUrl) {
    const downloaded =
      await downloadRemoteMedia(
        directUrl,
      );

    buffer =
      downloaded.buffer;

    detectedMimeType =
      downloaded.contentType;
  } else {
    throw new Error(
      "MESSAGE_MEDIA_SOURCE_MISSING",
    );
  }

  const storedMimeType =
    stringValue(
      media.mime_type,
    );

  const mimeType =
    detectedMimeType
    || storedMimeType
    || fallbackMimeType(
      messageType,
    );

  const storedFilename =
    stringValue(
      media.filename,
    );

  const urlFilename =
    directUrl
      ? filenameFromUrl(
          directUrl,
        )
      : "";

  const filename =
    sanitizeFilename(
      storedFilename
      || urlFilename
      || `${messageId}.${extensionFromMimeType(mimeType)}`,
    );

  return {
    buffer,
    mimeType,
    filename,
    messageType,

    source:
      mediaId
        ? "whatsapp"
        : "remote_url",

    size:
      buffer.byteLength,
  };
}
