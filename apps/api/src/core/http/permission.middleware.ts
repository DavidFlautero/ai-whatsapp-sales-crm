import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  decideAccess,
} from "../authorization/authorization.service.js";

import type {
  AccessDecision,
} from "../authorization/authorization.types.js";

import type {
  Permission,
} from "../authorization/permission.catalog.js";

export type PermissionMode =
  | "enforce"
  | "shadow";

export type PermissionOptions = {
  mode?:
    PermissionMode;
};

function missingContext(
  response: Response,
) {
  return response
    .status(500)
    .json({
      ok: false,
      error:
        "ACCESS_CONTEXT_NOT_RESOLVED",
    });
}

function deny(
  response: Response,
  decision:
    AccessDecision,
  requestId:
    string | null,
) {
  return response
    .status(403)
    .json({
      ok: false,

      error:
        "INSUFFICIENT_PERMISSIONS",

      code:
        decision.code,

      permission:
        decision.permission,

      requestId,
    });
}

export function requirePermission(
  permission: Permission,
  options:
    PermissionOptions = {},
) {
  return (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    if (
      !request.accessActor
      || !request.tenantContext
    ) {
      return missingContext(
        response,
      );
    }

    const decision =
      decideAccess({
        actor:
          request.accessActor,

        tenant:
          request.tenantContext,

        permission,
      });

    request.accessDecision =
      decision;

    if (decision.allowed) {
      return next();
    }

    if (
      options.mode
      === "shadow"
    ) {
      return next();
    }

    return deny(
      response,
      decision,

      request
        .requestContext
        ?.requestId
      ?? null,
    );
  };
}

export function requireAnyPermission(
  permissions:
    readonly Permission[],

  options:
    PermissionOptions = {},
) {
  return (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    if (
      !request.accessActor
      || !request.tenantContext
    ) {
      return missingContext(
        response,
      );
    }

    if (
      permissions.length === 0
    ) {
      return response
        .status(500)
        .json({
          ok: false,
          error:
            "EMPTY_PERMISSION_SET",
        });
    }

    const decisions =
      permissions.map(
        (permission) =>
          decideAccess({
            actor:
              request.accessActor!,

            tenant:
              request.tenantContext!,

            permission,
          }),
      );

    const allowed =
      decisions.find(
        (decision) =>
          decision.allowed,
      );

    request.accessDecision =
      allowed
      ?? decisions[0];

    if (allowed) {
      return next();
    }

    if (
      options.mode
      === "shadow"
    ) {
      return next();
    }

    return deny(
      response,
      decisions[0],

      request
        .requestContext
        ?.requestId
      ?? null,
    );
  };
}
