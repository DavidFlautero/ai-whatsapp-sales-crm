import {
  readIntegrationSecrets,
} from "../integrations/integration-secrets.repository.js";

import {
  env,
} from "../../config/env.js";

const BUCKET =
  "catalog-images";

function cleanSegment(
  value: string,
) {
  return value
    .trim()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^a-zA-Z0-9_-]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    )
    .toLowerCase();
}

function extensionForMime(
  mimeType: string,
) {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";

    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    default:
      throw new Error(
        "VENUE_IMAGE_FORMAT_NOT_ALLOWED",
      );
  }
}

async function supabaseConfig() {
  const integrations =
    await readIntegrationSecrets();

  const baseUrl =
    (
      integrations
        .supabase
        .url
      || process.env
        .SUPABASE_URL
      || env
        .SUPABASE_URL
      || ""
    )
      .trim()
      .replace(
        /\/+$/,
        "",
      );

  const serviceRoleKey =
    (
      integrations
        .supabase
        .serviceRoleKey
      || process.env
        .SUPABASE_SERVICE_ROLE_KEY
      || env
        .SUPABASE_SERVICE_ROLE_KEY
      || ""
    ).trim();

  if (
    !baseUrl
    || !serviceRoleKey
  ) {
    throw new Error(
      "SUPABASE_NOT_CONFIGURED",
    );
  }

  return {
    baseUrl,
    serviceRoleKey,
  };
}


async function ensureBucket(
  baseUrl: string,
  serviceRoleKey: string,
) {
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  const check =
    await fetch(
      `${baseUrl}/storage/v1/bucket/${BUCKET}`,
      {
        headers,
      },
    );

  if (check.ok) {
    return;
  }

  const checkBody =
    await check.text();

  const bucketMissing =
    check.status === 404
    || (
      check.status === 400
      && (
        checkBody.includes(
          "Bucket not found",
        )
        || checkBody.includes(
          "NoSuchBucket",
        )
      )
    );

  if (!bucketMissing) {
    console.error(
      "[VENUE STORAGE BUCKET CHECK]",
      check.status,
      checkBody,
    );

    throw new Error(
      "VENUE_STORAGE_BUCKET_CHECK_FAILED",
    );
  }

  const create =
    await fetch(
      `${baseUrl}/storage/v1/bucket`,
      {
        method: "POST",

        headers: {
          ...headers,
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          id: BUCKET,
          name: BUCKET,
          public: true,

          allowed_mime_types: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "video/mp4",
            "video/webm",
            "video/quicktime",
          ],
        }),
      },
    );

  if (
    !create.ok
    && create.status !== 409
  ) {
    console.error(
      "[VENUE STORAGE BUCKET CREATE]",
      create.status,
      await create.text(),
    );

    throw new Error(
      "VENUE_STORAGE_BUCKET_CREATE_FAILED",
    );
  }

  console.log(
    `[VENUE STORAGE] bucket ${BUCKET} ready`,
  );
}

export async function uploadVenueImage(
  input: {
    companyId: string;
    venueId: string;

    role:
      | "cover"
      | "gallery";

    file: {
      buffer: Buffer;
      mimetype: string;
      size: number;
    };
  },
) {
  if (
    input.file.size <= 0
  ) {
    throw new Error(
      "VENUE_IMAGE_EMPTY",
    );
  }

  if (
    input.file.size
    > 40 * 1024 * 1024
  ) {
    throw new Error(
      "VENUE_IMAGE_TOO_LARGE",
    );
  }

  const extension =
    extensionForMime(
      input.file.mimetype,
    );

  const {
    baseUrl,
    serviceRoleKey,
  } =
    await supabaseConfig();

  await ensureBucket(
    baseUrl,
    serviceRoleKey,
  );

  const objectPath =
    [
      cleanSegment(
        input.companyId,
      ),

      "crm-venues",

      cleanSegment(
        input.venueId,
      ),

      `${input.role}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${extension}`,
    ].join("/");

  const response =
    await fetch(
      `${baseUrl}/storage/v1/object/${BUCKET}/${objectPath}`,
      {
        method:
          "POST",

        headers: {
          apikey:
            serviceRoleKey,

          Authorization:
            `Bearer ${serviceRoleKey}`,

          "Content-Type":
            input.file
              .mimetype,

          "x-upsert":
            "false",
        },

        body:
          new Uint8Array(
            input.file.buffer,
          ),
      },
    );

  if (!response.ok) {
    const text =
      await response.text();

    console.error(
      "[VENUE IMAGE UPLOAD]",
      {
        status:
          response.status,

        body:
          text,
      },
    );

    throw new Error(
      "VENUE_IMAGE_UPLOAD_FAILED",
    );
  }

  return {
    bucket:
      BUCKET,

    path:
      objectPath,

    role:
      input.role,

    url:
      `${baseUrl}/storage/v1/object/public/${BUCKET}/${objectPath}`,
  };
}

export async function deleteVenueImageFile(
  input: {
    bucket: string;
    path: string;
  },
) {
  if (
    input.bucket
    !== BUCKET
  ) {
    throw new Error(
      "VENUE_IMAGE_INVALID_BUCKET",
    );
  }

  const {
    baseUrl,
    serviceRoleKey,
  } =
    await supabaseConfig();

  const objectPath =
    input.path
      .trim()
      .replace(
        /^\/+/,
        "",
      );

  if (
    !objectPath
    || objectPath.includes(
      "..",
    )
  ) {
    throw new Error(
      "VENUE_IMAGE_INVALID_PATH",
    );
  }

  const encodedPath =
    objectPath
      .split("/")
      .map(
        encodeURIComponent,
      )
      .join("/");

  const response =
    await fetch(
      `${baseUrl}/storage/v1/object/${encodeURIComponent(
        BUCKET,
      )}/${encodedPath}`,
      {
        method:
          "DELETE",

        headers: {
          apikey:
            serviceRoleKey,

          Authorization:
            `Bearer ${serviceRoleKey}`,
        },
      },
    );

  if (
    !response.ok
    && response.status
      !== 404
  ) {
    const text =
      await response.text();

    console.error(
      "[VENUE IMAGE DELETE]",
      {
        status:
          response.status,

        body:
          text,
      },
    );

    throw new Error(
      "VENUE_IMAGE_DELETE_FAILED",
    );
  }

  return {
    deleted:
      response.ok,

    alreadyMissing:
      response.status
      === 404,
  };
}
