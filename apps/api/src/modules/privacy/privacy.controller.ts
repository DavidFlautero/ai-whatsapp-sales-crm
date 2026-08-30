import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  privacyConsentInputSchema,
  privacyCreateRequestSchema,
  privacyIdParamSchema,
  privacyLegalHoldInputSchema,
  privacyListQuerySchema,
  privacyPolicyInputSchema,
  privacyTransitionSchema,
  privacyVerifyIdentitySchema,
} from "./privacy.schema.js";

import {
  createPrivacyRequestService,
  getPrivacyRequestDetailService,
  listPrivacyRequestsService,
} from "./privacy-request.service.js";

import {
  transitionPrivacyRequestService,
  verifyPrivacyIdentityService,
} from "./privacy-workflow.service.js";

import {
  createPrivacyLegalHoldService,
  createPrivacyPolicyDraftService,
  getActivePrivacyPolicyService,
  recordPrivacyConsentService,
} from "./privacy-governance.service.js";

import {
  getPrivacyHttpContext,
  respondPrivacyError,
} from "./privacy-http.js";

async function handle(
  request: Request,
  response: Response,
  next: NextFunction,
  operation:
    () => Promise<unknown>,
  successStatus:
    number = 200,
): Promise<void> {
  try {
    const result =
      await operation();

    response
      .status(successStatus)
      .json({
        ok: true,
        data:
          result,
        requestId:
          request.requestContext
            ?.requestId
          ?? null,
      });
  } catch (error) {
    const handled =
      respondPrivacyError(
        response,
        error,
        request.requestContext
          ?.requestId
        ?? null,
      );

    if (!handled) {
      next(error);
    }
  }
}

export function createPrivacyRequestController(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  void handle(
    request,
    response,
    next,
    async () =>
      createPrivacyRequestService({
        context:
          getPrivacyHttpContext(
            request,
          ),
        data:
          privacyCreateRequestSchema
            .parse(request.body),
      }),
    201,
  );
}

export function listPrivacyRequestsController(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  void handle(
    request,
    response,
    next,
    async () =>
      listPrivacyRequestsService(
        getPrivacyHttpContext(
          request,
        ),
        privacyListQuerySchema
          .parse(request.query),
      ),
  );
}

export function getPrivacyRequestController(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  void handle(
    request,
    response,
    next,
    async () => {
      const params =
        privacyIdParamSchema
          .parse(request.params);

      return getPrivacyRequestDetailService(
        getPrivacyHttpContext(
          request,
        ),
        params.id,
      );
    },
  );
}

export function verifyPrivacyRequestController(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  void handle(
    request,
    response,
    next,
    async () => {
      const params =
        privacyIdParamSchema
          .parse(request.params);

      return verifyPrivacyIdentityService({
        context:
          getPrivacyHttpContext(
            request,
          ),
        requestId:
          params.id,
        data:
          privacyVerifyIdentitySchema
            .parse(request.body),
      });
    },
  );
}

export function transitionPrivacyRequestController(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  void handle(
    request,
    response,
    next,
    async () => {
      const params =
        privacyIdParamSchema
          .parse(request.params);

      return transitionPrivacyRequestService({
        context:
          getPrivacyHttpContext(
            request,
          ),
        requestId:
          params.id,
        data:
          privacyTransitionSchema
            .parse(request.body),
      });
    },
  );
}

export function executePrivacyErasureController(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  void handle(
    request,
    response,
    next,
    async () => {
      const params =
        privacyIdParamSchema
          .parse(request.params);

      const data =
        privacyTransitionSchema
          .parse(request.body);

      if (
        data.target_status
        !== "processing"
      ) {
        throw new Error(
          "ERASURE_TARGET_MUST_BE_PROCESSING",
        );
      }

      const detail =
        await getPrivacyRequestDetailService(
          getPrivacyHttpContext(
            request,
          ),
          params.id,
        );

      if (
        detail.request.request_type
        !== "erasure"
      ) {
        throw new Error(
          "REQUEST_IS_NOT_ERASURE",
        );
      }

      return transitionPrivacyRequestService({
        context:
          getPrivacyHttpContext(
            request,
          ),
        requestId:
          params.id,
        data,
      });
    },
  );
}

export function getActivePrivacyPolicyController(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  void handle(
    request,
    response,
    next,
    async () =>
      getActivePrivacyPolicyService(
        getPrivacyHttpContext(
          request,
        ),
      ),
  );
}

export function createPrivacyPolicyDraftController(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  void handle(
    request,
    response,
    next,
    async () =>
      createPrivacyPolicyDraftService({
        context:
          getPrivacyHttpContext(
            request,
          ),
        data:
          privacyPolicyInputSchema
            .parse(request.body),
      }),
    201,
  );
}

export function recordPrivacyConsentController(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  void handle(
    request,
    response,
    next,
    async () =>
      recordPrivacyConsentService({
        context:
          getPrivacyHttpContext(
            request,
          ),
        data:
          privacyConsentInputSchema
            .parse(request.body),
      }),
    201,
  );
}

export function createPrivacyLegalHoldController(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  void handle(
    request,
    response,
    next,
    async () =>
      createPrivacyLegalHoldService({
        context:
          getPrivacyHttpContext(
            request,
          ),
        data:
          privacyLegalHoldInputSchema
            .parse(request.body),
      }),
    201,
  );
}
