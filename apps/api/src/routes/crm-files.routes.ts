import {
  Router,
  type Request,
  type Response,
} from "express";

import multer from "multer";

import {
  z,
  ZodError,
} from "zod";

import {
  supabaseRequest,
} from "../services/db/supabase-rest.client.js";

import {
  uploadCrmFile,
  createCrmFileSignedUrl,
} from "../services/crm/crm-file-storage.service.js";

export const crmFilesRoutes =
  Router();

type DbRow =
  Record<string, unknown>;

const adminRoles =
  new Set([
    "superadmin",
    "owner",
    "admin",
    "supervisor",
  ]);

const fileUpload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        500 * 1024 * 1024,

      files:
        20,
    },
  });

function companyId(
  request: Request,
) {
  const value =
    request
      .tenantContext
      ?.effectiveCompanyId;

  if (!value) {
    throw new Error(
      "COMPANY_CONTEXT_NOT_RESOLVED",
    );
  }

  return value;
}

function requireAdmin(
  request: Request,
  response: Response,
) {
  if (
    !request.authUser
    || !adminRoles.has(
      request.authUser.role,
    )
  ) {
    response
      .status(403)
      .json({
        ok: false,
        error:
          "ADMIN_REQUIRED",
      });

    return false;
  }

  return true;
}

function eq(
  value: string,
) {
  return encodeURIComponent(
    value,
  );
}

function nullableUuid(
  value: unknown,
) {
  if (
    value === undefined
    || value === null
    || value === ""
  ) {
    return null;
  }

  return z
    .string()
    .uuid()
    .parse(
      value,
    );
}

function categoryFromMime(
  mimeType: string,
  filename: string,
) {
  const lower =
    filename
      .toLowerCase();

  if (
    mimeType.startsWith(
      "image/",
    )
  ) {
    return "image";
  }

  if (
    mimeType.startsWith(
      "video/",
    )
  ) {
    return "video";
  }

  if (
    mimeType.startsWith(
      "audio/",
    )
  ) {
    return "audio";
  }

  if (
    lower.includes(
      "contrato",
    )
    || lower.includes(
      "contract",
    )
  ) {
    return "contract";
  }

  if (
    lower.includes(
      "presupuesto",
    )
    || lower.includes(
      "quote",
    )
  ) {
    return "quote";
  }

  if (
    lower.endsWith(
      ".xlsx",
    )
    || lower.endsWith(
      ".xls",
    )
    || lower.endsWith(
      ".csv",
    )
  ) {
    return "spreadsheet";
  }

  if (
    mimeType.includes(
      "pdf",
    )
    || mimeType.includes(
      "word",
    )
    || lower.endsWith(
      ".doc",
    )
    || lower.endsWith(
      ".docx",
    )
  ) {
    return "document";
  }

  return "other";
}

function extensionFromName(
  filename: string,
) {
  const index =
    filename
      .lastIndexOf(".");

  if (
    index < 0
    || index ===
      filename.length - 1
  ) {
    return null;
  }

  return filename
    .slice(
      index + 1,
    )
    .toLowerCase();
}

function handleError(
  error: unknown,
  response: Response,
) {
  console.error(
    "[CRM FILES]",
    error,
  );

  if (
    error instanceof ZodError
  ) {
    return response
      .status(400)
      .json({
        ok: false,
        error:
          "VALIDATION_ERROR",
        details:
          error.issues,
      });
  }

  return response
    .status(500)
    .json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "CRM_FILES_ERROR",
    });
}

/* ============================================================
 * LIST
 * ============================================================ */

crmFilesRoutes.get(
  "/files",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const tenant =
        companyId(
          request,
        );

      const providerId =
        nullableUuid(
          request.query
            .providerId,
        );

      const venueId =
        nullableUuid(
          request.query
            .venueId,
        );

      const eventId =
        nullableUuid(
          request.query
            .eventId,
        );

      const category =
        typeof request.query
          .category
        === "string"
          ? request.query
              .category
              .trim()
          : null;

      let query =
        `?company_id=eq.${eq(
          tenant,
        )}`
        + "&active=eq.true"
        + "&select=*"
        + "&order=created_at.desc"
        + "&limit=500";

      if (providerId) {
        query +=
          `&provider_id=eq.${eq(
            providerId,
          )}`;
      }

      if (venueId) {
        query +=
          `&venue_id=eq.${eq(
            venueId,
          )}`;
      }

      if (eventId) {
        query +=
          `&event_id=eq.${eq(
            eventId,
          )}`;
      }

      if (category) {
        query +=
          `&category=eq.${eq(
            category,
          )}`;
      }

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_files",

          query,
        });

      return response
        .json({
          ok: true,
          files:
            rows,
        });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);

