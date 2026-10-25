import crypto from "node:crypto";

import {
  readIntegrationSecrets,
} from "../integrations/integration-secrets.repository.js";

import {
  env,
} from "../../config/env.js";

const PRIVATE_BUCKET =
  "crm-private-files";

const PUBLIC_BUCKET =
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
      /[^a-zA-Z0-9._-]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    )
    .toLowerCase()
    || "file";
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

async function ensurePrivateBucket(
  baseUrl: string,
  serviceRoleKey: string,
) {
  const headers = {
    apikey:
      serviceRoleKey,

    Authorization:
      `Bearer ${serviceRoleKey}`,
  };

  const check =
    await fetch(
      `${baseUrl}/storage/v1/bucket/${PRIVATE_BUCKET}`,
      {
        headers,
      },
    );

  if (check.ok) {
    return;
  }

  const body =
    await check.text();

  const missing =
    check.status === 404
    || body.includes(
      "Bucket not found",
    )
    || body.includes(
      "NoSuchBucket",
    );

  if (!missing) {
    throw new Error(
      `CRM_PRIVATE_BUCKET_CHECK_FAILED:${check.status}:${body}`,
    );
  }

  const create =
    await fetch(
      `${baseUrl}/storage/v1/bucket`,
      {
        method:
          "POST",

        headers: {
          ...headers,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            id:
              PRIVATE_BUCKET,

            name:
              PRIVATE_BUCKET,

            public:
              false,

            file_size_limit:
              524288000,
          }),
      },
    );

  if (
    !create.ok
    && create.status !== 409
  ) {
    throw new Error(
      `CRM_PRIVATE_BUCKET_CREATE_FAILED:${create.status}:${await create.text()}`,
    );
  }
}

export type CrmFileUploadInput = {
  companyId: string;

  providerId?: string | null;

  venueId?: string | null;

  eventId?: string | null;

  originalName: string;

  mimetype:
    string;

  buffer:
    Buffer;

  visibility:
    | "public"
    | "private"
    | "internal";
};

export async function uploadCrmFile(
  input:
    CrmFileUploadInput,
) {
  if (
    input.buffer.length === 0
  ) {
    throw new Error(
      "CRM_FILE_EMPTY",
    );
  }

  const {
    baseUrl,
    serviceRoleKey,
  } =
    await supabaseConfig();

  const isPublic =
    input.visibility
    === "public";

  const bucket =
    isPublic
      ? PUBLIC_BUCKET
      : PRIVATE_BUCKET;

  if (!isPublic) {
    await ensurePrivateBucket(
      baseUrl,
      serviceRoleKey,
    );
  }

  const hash =
    crypto
      .createHash(
        "sha256",
      )
      .update(
        input.buffer,
      )
      .digest(
        "hex",
      );

  const objectPath =
    [
      cleanSegment(
        input.companyId,
      ),

      "crm-files",

      input.providerId
        ? `provider-${cleanSegment(
            input.providerId,
          )}`
        : "no-provider",

      input.venueId
        ? `venue-${cleanSegment(
            input.venueId,
          )}`
        : "no-venue",

      `${Date.now()}-${hash.slice(
        0,
        12,
      )}-${cleanSegment(
        input.originalName,
      )}`,
    ].join("/");

  const upload =
    await fetch(
      `${baseUrl}/storage/v1/object/${bucket}/${objectPath}`,
      {
        method:
          "POST",

        headers: {
          apikey:
            serviceRoleKey,

          Authorization:
            `Bearer ${serviceRoleKey}`,

          "Content-Type":
            input.mimetype
            || "application/octet-stream",

          "x-upsert":
            "false",
        },

        body:
          new Uint8Array(
            input.buffer,
          ),
      },
    );

  if (!upload.ok) {
    throw new Error(
      `CRM_FILE_UPLOAD_FAILED:${upload.status}:${await upload.text()}`,
    );
  }

  return {
    bucket,

    path:
      objectPath,

    publicUrl:
      isPublic
        ? `${baseUrl}/storage/v1/object/public/${bucket}/${objectPath}`
        : null,

    checksumSha256:
      hash,

    size:
      input.buffer.length,
  };
}

export async function createCrmFileSignedUrl(
  input: {
    bucket: string;
    path: string;
    expiresIn?: number;
  },
) {
  if (
    input.bucket
    !== PRIVATE_BUCKET
  ) {
    throw new Error(
      "CRM_SIGNED_URL_PRIVATE_BUCKET_REQUIRED",
    );
  }

  const {
    baseUrl,
    serviceRoleKey,
  } =
    await supabaseConfig();

  const response =
    await fetch(
      `${baseUrl}/storage/v1/object/sign/${input.bucket}/${input.path}`,
      {
        method:
          "POST",

        headers: {
          apikey:
            serviceRoleKey,

          Authorization:
            `Bearer ${serviceRoleKey}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            expiresIn:
              input.expiresIn
              ?? 900,
          }),
      },
    );

  if (!response.ok) {
    throw new Error(
      `CRM_SIGNED_URL_FAILED:${response.status}:${await response.text()}`,
    );
  }

  const body =
    await response.json() as {
      signedURL?: string;
      signedUrl?: string;
    };

  const signed =
    body.signedURL
    || body.signedUrl;

  if (!signed) {
    throw new Error(
      "CRM_SIGNED_URL_MISSING",
    );
  }

  return signed.startsWith(
    "http",
  )
    ? signed
    : `${baseUrl}/storage/v1${signed}`;
}
