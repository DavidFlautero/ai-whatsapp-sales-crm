import type {
  NextFunction,
  Request,
  Response,
} from "express";

export type AccessObservationOptions = {
  label: string;
};

export function observeAccessDecision(
  options: AccessObservationOptions,
) {
  return (
    request: Request,
    _response: Response,
    next: NextFunction,
  ) => {
    const decision =
      request.accessDecision;

    const context =
      request.requestContext;

    if (decision) {
      console.info(
        "[access-shadow]",
        JSON.stringify({
          occurredAt:
            new Date().toISOString(),

          label:
            options.label,

          requestId:
            context?.requestId
            ?? null,

          method:
            request.method,

          path:
            request.originalUrl
            ?? request.url,

          actorId:
            decision.actorId,

          role:
            decision.role,

          companyId:
            decision.effectiveCompanyId,

          permission:
            decision.permission,

          allowed:
            decision.allowed,

          code:
            decision.code,
        }),
      );
    }

    return next();
  };
}
