const MAX_PAYMENT_MEDIA_BYTES =
  8 * 1024 * 1024;

const allowedMimeTypes =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ]);


export function validatePaymentMediaMetadata(
  input: {
    mediaType?: string | null;
    mimeType?: string | null;
  },
) {
  const mimeType =
    input.mimeType
      ?.trim()
      .toLowerCase()
    ?? "";

  if (
    !allowedMimeTypes.has(
      mimeType,
    )
  ) {
    throw new Error(
      "PAYMENT_MEDIA_TYPE_NOT_ALLOWED",
    );
  }

  if (
    input.mediaType
      === "image"
    && !mimeType.startsWith(
      "image/",
    )
  ) {
    throw new Error(
      "PAYMENT_MEDIA_TYPE_MISMATCH",
    );
  }

  if (
    input.mediaType
      === "document"
    && mimeType
      !== "application/pdf"
  ) {
    throw new Error(
      "PAYMENT_DOCUMENT_TYPE_NOT_ALLOWED",
    );
  }

  return {
    mimeType,
  };
}


export function validatePaymentMediaBuffer(
  input: {
    buffer: Buffer;
    mimeType: string;
  },
) {
  const {
    buffer,
    mimeType,
  } = input;

  if (!buffer.length) {
    throw new Error(
      "PAYMENT_MEDIA_EMPTY",
    );
  }

  if (
    buffer.length
    > MAX_PAYMENT_MEDIA_BYTES
  ) {
    throw new Error(
      "PAYMENT_MEDIA_TOO_LARGE",
    );
  }

  /*
   * Validación por magic bytes.
   * No confiamos solamente en el MIME declarado.
   */

  if (
    mimeType
    === "image/jpeg"
  ) {
    const valid =
      buffer.length >= 3
      && buffer[0] === 0xff
      && buffer[1] === 0xd8
      && buffer[2] === 0xff;

    if (!valid) {
      throw new Error(
        "PAYMENT_MEDIA_INVALID_JPEG",
      );
    }
  }

  if (
    mimeType
    === "image/png"
  ) {
    const signature = [
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
    ];

    const valid =
      signature.every(
        (
          byte,
          index,
        ) =>
          buffer[index]
          === byte,
      );

    if (!valid) {
      throw new Error(
        "PAYMENT_MEDIA_INVALID_PNG",
      );
    }
  }

  if (
    mimeType
    === "image/webp"
  ) {
    const riff =
      buffer
        .subarray(
          0,
          4,
        )
        .toString(
          "ascii",
        );

    const webp =
      buffer
        .subarray(
          8,
          12,
        )
        .toString(
          "ascii",
        );

    if (
      riff !== "RIFF"
      || webp !== "WEBP"
    ) {
      throw new Error(
        "PAYMENT_MEDIA_INVALID_WEBP",
      );
    }
  }

  if (
    mimeType
    === "application/pdf"
  ) {
    const signature =
      buffer
        .subarray(
          0,
          5,
        )
        .toString(
          "ascii",
        );

    if (
      signature
      !== "%PDF-"
    ) {
      throw new Error(
        "PAYMENT_MEDIA_INVALID_PDF",
      );
    }
  }

  return {
    ok:
      true,

    size:
      buffer.length,

    mimeType,
  };
}
