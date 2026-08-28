import type {
  Request,
  Response,
} from "express";

import {
  ZodError,
} from "zod";

import {
  VoiceDomainError,
} from "./voice-state-machine.js";

const badRequestCodes =
  new Set([
    "INVALID_CONTACT_PHONE",
    "INVALID_TRANSCRIPT_TIMING",
    "COMPANY_CONTEXT_REQUIRED",
  ]);

const notFoundCodes =
  new Set([
    "VOICE_CALL_NOT_FOUND",
    "VOICE_ROUTE_NOT_FOUND",
  ]);

export function voiceCompanyId(
  request: Request,
): string {
  const companyId =
    request.tenantContext
      ?.effectiveCompanyId;

  if (!companyId) {
    throw new VoiceDomainError(
      "COMPANY_CONTEXT_REQUIRED",
      "Se requiere una empresa activa.",
    );
  }

  return companyId;
}

export function voiceActorId(
  request: Request,
): string {
  return (
    request.accessActor?.id
    ?? "system"
  );
}

export function respondVoiceError(
  error: unknown,
  response: Response,
) {
  if (error instanceof ZodError) {
    return response
      .status(400)
      .json({
        ok: false,
        error:
          "VALIDATION_ERROR",
        issues:
          error.issues,
      });
  }

  if (
    error instanceof VoiceDomainError
  ) {
    const status =
      notFoundCodes.has(error.code)
        ? 404
        : badRequestCodes.has(error.code)
          ? 400
          : 409;

    return response
      .status(status)
      .json({
        ok: false,
        error:
          error.code,
        message:
          error.message,
      });
  }

  throw error;
}
