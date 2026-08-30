import {
  Router,
  type RequestHandler,
} from "express";

import {
  requirePermission,
} from "../../core/http/permission.middleware.js";

import * as privacyControllers
  from "./privacy.controller.js";

function resolveController(
  name: string,
): RequestHandler {
  const registry =
    privacyControllers as unknown as
      Record<string, unknown>;

  const candidate =
    registry[name];

  if (
    typeof candidate
    !== "function"
  ) {
    throw new Error(
      `PRIVACY_CONTROLLER_MISSING:${name}`,
    );
  }

  return candidate as
    RequestHandler;
}

function forceTargetStatus(
  handler: RequestHandler,
  targetStatus:
    "approved"
    | "processing",
): RequestHandler {
  return (
    request,
    response,
    next,
  ) => {
    const currentBody =
      typeof request.body
        === "object"
      && request.body !== null
      && !Array.isArray(
        request.body,
      )
        ? request.body as
            Record<string, unknown>
        : {};

    request.body = {
      ...currentBody,

      status:
        targetStatus,

      target_status:
        targetStatus,

      targetStatus,
    };

    return handler(
      request,
      response,
      next,
    );
  };
}

const createRequestController =
  resolveController(
    "createPrivacyRequestController",
  );

const listRequestsController =
  resolveController(
    "listPrivacyRequestsController",
  );

const requestDetailController =
  resolveController(
    "getPrivacyRequestController",
  );

const verifyIdentityController =
  resolveController(
    "verifyPrivacyRequestController",
  );

const transitionController =
  resolveController(
    "transitionPrivacyRequestController",
  );

const approveController =
  forceTargetStatus(
    transitionController,
    "approved",
  );

const erasureController =
  resolveController(
    "executePrivacyErasureController",
  );

const getPolicyController =
  resolveController(
    "getActivePrivacyPolicyController",
  );

const createPolicyController =
  resolveController(
    "createPrivacyPolicyDraftController",
  );

const consentController =
  resolveController(
    "recordPrivacyConsentController",
  );

const legalHoldController =
  resolveController(
    "createPrivacyLegalHoldController",
  );

export const privacyRoutes =
  Router();

privacyRoutes.get(
  "/requests",
  requirePermission(
    "privacy.requests.read",
  ),
  listRequestsController,
);

privacyRoutes.post(
  "/requests",
  requirePermission(
    "privacy.requests.manage",
  ),
  createRequestController,
);

privacyRoutes.get(
  "/requests/:requestId",
  requirePermission(
    "privacy.requests.read",
  ),
  requestDetailController,
);

privacyRoutes.post(
  "/requests/:requestId/verify",
  requirePermission(
    "privacy.requests.verify",
  ),
  verifyIdentityController,
);

privacyRoutes.post(
  "/requests/:requestId/transition",
  requirePermission(
    "privacy.requests.manage",
  ),
  transitionController,
);

privacyRoutes.post(
  "/requests/:requestId/approve",
  requirePermission(
    "privacy.requests.approve",
  ),
  approveController,
);

privacyRoutes.post(
  "/requests/:requestId/authorize-erasure",
  requirePermission(
    "privacy.erasure.execute",
  ),
  erasureController,
);

privacyRoutes.get(
  "/policy",
  requirePermission(
    "privacy.policies.read",
  ),
  getPolicyController,
);

privacyRoutes.post(
  "/policy",
  requirePermission(
    "privacy.policies.manage",
  ),
  createPolicyController,
);

privacyRoutes.post(
  "/consents",
  requirePermission(
    "privacy.consents.manage",
  ),
  consentController,
);

privacyRoutes.post(
  "/legal-holds",
  requirePermission(
    "privacy.requests.approve",
  ),
  legalHoldController,
);
