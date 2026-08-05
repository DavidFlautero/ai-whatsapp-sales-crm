import {
  uploadCatalogImage,
} from "../../services/catalog/catalog-image.service.js";
import {
  createFullCatalogProduct,
} from "../../services/catalog/catalog-full.service.js";
import {
  SupabaseRpcError,
} from "../../services/db/supabase-rest.client.js";
import type { Request, Response } from "express";
import {
  z,
  ZodError,
} from "zod";
import { listGovernanceEvents } from "../../services/governance/agent-governance.service.js";
import { listQualityScores } from "../../services/quality/conversation-quality.service.js";
import { listProducts, upsertProduct } from "../../services/catalog/catalog.repository.js";

export async function getIntelligenceDashboard(_req: Request, res: Response) {
  const [governance, quality, catalog] = await Promise.all([
    listGovernanceEvents(),
    listQualityScores(),
    listProducts()
  ]);

  res.json({
    ok: true,
    governance,
    quality,
    catalog
  });
}

export async function saveCatalogProduct(req: Request, res: Response) {
  const name = String(req.body?.name ?? "").trim();

  if (!name) {
    return res.status(400).json({
      ok: false,
      error: "name is required"
    });
  }

  const product = await upsertProduct({
    sku: req.body?.sku ? String(req.body.sku) : undefined,
    name,
    category: req.body?.category ? String(req.body.category) : undefined,
    color: req.body?.color ? String(req.body.color) : undefined,
    size: req.body?.size ? String(req.body.size) : undefined,
    price: req.body?.price ? Number(req.body.price) : undefined,
    stock: req.body?.stock ? Number(req.body.stock) : 0,
    tags: Array.isArray(req.body?.tags) ? req.body.tags : [],
    description: req.body?.description ? String(req.body.description) : undefined,
    active: true
  });

  res.json({
    ok: true,
    product
  });
}


const catalogImageSchema =
  z.object({
    id:
      z.string()
        .trim()
        .max(200)
        .optional(),

    url:
      z.string()
        .url()
        .max(2048),

    name:
      z.string()
        .trim()
        .max(240)
        .optional(),

    role:
      z.enum([
        "cover",
        "front",
        "back",
        "detail",
        "model",
        "packaging",
      ]),

    isCover:
      z.boolean()
        .optional(),

    order:
      z.coerce
        .number()
        .int()
        .min(0)
        .max(1000)
        .optional(),

    createdAt:
      z.string()
        .datetime({
          offset: true,
        })
        .optional(),
  })
  .strict();

const catalogVariantSchema =
  z.object({
    sku:
      z.string()
        .trim()
        .min(1)
        .max(100),

    barcode:
      z.string()
        .trim()
        .max(100)
        .optional(),

    colorName:
      z.string()
        .trim()
        .max(100)
        .optional(),

    colorCode:
      z.string()
        .trim()
        .max(80)
        .optional(),

    colorHex:
      z.string()
        .trim()
        .regex(
          /^#[0-9a-fA-F]{6}$/,
          "colorHex inválido",
        )
        .optional(),

    size:
      z.string()
        .trim()
        .max(50)
        .optional(),

    price:
      z.coerce
        .number()
        .positive()
        .optional(),

    physical:
      z.coerce
        .number()
        .int()
        .min(0)
        .max(1000000)
        .default(0),

    minimum:
      z.coerce
        .number()
        .int()
        .min(0)
        .max(1000000)
        .default(0),

    incoming:
      z.coerce
        .number()
        .int()
        .min(0)
        .max(1000000)
        .default(0),

    active:
      z.boolean()
        .default(true),

    images:
      z.array(
        catalogImageSchema,
      )
        .max(24)
        .default([]),
  })
  .strict();

const fullCatalogProductSchema =
  z.object({
    baseSku:
      z.string()
        .trim()
        .min(2)
        .max(80),

    name:
      z.string()
        .trim()
        .min(3)
        .max(160),

    audience:
      z.enum([
        "men",
        "women",
        "boys",
        "girls",
        "baby",
        "unisex",
      ]),

    category:
      z.string()
        .trim()
        .max(120)
        .optional(),

    subcategory:
      z.string()
        .trim()
        .max(120)
        .optional(),

    collection:
      z.string()
        .trim()
        .max(120)
        .optional(),

    season:
      z.string()
        .trim()
        .max(80)
        .optional(),

    brand:
      z.string()
        .trim()
        .max(120)
        .optional(),

    supplier:
      z.string()
        .trim()
        .max(160)
        .optional(),

    composition:
      z.string()
        .trim()
        .max(500)
        .optional(),

    description:
      z.string()
        .trim()
        .max(5000)
        .optional(),

    currency:
      z.literal("ARS"),

    price:
      z.coerce
        .number()
        .positive()
        .max(999999999999),

    tags:
      z.array(
        z.string()
          .trim()
          .min(1)
          .max(80),
      )
        .max(50)
        .default([]),

    active:
      z.boolean()
        .default(true),

    variants:
      z.array(
        catalogVariantSchema,
      )
        .min(1)
        .max(200),
  })
  .strict()
  .superRefine(
    (payload, context) => {
      const normalizedSkus =
        payload.variants.map(
          (variant) =>
            variant.sku
              .trim()
              .toUpperCase(),
        );

      if (
        new Set(normalizedSkus).size
        !== normalizedSkus.length
      ) {
        context.addIssue({
          code:
            "custom",
          path:
            ["variants"],
          message:
            "Existen SKU de variante duplicados",
        });
      }
    },
  );

