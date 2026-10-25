import { createHash } from "node:crypto";
import { Router, type Request, type Response } from "express";
import multer from "multer";

import { supabaseRequest } from "../services/db/supabase-rest.client.js";
import {
  uploadVenueImage,
  deleteVenueImageFile,
} from "../services/crm/venue-image.service.js";
import {
  uploadVenueVideo,
  deleteVenueMediaFile,
} from "../services/crm/venue-media.service.js";

export const ownerWorkspaceRoutes = Router();

type Row = Record<string, unknown>;
type Owner = { company_id: string; provider_id: string };

const enc = encodeURIComponent;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sha = (s: string) =>
  createHash("sha256").update(s).digest("hex");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024, files: 1 },
});

function failure(res: Response, error: unknown) {
  console.error(
    "[OWNER WORKSPACE]",
    error instanceof Error ? error.message : "unknown"
  );
  return res.status(503).json({
    ok: false,
    error: "OWNER_OPERATION_UNAVAILABLE",
  });
}

async function context(req: Request, res: Response) {
  const token = req.cookies?.em_owner_session;

  if (typeof token !== "string" || token.length < 32) {
    res.status(401).json({ ok: false, error: "OWNER_AUTH_REQUIRED" });
    return null;
  }

  const sessions = await supabaseRequest<Owner[]>({
    table: "crm_venue_owner_sessions",
    query:
      `?token_hash=eq.${sha(token)}` +
      "&revoked_at=is.null" +
      `&expires_at=gt.${enc(new Date().toISOString())}` +
      "&select=company_id,provider_id&limit=1",
  });

  const owner = sessions[0];

  if (!owner) {
    res.status(401).json({ ok: false, error: "OWNER_AUTH_REQUIRED" });
    return null;
  }

  const providers = await supabaseRequest<Row[]>({
    table: "crm_providers",
    query:
      `?id=eq.${owner.provider_id}` +
      `&company_id=eq.${enc(owner.company_id)}` +
      "&status=eq.active&select=id&limit=1",
  });

  if (!providers.length) {
    res.status(401).json({ ok: false, error: "OWNER_INACTIVE" });
    return null;
  }

  const venueId = String(req.params.venueId ?? "");

  if (!uuid.test(venueId)) {
    res.status(400).json({ ok: false, error: "INVALID_VENUE_ID" });
    return null;
  }

  const venues = await supabaseRequest<Row[]>({
    table: "crm_venues",
    query:
      `?id=eq.${venueId}` +
      `&company_id=eq.${enc(owner.company_id)}` +
      `&provider_id=eq.${owner.provider_id}` +
      "&limit=1",
  });

  if (!venues.length) {
    res.status(404).json({ ok: false, error: "VENUE_NOT_FOUND" });
    return null;
  }

  return { owner, venueId, venue: venues[0] };
}

const venueFields = [
  "id", "name", "slug", "status",
  "description", "province", "city",
  "address", "public_location",
  "capacity_min", "capacity_max",
];

function safeVenue(row: Row) {
  return Object.fromEntries(
    venueFields
      .filter((key) => key in row)
      .map((key) => [key, row[key]])
  );
}

function sameVenueQuery(
  company: string,
  venueId: string,
) {
  return (
    `?company_id=eq.${enc(company)}` +
    `&venue_id=eq.${venueId}`
  );
}

