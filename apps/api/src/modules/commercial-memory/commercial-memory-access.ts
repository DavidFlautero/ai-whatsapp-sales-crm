import type {
  Request,
  RequestHandler,
} from "express";

type AuthorizedTenant = {
  mode?: unknown;
  effectiveCompanyId?: unknown;
  actorCompanyId?: unknown;
  source?: unknown;
  superadminImpersonation?: unknown;
};

function resolveAuthorizedTenant(
  req: Request,
): AuthorizedTenant | null {
  const request = req as Request & {
    tenantContext?: unknown;
  };

  const value = request.tenantContext;

  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as AuthorizedTenant;
}

export function commercialCompanyGuard(
  expectedCompany: string,
): RequestHandler {
  return (req, res, next) => {
    if (
      process.env.CM_DASHBOARD_ENABLED !==
      "true"
    ) {
      return res.status(503).json({
        error:
          "COMMERCIAL_MEMORY_RELEASE_PENDING",
      });
    }

    if (!req.authUser) {
      return res.status(401).json({
        error:
          "AUTHENTICATION_REQUIRED",
      });
    }

    const tenant =
      resolveAuthorizedTenant(req);

    if (!tenant) {
      return res.status(403).json({
        error:
          "TENANT_CONTEXT_REQUIRED",
      });
    }

    // El middleware original ya validó
    // la sesión, empresa y posibles
    // selecciones de superadministrador.

    if (tenant.mode !== "company") {
      return res.status(403).json({
        error:
          "COMPANY_MODE_REQUIRED",
      });
    }

    const effectiveCompanyId =
      tenant.effectiveCompanyId;

    if (
      typeof effectiveCompanyId !== "string" ||
      effectiveCompanyId !== expectedCompany
    ) {
      return res.status(403).json({
        error:
          "COMPANY_SCOPE_MISMATCH",
      });
    }

    return next();
  };
}

export function authenticatedActor(
  req: Request,
): string | null {
  if (!req.authUser) {
    return null;
  }

  const user =
    req.authUser as unknown as
      Record<string, unknown>;

  const candidates = [
    user.id,
    user.userId,
    user.email,
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === "string" &&
      candidate.trim().length >= 3
    ) {
      return candidate.trim().slice(
        0,
        150,
      );
    }
  }

  return null;
}
