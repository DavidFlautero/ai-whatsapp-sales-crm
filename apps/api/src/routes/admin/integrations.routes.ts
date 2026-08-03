import {
  Router,
} from "express";

import {
  z,
  ZodError,
} from "zod";

import type {
  Request,
  Response,
} from "express";

import {
  requireRoles,
} from "../../middlewares/auth.middleware.js";

import {
  disconnectIntegration,
  getPublicIntegrationConfig,
  saveIntegrationConfig,
  type IntegrationProvider,
} from "../../services/integrations/integration-secrets.repository.js";

import {
  testIntegration,
} from "../../services/integrations/integration-test.service.js";

export const adminIntegrationsRoutes =
  Router();

const providerSchema =
  z.enum([
    "whatsapp",
    "anthropic",
    "groq",
    "supabase",
    "ninox",
  ]);

const valuesSchema =
  z.record(
    z.string(),
    z.union([
      z
        .string()
        .max(5000),

      z.boolean(),
      z.null(),
    ]),
  );

const payloadSchema =
  z.object({
    provider:
      providerSchema,

    values:
      valuesSchema
        .optional()
        .default({}),
  });

function handleError(
  error: unknown,
  res: Response,
) {
  if (
    error instanceof
      ZodError
  ) {
    return res
      .status(400)
      .json({
        ok: false,

        error:
          "VALIDATION_ERROR",

        message:
          error.issues[0]
            ?.message ||
          "Datos inválidos.",

        issues:
          error.issues,
      });
  }

  console.error(
    "[ADMIN INTEGRATIONS]",
    error,
  );

  return res
    .status(500)
    .json({
      ok: false,

      error:
        "INTEGRATIONS_ERROR",

      message:
        "No fue posible completar la operación.",
    });
}

function actor(
  req: Request,
) {
  if (!req.authUser) {
    throw new Error(
      "Missing authenticated user",
    );
  }

  return {
    id:
      req.authUser.id,

    email:
      req.authUser.email,
  };
}

adminIntegrationsRoutes.get(
  "/config",

  requireRoles(
    "superadmin",
    "owner",
    "admin",
    "supervisor",
  ),

  async (
    _req: Request,
    res: Response,
  ) => {
    try {
      const data =
        await getPublicIntegrationConfig();

      return res.json({
        ok: true,
        data,
      });
    } catch (error) {
      return handleError(
        error,
        res,
      );
    }
  },
);

adminIntegrationsRoutes.post(
  "/test",

  requireRoles(
    "superadmin",
    "owner",
    "admin",
  ),

  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const input =
        payloadSchema.parse(
          req.body,
        );

      const data =
        await testIntegration(
          input.provider,
          input.values,
        );

      return res.json({
        ok: true,
        data,
      });
    } catch (error) {
      return handleError(
        error,
        res,
      );
    }
  },
);

adminIntegrationsRoutes.put(
  "/config",

  requireRoles(
    "superadmin",
    "owner",
    "admin",
  ),

  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const input =
        payloadSchema.parse(
          req.body,
        );

      const data =
        await saveIntegrationConfig(
          input.provider,
          input.values,
          actor(req),
        );

      return res.json({
        ok: true,
        data,
      });
    } catch (error) {
      return handleError(
        error,
        res,
      );
    }
  },
);

adminIntegrationsRoutes.delete(
  "/:provider",

  requireRoles(
    "superadmin",
    "owner",
    "admin",
  ),

  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const provider =
        providerSchema.parse(
          req.params.provider,
        ) as IntegrationProvider;

      const data =
        await disconnectIntegration(
          provider,
          actor(req),
        );

      return res.json({
        ok: true,
        data,
      });
    } catch (error) {
      return handleError(
        error,
        res,
      );
    }
  },
);