// Panel principal con datos reales de cada módulo.
ownerWorkspaceRoutes.get(
  "/venues/:venueId/workspace",
  async (req, res) => {
    try {
      const ctx = await context(req, res);
      if (!ctx) return;

      const { owner, venueId, venue } = ctx;
      const filter = sameVenueQuery(owner.company_id, venueId);

      const from = new Date(Date.now() - 32 * 86400000).toISOString();
      const to = new Date(Date.now() + 370 * 86400000).toISOString();

      const [
        images, assets, blocks, inquiries,
        contracts, settlements, incidents,
      ] = await Promise.all([
        supabaseRequest<Row[]>({
          table: "crm_venue_images",
          query: filter + "&order=sort_order.asc,created_at.asc",
        }),
        supabaseRequest<Row[]>({
          table: "crm_venue_owner_assets",
          query: filter +
            `&provider_id=eq.${owner.provider_id}` +
            "&order=created_at.desc",
        }),
        supabaseRequest<Row[]>({
          table: "crm_venue_calendar_blocks",
          query: filter +
            `&starts_at=lt.${enc(to)}` +
            `&ends_at=gt.${enc(from)}` +
            "&status=in.(blocked,held,reserved)" +
            "&select=id,starts_at,ends_at,status,notes" +
            "&order=starts_at.asc",
        }),
        supabaseRequest<Row[]>({
          table: "crm_venue_availability_inquiries",
          query: filter +
            "&select=id,starts_at,ends_at,status,owner_notes,requested_at" +
            "&order=requested_at.desc&limit=100",
        }),
        supabaseRequest<Row[]>({
          table: "crm_venue_owner_contracts",
          query: filter +
            `&provider_id=eq.${owner.provider_id}` +
            "&order=created_at.desc",
        }),
        supabaseRequest<Row[]>({
          table: "crm_venue_owner_settlements",
          query: filter +
            `&provider_id=eq.${owner.provider_id}` +
            "&order=created_at.desc",
        }),
        supabaseRequest<Row[]>({
          table: "crm_venue_owner_incidents",
          query: filter +
            `&provider_id=eq.${owner.provider_id}` +
            "&order=created_at.desc",
        }),
      ]);

      res.setHeader("Cache-Control", "no-store");
      return res.json({
        ok: true,
        venue: safeVenue(venue),
        images,
        assets,
        blocks,
        inquiries,
        contracts,
        settlements,
        incidents,
      });
    } catch (error) {
      return failure(res, error);
    }
  }
);

// Editar únicamente los campos permitidos.
ownerWorkspaceRoutes.patch(
  "/venues/:venueId/details",
  async (req, res) => {
    try {
      const ctx = await context(req, res);
      if (!ctx) return;

      const limits: Record<string, number> = {
        name: 220,
        description: 12000,
        province: 120,
        city: 120,
        address: 500,
        public_location: 300,
      };

      const body = req.body;

      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return res.status(400).json({
          ok: false, error: "INVALID_DETAILS",
        });
      }

      const changes: Row = {};

      for (const [key, value] of Object.entries(body)) {
        if (key in limits) {
          if (value !== null && typeof value !== "string") {
            return res.status(400).json({
              ok: false, error: "INVALID_FIELD",
            });
          }

          if (typeof value === "string" && value.length > limits[key]) {
            return res.status(400).json({
              ok: false, error: "FIELD_TOO_LONG",
            });
          }

          changes[key] = typeof value === "string"
            ? value.trim() || null
            : null;
        } else if (key === "capacity_min" || key === "capacity_max") {
          if (
            value !== null &&
            (!Number.isInteger(value) ||
              Number(value) < 0 ||
              Number(value) > 100000)
          ) {
            return res.status(400).json({
              ok: false, error: "INVALID_CAPACITY",
            });
          }
          changes[key] = value;
        } else {
          return res.status(400).json({
            ok: false, error: "FIELD_NOT_EDITABLE",
          });
        }
      }

      if (!Object.keys(changes).length) {
        return res.status(400).json({
          ok: false, error: "NO_CHANGES",
        });
      }

      if (changes.name === null) {
        return res.status(400).json({
          ok: false, error: "NAME_REQUIRED",
        });
      }

      const min = changes.capacity_min ?? ctx.venue.capacity_min;
      const max = changes.capacity_max ?? ctx.venue.capacity_max;

      if (
        typeof min === "number" &&
        typeof max === "number" &&
        min > max
      ) {
        return res.status(400).json({
          ok: false, error: "CAPACITY_RANGE_INVALID",
        });
      }

      const rows = await supabaseRequest<Row[]>({
        table: "crm_venues",
        method: "PATCH",
        query:
          `?id=eq.${ctx.venueId}` +
          `&company_id=eq.${enc(ctx.owner.company_id)}` +
          `&provider_id=eq.${ctx.owner.provider_id}`,
        prefer: "return=representation",
        body: changes,
      });

      return res.json({
        ok: true,
        venue: safeVenue(rows[0] ?? { ...ctx.venue, ...changes }),
      });
    } catch (error) {
      return failure(res, error);
    }
  }
);

