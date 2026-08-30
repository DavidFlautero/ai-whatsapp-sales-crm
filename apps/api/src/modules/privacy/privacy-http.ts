import type {
  Request,
  Response,
} from "express";

import {
  ZodError,
} from "zod";

import {
  PrivacyCryptoError,
} from "./privacy-crypto.js";

import {
  PrivacyDomainError,
} from "./privacy-state-machine.js";

import {
  PrivacyRepositoryError,
} from "./privacy.repository.js";

import {
  type PrivacyServiceContext,
} from "./privacy-request.service.js";

export function getPrivacyHttpContext(
  request: Request,
): PrivacyServiceContext {
  const companyId =
    request.tenantContext
      ?.effectiveCompanyId;

  const actorId =
    request.accessActor
      ?.id;

  const correlationId =
    request.requestContext
      ?.requestId;

  if (
    !companyId
    || !actorId
    || !correlationId
  ) {
    throw new PrivacyDomainError({
      code:
        "PRIVACY_CONFIGURATION_ERROR",

      message:
        "El contexto de acceso no está disponible.",

      httpStatus:
        500,
    });
  }

  return {
    companyId,
    actorId,
    correlationId,
  };
}

export function respondPrivacyError(
  response: Response,
  error: unknown,
  requestId:
    string | null,
): boolean {
  if (
    error instanceof ZodError
  ) {
    response
      .status(400)
      .json({
        ok: false,
        error:
          "PRIVACY_VALIDATION_ERROR",
        issues:
          error.issues.map(
            (issue) => ({
              path:
                issue.path.join("."),
              message:
                issue.message,
            }),
          ),
        requestId,
      });

    return true;
  }

  if (
    error
      instanceof PrivacyDomainError
  ) {
    response
      .status(error.httpStatus)
      .json({
        ok: false,
        error:
          error.code,
        message:
          error.message,
        details:
          error.details,
        requestId,
      });

    return true;
  }

  if (
    error
      instanceof PrivacyCryptoError
  ) {
    response
      .status(400)
      .json({
        ok: false,
        error:
          "PRIVACY_IDENTIFIER_INVALID",
        message:
          error.message,
        requestId,
      });

    return true;
  }

  if (
    error
      instanceof PrivacyRepositoryError
  ) {
    const status =
      error.code
        === "PRIVACY_ROW_NOT_FOUND"
        ? 404
        : error.code
          === "PRIVACY_VERSION_CONFLICT"
          ? 409
          : 503;

    response
      .status(status)
      .json({
        ok: false,
        error:
          error.code,
        message:
          error.message,
        requestId,
      });

    return true;
  }

  return false;
}
