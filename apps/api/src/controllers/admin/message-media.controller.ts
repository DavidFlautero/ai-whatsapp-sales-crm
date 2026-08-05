import type {
  Request,
  Response,
} from "express";

import {
  resolveMessageMedia,
} from "../../services/messages/message-media.service.js";

function statusForError(
  error: string,
) {
  switch (error) {
    case "MESSAGE_NOT_FOUND":
      return 404;

    case "MESSAGE_ID_REQUIRED":
    case "MESSAGE_HAS_NO_DOWNLOADABLE_MEDIA":
    case "MESSAGE_MEDIA_ID_MISSING":
    case "MESSAGE_MEDIA_SOURCE_MISSING":
    case "MESSAGE_MEDIA_URL_INVALID":
    case "MESSAGE_MEDIA_URL_PROTOCOL_NOT_ALLOWED":
      return 400;

    case "MESSAGE_MEDIA_TOO_LARGE":
      return 413;

    default:
      return 502;
  }
}

export async function downloadAdminMessageMedia(
  req: Request,
  res: Response,
) {
  try {
    const messageId =
      String(
        req.params.messageId
        ?? "",
      ).trim();

    const media =
      await resolveMessageMedia({
        messageId,
      });

    res.setHeader(
      "Content-Type",
      media.mimeType,
    );

    res.setHeader(
      "Content-Length",
      String(
        media.size,
      ),
    );

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${media.filename}"`,
    );

    res.setHeader(
      "Cache-Control",
      "private, max-age=300",
    );

    res.setHeader(
      "X-Content-Type-Options",
      "nosniff",
    );

    return res.send(
      media.buffer,
    );
  } catch (
    caught
  ) {
    const error =
      caught instanceof Error
        ? caught.message
        : "MESSAGE_MEDIA_DOWNLOAD_FAILED";

    console.error(
      "[ADMIN MESSAGE MEDIA ERROR]",
      {
        messageId:
          req.params.messageId
          ?? null,

        error,
      },
    );

    return res
      .status(
        statusForError(
          error,
        ),
      )
      .json({
        ok:
          false,

        error,
      });
  }
}