// Bloquear un día o período.
ownerWorkspaceRoutes.post(
  "/venues/:venueId/blocks",
  async (req, res) => {
    try {
      const ctx = await context(req, res);
      if (!ctx) return;

      const startsAt = req.body?.startsAt;
      const endsAt = req.body?.endsAt;

      if (
        typeof startsAt !== "string" ||
        typeof endsAt !== "string" ||
        !Number.isFinite(Date.parse(startsAt)) ||
        !Number.isFinite(Date.parse(endsAt))
      ) {
        return res.status(400).json({
          ok: false, error: "INVALID_DATES",
        });
      }

      const duration = Date.parse(endsAt) - Date.parse(startsAt);

      if (duration <= 0 || duration > 32 * 86400000) {
        return res.status(400).json({
          ok: false, error: "INVALID_DATE_RANGE",
        });
      }

      const query = sameVenueQuery(
        ctx.owner.company_id, ctx.venueId
      );

      const conflicts = await supabaseRequest<Row[]>({
        table: "crm_venue_calendar_blocks",
        query: query +
          "&status=in.(blocked,held,reserved)" +
          `&starts_at=lt.${enc(endsAt)}` +
          `&ends_at=gt.${enc(startsAt)}` +
          "&select=id&limit=1",
      });

      if (conflicts.length) {
        return res.status(409).json({
          ok: false, error: "VENUE_DATE_CONFLICT",
        });
      }

      try {
        const rows = await supabaseRequest<Row[]>({
          table: "crm_venue_calendar_blocks",
          method: "POST",
          prefer: "return=representation",
          body: {
            company_id: ctx.owner.company_id,
            venue_id: ctx.venueId,
            starts_at: startsAt,
            ends_at: endsAt,
            status: "blocked",
            notes: `OWNER_PORTAL:${ctx.owner.provider_id}`,
          },
        });

        return res.status(201).json({
          ok: true, block: rows[0],
        });
      } catch {
        // La restricción de exclusión en PostgreSQL decide
        // si dos solicitudes simultáneas entran en conflicto.
        return res.status(409).json({
          ok: false, error: "BLOCK_CONFLICT_OR_UNAVAILABLE",
        });
      }
    } catch (error) {
      return failure(res, error);
    }
  }
);

// Liberar únicamente bloqueos creados desde su portal.
ownerWorkspaceRoutes.patch(
  "/venues/:venueId/blocks/:blockId/cancel",
  async (req, res) => {
    try {
      const ctx = await context(req, res);
      if (!ctx) return;

      const blockId = String(req.params.blockId ?? "");
      if (!uuid.test(blockId)) {
        return res.status(400).json({
          ok: false, error: "INVALID_BLOCK",
        });
      }

      const rows = await supabaseRequest<Row[]>({
        table: "crm_venue_calendar_blocks",
        method: "PATCH",
        query:
          sameVenueQuery(ctx.owner.company_id, ctx.venueId) +
          `&id=eq.${blockId}` +
          "&status=eq.blocked" +
          "&event_id=is.null" +
          `&notes=eq.${enc(`OWNER_PORTAL:${ctx.owner.provider_id}`)}`,
        prefer: "return=representation",
        body: {
          status: "cancelled",
          updated_at: new Date().toISOString(),
        },
      });

      if (!rows.length) {
        return res.status(404).json({
          ok: false, error: "OWNER_BLOCK_NOT_FOUND",
        });
      }

      return res.json({ ok: true, block: rows[0] });
    } catch (error) {
      return failure(res, error);
    }
  }
);