/* ============================================================
 * UPLOAD
 * ============================================================ */

crmFilesRoutes.post(
  "/files",

  fileUpload.array(
    "files",
    20,
  ),

  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const tenant =
        companyId(
          request,
        );

      const providerId =
        nullableUuid(
          request.body
            ?.providerId,
        );

      const venueId =
        nullableUuid(
          request.body
            ?.venueId,
        );

      const eventId =
        nullableUuid(
          request.body
            ?.eventId,
        );

      const visibility =
        z.enum([
          "public",
          "private",
          "internal",
        ])
          .parse(
            request.body
              ?.visibility
            ?? "private",
          );

      const requestedCategory =
        request.body
          ?.category
        ? z.enum([
            "image",
            "video",
            "contract",
            "quote",
            "spreadsheet",
            "document",
            "audio",
            "location",
            "terms",
            "availability",
            "historical",
            "other",
          ])
            .parse(
              request.body
                .category,
            )
        : null;

      const files =
        Array.isArray(
          request.files,
        )
          ? request.files
          : [];

      if (
        files.length === 0
      ) {
        return response
          .status(400)
          .json({
            ok: false,
            error:
              "CRM_FILE_REQUIRED",
          });
      }

      const created:
        DbRow[] = [];

      for (
        const file
        of files
      ) {
        const category =
          requestedCategory
          ?? categoryFromMime(
            file.mimetype,
            file.originalname,
          );

        const uploaded =
          await uploadCrmFile({
            companyId:
              tenant,

            providerId,

            venueId,

            eventId,

            originalName:
              file.originalname,

            mimetype:
              file.mimetype
              || "application/octet-stream",

            buffer:
              file.buffer,

            visibility,
          });

        const rows =
          await supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_files",

            method:
              "POST",

            body: {
              company_id:
                tenant,

              provider_id:
                providerId,

              venue_id:
                venueId,

              event_id:
                eventId,

              category,

              visibility,

              title:
                file.originalname,

              original_name:
                file.originalname,

              mime_type:
                file.mimetype
                || "application/octet-stream",

              extension:
                extensionFromName(
                  file.originalname,
                ),

              size_bytes:
                uploaded.size,

              bucket:
                uploaded.bucket,

              storage_path:
                uploaded.path,

              public_url:
                uploaded.publicUrl,

              source:
                "manual",

              checksum_sha256:
                uploaded
                  .checksumSha256,

              metadata: {},
            },
          });

        if (
          rows[0]
        ) {
          created.push(
            rows[0],
          );
        }
      }

      return response
        .status(201)
        .json({
          ok: true,
          files:
            created,
        });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);

/* ============================================================
 * SIGNED URL
 * ============================================================ */

crmFilesRoutes.post(
  "/files/:fileId/signed-url",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const tenant =
        companyId(
          request,
        );

      const fileId =
        z.string()
          .uuid()
          .parse(
            request.params
              .fileId,
          );

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_files",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&id=eq.${eq(
              fileId,
            )}`
            + "&select=*"
            + "&limit=1",
        });

      const file =
        rows[0];

      if (!file) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "CRM_FILE_NOT_FOUND",
          });
      }

      if (
        file.visibility
        === "public"
        && file.public_url
      ) {
        return response
          .json({
            ok: true,
            url:
              file.public_url,
          });
      }

      const url =
        await createCrmFileSignedUrl({
          bucket:
            String(
              file.bucket,
            ),

          path:
            String(
              file.storage_path,
            ),

          expiresIn:
            900,
        });

      return response
        .json({
          ok: true,
          url,
        });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);

/* ============================================================
 * SOFT DELETE
 * ============================================================ */

crmFilesRoutes.delete(
  "/files/:fileId",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const tenant =
        companyId(
          request,
        );

      const fileId =
        z.string()
          .uuid()
          .parse(
            request.params
              .fileId,
          );

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_files",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&id=eq.${eq(
              fileId,
            )}`,

          body: {
            active:
              false,
          },
        });

      if (!rows[0]) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "CRM_FILE_NOT_FOUND",
          });
      }

      return response
        .json({
          ok: true,
          file:
            rows[0],
        });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);
