import {
  Router,
  type Request,
  type Response,
} from "express";

import {
  z,
  ZodError,
} from "zod";

import {
  requirePermission,
} from "../../core/http/permission.middleware.js";

import {
  approvePaymentSubmission,
  listPaymentSubmissions,
  rejectPaymentSubmission,
} from "../../services/payments/payment-submission-admin.service.js";

export const adminPaymentSubmissionsRoutes =
  Router();

const uuidSchema =
  z.string().uuid();

const approveSchema =
  z.object({
    amount:
      z.coerce
        .number()
        .positive(),
  });

const rejectSchema =
  z.object({
    reason:
      z.string()
        .trim()
        .min(1)
        .max(1000),
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

function actor(
  request: Request,
) {
  if (!request.authUser) {
    throw new Error(
      "AUTHENTICATED_USER_NOT_FOUND",
    );
  }

  return {
    id:
      request.authUser.id,

    name:
      request.authUser.name,

    email:
      request.authUser.email,

    role:
      request.authUser.role,
  };
}

function handleError(
  error: unknown,
  response: Response,
) {
  if (
    error instanceof ZodError
  ) {
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

  console.error(
    "[PAYMENT SUBMISSION ADMIN ERROR]",
    error,
  );

  return response
    .status(500)
    .json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "PAYMENT_SUBMISSION_OPERATION_FAILED",
    });
}

adminPaymentSubmissionsRoutes.get(
  "/payment-submissions",

  requirePermission(
    "payments.read",
  ),

  async (
    request: Request,
    response: Response,
  ) => {
    try {
      const status =
        typeof request.query.status
          === "string"
        && request.query.status.trim()
          ? request.query.status.trim()
          : "pending_review";

      const submissions =
        await listPaymentSubmissions(
          companyId(request),
          status,
        );

      return response.json({
        ok: true,
        submissions,
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);

adminPaymentSubmissionsRoutes.post(
  "/payment-submissions/:submissionId/approve",

  requirePermission(
    "payments.confirm",
  ),

  async (
    request: Request,
    response: Response,
  ) => {
    try {
      const submissionId =
        uuidSchema.parse(
          request.params.submissionId,
        );

      const input =
        approveSchema.parse(
          request.body,
        );

      const result =
        await approvePaymentSubmission(
          companyId(request),
          submissionId,
          input.amount,
          actor(request),
        );

      return response.json({
        ok: true,
        result,
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);

adminPaymentSubmissionsRoutes.post(
  "/payment-submissions/:submissionId/reject",

  requirePermission(
    "payments.confirm",
  ),

  async (
    request: Request,
    response: Response,
  ) => {
    try {
      const submissionId =
        uuidSchema.parse(
          request.params.submissionId,
        );

      const input =
        rejectSchema.parse(
          request.body,
        );

      const result =
        await rejectPaymentSubmission(
          companyId(request),
          submissionId,
          input.reason,
          actor(request),
        );

      return response.json({
        ok: true,
        result,
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);
