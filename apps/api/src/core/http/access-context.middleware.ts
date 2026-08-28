import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  toAccessActor,
  AuthActorAdapterError,
} from "../auth-adapter/index.js";

import {
  resolveTenantContext,
  TenantContextError,
  type TenantContext,
  type TenantMode,
} from "../tenancy/index.js";

import {
  createRequestContext,
  type RequestContext,
  type RequestSource,
} from "../request-context/index.js";

import type {
  AccessActor,
  AccessDecision,
} from "../authorization/index.js";

declare global {
  namespace Express {
    interface Request {
      accessActor?:
        AccessActor;

      tenantContext?:
        TenantContext;

      requestContext?:
        RequestContext;

      accessDecision?:
        AccessDecision;
    }
  }
}

export type AccessContextOptions = {
  mode:
    TenantMode
    | (
        (
          request: Request,
        ) => TenantMode
      );

  source?:
    RequestSource;

  companyHeader?:
    string;

  routeCompanyParam?:
    string;
};

function readHeader(
  request: Request,
  name: string,
): string | null {
  const value =
    request.headers[
      name.toLowerCase()
    ];

  if (
    typeof value === "string"
  ) {
    return value;
  }

  if (
    Array.isArray(value)
  ) {
    return value[0]
      ?? null;
  }

  return null;
}


function readRouteParam(
  request: Request,
  name: string,
): string | null {
  const value =
    request.params[name];

  if (
    typeof value === "string"
  ) {
    return value;
  }

  if (
    Array.isArray(value)
  ) {
    return value[0]
      ?? null;
  }

  return null;
}

function tenantErrorStatus(
  code:
    TenantContextError["code"],
): number {
  switch (code) {
    case "PLATFORM_ACCESS_DENIED":
    case "COMPANY_CONTEXT_MISMATCH":
      return 403;

    case "INVALID_COMPANY_ID":
    case "CONFLICTING_COMPANY_CONTEXT":
    case "COMPANY_CONTEXT_REQUIRED":
      return 400;

    default:
      return 400;
  }
}

export function resolveAccessContext(
  options:
    AccessContextOptions,
) {
  return (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    if (!request.authUser) {
      return response
        .status(401)
        .json({
          ok: false,
          error:
            "AUTHENTICATION_REQUIRED",
        });
    }

    try {
      const actor =
        toAccessActor(
          request.authUser,
        );

      const mode =
        typeof options.mode
          === "function"
          ? options.mode(
              request,
            )
          : options.mode;

      const companyHeader =
        options.companyHeader
        ?? "x-company-id";

      const routeParam =
        options.routeCompanyParam
        ?? "companyId";

      const tenant =
        resolveTenantContext({
          actor,
          mode,

          headerCompanyId:
            readHeader(
              request,
              companyHeader,
            ),

          routeCompanyId:
            readRouteParam(
              request,
              routeParam,
            ),
        });

      const requestContext =
        createRequestContext({
          actor,
          tenant,

          source:
            options.source
            ?? "dashboard",

          requestId:
            readHeader(
              request,
              "x-request-id",
            ),

          ipAddress:
            request.ip
            || request.socket
              .remoteAddress
            || null,

          userAgent:
            request.get(
              "user-agent",
            )
            ?? null,
        });

      request.accessActor =
        actor;

      request.tenantContext =
        tenant;

      request.requestContext =
        requestContext;

      response.setHeader(
        "x-request-id",
        requestContext.requestId,
      );

      return next();
    } catch (error) {
      if (
        error
          instanceof TenantContextError
      ) {
        return response
          .status(
            tenantErrorStatus(
              error.code,
            ),
          )
          .json({
            ok: false,
            error:
              error.code,

            requestId:
              request
                .requestContext
                ?.requestId
              ?? null,
          });
      }

      if (
        error
          instanceof AuthActorAdapterError
      ) {
        return response
          .status(403)
          .json({
            ok: false,
            error:
              error.code,
          });
      }

      return next(error);
    }
  };
}