function catalogErrorStatus(
  error: unknown,
): number {
  if (
    error instanceof ZodError
  ) {
    return 400;
  }

  const message =
    error instanceof Error
      ? error.message
      : "";

  if (
    message.includes(
      "CATALOG_BASE_SKU_EXISTS",
    )
    || message.includes(
      "CATALOG_VARIANT_SKU_EXISTS",
    )
    || message.includes(
      "CATALOG_IDEMPOTENCY_CONFLICT",
    )
  ) {
    return 409;
  }

  if (
    error instanceof SupabaseRpcError
    && error.status >= 500
  ) {
    return 500;
  }

  return 400;
}

export async function saveFullCatalogProduct(
  req: Request,
  res: Response,
) {
  try {
    const companyId =
      req.tenantContext
        ?.effectiveCompanyId;

    const actorId =
      req.accessActor
        ?.id;

    if (!companyId) {
      return res.status(400).json({
        ok: false,
        error:
          "COMPANY_CONTEXT_REQUIRED",
      });
    }

    if (!actorId) {
      return res.status(401).json({
        ok: false,
        error:
          "AUTHENTICATION_REQUIRED",
      });
    }

    const idempotencyHeader =
      req.get(
        "x-idempotency-key",
      )
      ?.trim()
      ?? "";

    if (
      idempotencyHeader.length < 16
      || idempotencyHeader.length > 200
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "CATALOG_IDEMPOTENCY_KEY_INVALID",
      });
    }

    const payload =
      fullCatalogProductSchema.parse(
        req.body,
      );

    const result =
      await createFullCatalogProduct({
        companyId,
        actorId,
        idempotencyKey:
          idempotencyHeader,
        payload,
      });

    return res.status(
      result.idempotentReplay
        ? 200
        : 201,
    ).json({
      ok: true,
      product:
        result,
    });
  } catch (error) {
    const status =
      catalogErrorStatus(
        error,
      );

    if (
      error instanceof ZodError
    ) {
      const details =
        error.issues
          .map(
            (issue) =>
              `${issue.path.join(".") || "payload"}: ${issue.message}`,
          )
          .join(" · ");

      console.error(
        "[CATALOG VALIDATION ERROR]",
        {
          requestId:
            req.requestContext
              ?.requestId
            ?? null,
          issues:
            error.issues,
        },
      );

      return res.status(status).json({
        ok: false,
        error:
          `CATALOG_VALIDATION_ERROR: ${details}`,
        issues:
          error.issues,
      });
    }

    console.error(
      "[FULL CATALOG PRODUCT ERROR]",
      {
        requestId:
          req.requestContext
            ?.requestId
          ?? null,

        companyId:
          req.tenantContext
            ?.effectiveCompanyId
          ?? null,

        actorId:
          req.accessActor
            ?.id
          ?? null,

        error:
          error instanceof Error
            ? {
                name:
                  error.name,
                message:
                  error.message,
              }
            : error,
      },
    );

    return res.status(status).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "CATALOG_PRODUCT_CREATE_FAILED",

      requestId:
        req.requestContext
          ?.requestId
        ?? null,
    });
  }
}


export async function uploadCatalogProductImage(
  req: Request,
  res: Response,
) {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "La imagen es obligatoria",
      });
    }

    const companyId =
      req.tenantContext
        ?.effectiveCompanyId;

    if (!companyId) {
      return res.status(400).json({
        ok: false,
        error:
          "COMPANY_CONTEXT_REQUIRED",
      });
    }

    const requestedBaseSku =
      String(req.body?.baseSku ?? "").trim();

    const colorCode =
      String(req.body?.colorCode ?? "").trim();

    const baseSku =
      requestedBaseSku
      || `draft-${colorCode || "product"}`;

    const role =
      String(req.body?.role ?? "cover") as
        | "cover"
        | "front"
        | "back"
        | "detail"
        | "model";

    const validRoles = [
      "cover",
      "front",
      "back",
      "detail",
      "model",
    ];

    if (!baseSku || !colorCode) {
      return res.status(400).json({
        ok: false,
        error:
          "baseSku y colorCode son obligatorios",
      });
    }

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        ok: false,
        error: "Rol de imagen inválido",
      });
    }

    console.log(
      "[CATALOG IMAGE UPLOAD START]",
      {
        companyId,
        baseSku,
        colorCode,
        role,
        mimetype:
          req.file.mimetype,
        size:
          req.file.size,
      },
    );

    const image =
      await uploadCatalogImage({
        companyId,
        baseSku,
        colorCode,
        role,
        file: {
          buffer: req.file.buffer,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
      });

    return res.status(201).json({
      ok: true,
      image,
    });
  } catch (error) {
    console.error(
      "[UPLOAD CATALOG IMAGE ERROR]",
      error,
    );

    return res.status(400).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo subir la imagen",
    });
  }
}