// Responder a una consulta sin crear una reserva automática.
ownerWorkspaceRoutes.patch(
  "/venues/:venueId/inquiries/:inquiryId",
  async (req, res) => {
    try {
      const ctx = await context(req, res);
      if (!ctx) return;

      const inquiryId = String(req.params.inquiryId ?? "");
      const status = req.body?.status;
      const notes = req.body?.notes ?? "";

      if (
        !uuid.test(inquiryId) ||
        !["available","unavailable","conditional"].includes(status) ||
        typeof notes !== "string" ||
        notes.length > 1000
      ) {
        return res.status(400).json({
          ok: false, error: "INVALID_INQUIRY_RESPONSE",
        });
      }

      const rows = await supabaseRequest<Row[]>({
        table: "crm_venue_availability_inquiries",
        method: "PATCH",
        query:
          sameVenueQuery(ctx.owner.company_id, ctx.venueId) +
          `&id=eq.${inquiryId}&status=eq.pending`,
        prefer: "return=representation",
        body: {
          status,
          owner_notes: notes.trim() || null,
          answered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      if (!rows.length) {
        return res.status(409).json({
          ok: false, error: "INQUIRY_NOT_PENDING",
        });
      }

      return res.json({ ok: true, inquiry: rows[0] });
    } catch (error) {
      return failure(res, error);
    }
  }
);

// Subir una fotografía o vídeo al almacenamiento existente.
ownerWorkspaceRoutes.post(
  "/venues/:venueId/assets",
  async (req, res, next) => {
    try {
      const owner = await context(req, res);
      if (!owner) return;
      next();
    } catch (error) {
      failure(res, error);
    }
  },
  upload.single("file"),
  async (req, res) => {
    try {
      const ctx = await context(req, res);
      if (!ctx) return;

      const file = req.file;

      if (!file || !file.size) {
        return res.status(400).json({
          ok: false, error: "FILE_REQUIRED",
        });
      }


      // OWNER_HEIC_SERVER_CONVERSION_V1
      // Convertir HEIC antes de validar y almacenar la imagen.
      const heicName = /\.(heic|heif)$/i.test(
        file.originalname ?? ""
      );

      if (heicName) {
        const header = file.buffer
          .subarray(8, Math.min(file.buffer.length, 96))
          .toString("latin1");

        const heicBrands = [
          "heic", "heix", "hevc",
          "hevx", "heim", "heis",
        ];

        const validContainer =
          file.buffer.length >= 16 &&
          file.buffer.toString("ascii", 4, 8) === "ftyp" &&
          heicBrands.some(brand => header.includes(brand));

        if (
          !validContainer ||
          file.size > 40 * 1024 * 1024
        ) {
          return res.status(400).json({
            ok: false,
            error: "INVALID_HEIC_FILE",
          });
        }

        const { mkdtemp, writeFile, readFile, rm } =
          await import("node:fs/promises");

        const { tmpdir } = await import("node:os");
        const { join } = await import("node:path");
        const { execFile } = await import("node:child_process");
        const { promisify } = await import("node:util");

        const directory = await mkdtemp(
          join(tmpdir(), "eventos-heic-")
        );

        try {
          const source = join(directory, "original.heic");
          const target = join(directory, "converted.jpg");

          await writeFile(source, file.buffer, {
            mode: 0o600,
          });

          await promisify(execFile)(
            "/opt/eventos-heic-venv/bin/python3",
            [
              "/var/www/control/apps/api/scripts/convert-owner-heic.py",
              source,
              target,
            ],
            {
              timeout: 90000,
              maxBuffer: 1024 * 1024,
            }
          );

          const jpeg = await readFile(target);

          const validJpeg =
            jpeg.length >= 3 &&
            jpeg[0] === 0xff &&
            jpeg[1] === 0xd8 &&
            jpeg[2] === 0xff &&
            jpeg.length <= 40 * 1024 * 1024;

          if (!validJpeg) {
            throw new Error("INVALID_CONVERTED_JPEG");
          }

          file.buffer = jpeg;
          file.size = jpeg.length;
          file.mimetype = "image/jpeg";
          file.originalname = file.originalname.replace(
            /\.(heic|heif)$/i,
            ".jpg"
          );

        } catch (error) {
          // OWNER_HEIC_DIAGNOSTICS_V1
          const conversionError = error as Error & {
            stderr?: string;
            stdout?: string;
            code?: number | string;
          };

          console.error(
            "[OWNER HEIC CONVERSION]",
            JSON.stringify({
              code: conversionError?.code ?? null,
              message: conversionError?.message ?? "Conversion failed",
              stderr: String(
                conversionError?.stderr ?? ""
              ).slice(0, 2000),
              stdout: String(
                conversionError?.stdout ?? ""
              ).slice(0, 500),
              bytes: file.size,
            })
          );

          return res.status(422).json({
            ok: false,
            error: "HEIC_CONVERSION_FAILED",
          });

        } finally {
          await rm(directory, {
            recursive: true,
            force: true,
          });
        }
      }

      const isImage = [
        "image/jpeg", "image/png", "image/webp",
      ].includes(file.mimetype);

      // OWNER_VIDEO_SIGNATURE_30_V1
      // Validar la cabecera real del contenedor.
      const extension = String(file.originalname ?? "")
        .split(".")
        .pop()
        ?.toLowerCase();

      const buffer = file.buffer;

      const isIsoVideo =
        buffer.length >= 12 &&
        buffer.toString("ascii", 4, 8) === "ftyp";

      const isWebmVideo =
        buffer.length >= 16 &&
        buffer[0] === 0x1a &&
        buffer[1] === 0x45 &&
        buffer[2] === 0xdf &&
        buffer[3] === 0xa3 &&
        buffer.subarray(0, 4096)
          .toString("ascii")
          .includes("webm");

      const videoMime =
        extension === "mp4" && isIsoVideo
          ? "video/mp4"
          : extension === "mov" && isIsoVideo
            ? "video/quicktime"
            : extension === "webm" && isWebmVideo
              ? "video/webm"
              : null;

      const isVideo = videoMime !== null;

      if (
        (!isImage && !isVideo) ||
        (isImage && file.size > 40 * 1024 * 1024) ||
        (isVideo && file.size > 200 * 1024 * 1024)
      ) {
        return res.status(400).json({
          ok: false, error: "UNSUPPORTED_FILE",
        });
      }

      const current = await supabaseRequest<Row[]>({
        table: "crm_venue_owner_assets",
        query:
          sameVenueQuery(ctx.owner.company_id, ctx.venueId) +
          `&provider_id=eq.${ctx.owner.provider_id}` +
          `&kind=eq.${isImage ? "image" : "video"}` +
          "&select=id",
      });

      if (current.length >= (isImage ? 60 : 30)) {
        return res.status(409).json({
          ok: false, error: "MEDIA_LIMIT_REACHED",
        });
      }

      const uploaded = isImage
        ? await uploadVenueImage({
            role: "gallery",
            companyId: ctx.owner.company_id,
            venueId: ctx.venueId,
            file: {
              buffer: file.buffer,
              mimetype: file.mimetype,
              size: file.size,
            },
          })
        : await uploadVenueVideo({
            companyId: ctx.owner.company_id,
            venueId: ctx.venueId,
            file: {
              buffer: file.buffer,
              mimetype: videoMime ?? file.mimetype,
              size: file.size,
            },
          });

      try {
        const rows = await supabaseRequest<Row[]>({
          table: "crm_venue_owner_assets",
          method: "POST",
          prefer: "return=representation",
          body: {
            company_id: ctx.owner.company_id,
            provider_id: ctx.owner.provider_id,
            venue_id: ctx.venueId,
            kind: isImage ? "image" : "video",
            bucket: uploaded.bucket,
            path: uploaded.path,
            url: uploaded.url,
          },
        });

        return res.status(201).json({
          ok: true, asset: rows[0],
        });
      } catch (error) {
        if (isImage) {
          await deleteVenueImageFile({
            bucket: uploaded.bucket, path: uploaded.path,
          }).catch(() => undefined);
        } else {
          await deleteVenueMediaFile({
            bucket: uploaded.bucket, path: uploaded.path,
          }).catch(() => undefined);
        }
        throw error;
      }
    } catch (error) {
      return failure(res, error);
    }
  }
);

// Portada de la galería del propietario.
ownerWorkspaceRoutes.patch(
  "/venues/:venueId/assets/:assetId/cover",
  async (req, res) => {
    try {
      const ctx = await context(req, res);
      if (!ctx) return;

      const assetId = String(req.params.assetId ?? "");
      if (!uuid.test(assetId)) {
        return res.status(400).json({
          ok: false, error: "INVALID_ASSET",
        });
      }

      const filter =
        sameVenueQuery(ctx.owner.company_id, ctx.venueId) +
        `&provider_id=eq.${ctx.owner.provider_id}`;

      const exists = await supabaseRequest<Row[]>({
        table: "crm_venue_owner_assets",
        query: filter +
          `&id=eq.${assetId}&kind=eq.image&select=id&limit=1`,
      });

      if (!exists.length) {
        return res.status(404).json({
          ok: false, error: "ASSET_NOT_FOUND",
        });
      }

      await supabaseRequest({
        table: "crm_venue_owner_assets",
        method: "PATCH",
        query: filter + "&kind=eq.image&is_cover=eq.true",
        body: { is_cover: false },
      });

      await supabaseRequest({
        table: "crm_venue_owner_assets",
        method: "PATCH",
        query: filter + `&id=eq.${assetId}`,
        body: { is_cover: true },
      });

      return res.json({ ok: true });
    } catch (error) {
      return failure(res, error);
    }
  }
);

// Eliminar archivos propios.
ownerWorkspaceRoutes.delete(
  "/venues/:venueId/assets/:assetId",
  async (req, res) => {
    try {
      const ctx = await context(req, res);
      if (!ctx) return;

      const assetId = String(req.params.assetId ?? "");
      if (!uuid.test(assetId)) {
        return res.status(400).json({
          ok: false, error: "INVALID_ASSET",
        });
      }

      const filter =
        sameVenueQuery(ctx.owner.company_id, ctx.venueId) +
        `&provider_id=eq.${ctx.owner.provider_id}` +
        `&id=eq.${assetId}`;

      const rows = await supabaseRequest<Row[]>({
        table: "crm_venue_owner_assets",
        query: filter + "&limit=1",
      });

      if (!rows.length) {
        return res.status(404).json({
          ok: false, error: "ASSET_NOT_FOUND",
        });
      }

      const asset = rows[0];

      if (asset.kind === "video") {
        await deleteVenueMediaFile({
          bucket: String(asset.bucket),
          path: String(asset.path),
        });
      } else {
        await deleteVenueImageFile({
          bucket: String(asset.bucket),
          path: String(asset.path),
        });
      }

      await supabaseRequest({
        table: "crm_venue_owner_assets",
        method: "DELETE",
        query: filter,
      });

      return res.json({ ok: true });
    } catch (error) {
      return failure(res, error);
    }
  }
);

// Registrar incidencia de una propiedad.
ownerWorkspaceRoutes.post(
  "/venues/:venueId/incidents",
  async (req, res) => {
    try {
      const ctx = await context(req, res);
      if (!ctx) return;

      const title = req.body?.title;
      const description = req.body?.description;

      if (
        typeof title !== "string" ||
        title.trim().length < 4 ||
        title.length > 160 ||
        typeof description !== "string" ||
        description.trim().length < 10 ||
        description.length > 4000
      ) {
        return res.status(400).json({
          ok: false, error: "INVALID_INCIDENT",
        });
      }

      const rows = await supabaseRequest<Row[]>({
        table: "crm_venue_owner_incidents",
        method: "POST",
        prefer: "return=representation",
        body: {
          company_id: ctx.owner.company_id,
          provider_id: ctx.owner.provider_id,
          venue_id: ctx.venueId,
          title: title.trim(),
          description: description.trim(),
          status: "open",
        },
      });

      return res.status(201).json({
        ok: true, incident: rows[0],
      });
    } catch (error) {
      return failure(res, error);
    }
  }
);
