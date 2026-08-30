import {
  type PrivacyRequestRecord,
  type PrivacyRequestStatus,
  type PrivacyRequestTransitionContext,
  type PrivacyRequestType,
} from "./privacy.types.js";

export const PRIVACY_ERROR_CODES = [
  "PRIVACY_REQUEST_NOT_FOUND",
  "PRIVACY_INVALID_TRANSITION",
  "PRIVACY_IDENTITY_NOT_VERIFIED",
  "PRIVACY_APPROVAL_REQUIRED",
  "PRIVACY_SEPARATION_OF_DUTIES",
  "PRIVACY_LEGAL_HOLD_ACTIVE",
  "PRIVACY_VERSION_CONFLICT",
  "PRIVACY_REQUEST_FINAL",
  "PRIVACY_POLICY_NOT_FOUND",
  "PRIVACY_CONFIGURATION_ERROR",
] as const;

export type PrivacyErrorCode =
  (typeof PRIVACY_ERROR_CODES)[number];

export class PrivacyDomainError
  extends Error {
  readonly code:
    PrivacyErrorCode;

  readonly httpStatus:
    number;

  readonly details:
    Readonly<
      Record<string, unknown>
    >;

  constructor(input: {
    code: PrivacyErrorCode;
    message: string;
    httpStatus?: number;
    details?: Record<string, unknown>;
  }) {
    super(input.message);

    this.name =
      "PrivacyDomainError";

    this.code =
      input.code;

    this.httpStatus =
      input.httpStatus
      ?? 409;

    this.details =
      Object.freeze({
        ...(input.details ?? {}),
      });

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

export const PRIVACY_ALLOWED_TRANSITIONS:
  Readonly<
    Record<
      PrivacyRequestStatus,
      readonly PrivacyRequestStatus[]
    >
  > = {
    received: [
      "identity_pending",
      "cancelled",
    ],

    identity_pending: [
      "verified",
      "rejected",
      "cancelled",
      "failed",
    ],

    verified: [
      "approved",
      "processing",
      "rejected",
      "cancelled",
    ],

    approved: [
      "processing",
      "cancelled",
    ],

    processing: [
      "partially_fulfilled",
      "fulfilled",
      "failed",
    ],

    partially_fulfilled: [
      "processing",
      "fulfilled",
      "failed",
    ],

    fulfilled: [],
    rejected: [],
    cancelled: [],
    failed: [],
  };

const finalStatuses =
  new Set<PrivacyRequestStatus>([
    "fulfilled",
    "rejected",
    "cancelled",
    "failed",
  ]);

const approvalRequiredTypes =
  new Set<PrivacyRequestType>([
    "export",
    "erasure",
  ]);

export function isFinalPrivacyStatus(
  status: PrivacyRequestStatus,
): boolean {
  return finalStatuses.has(
    status,
  );
}

export function privacyRequestRequiresApproval(
  requestType: PrivacyRequestType,
): boolean {
  return approvalRequiredTypes.has(
    requestType,
  );
}

export function getAllowedPrivacyTransitions(
  status: PrivacyRequestStatus,
): readonly PrivacyRequestStatus[] {
  return PRIVACY_ALLOWED_TRANSITIONS[
    status
  ];
}

export function canTransitionPrivacyRequest(
  from: PrivacyRequestStatus,
  to: PrivacyRequestStatus,
): boolean {
  return getAllowedPrivacyTransitions(
    from,
  ).includes(
    to,
  );
}

function assertRequestNotFinal(
  request: PrivacyRequestRecord,
): void {
  if (
    isFinalPrivacyStatus(
      request.status,
    )
  ) {
    throw new PrivacyDomainError({
      code:
        "PRIVACY_REQUEST_FINAL",

      message:
        "La solicitud ya se encuentra cerrada.",

      details: {
        status:
          request.status,
      },
    });
  }
}

function assertIdentityRequirement(
  context:
    PrivacyRequestTransitionContext,
): void {
  const target =
    context.targetStatus;

  const requiresIdentity =
    target === "verified"
    || target === "approved"
    || target === "processing";

  if (!requiresIdentity) {
    return;
  }

  const identityStatus =
    context.request
      .identity_verification_status;

  if (
    identityStatus !== "verified"
    && identityStatus !== "waived"
  ) {
    throw new PrivacyDomainError({
      code:
        "PRIVACY_IDENTITY_NOT_VERIFIED",

      message:
        "La identidad debe estar verificada antes de continuar.",

      details: {
        identityStatus,
        target,
      },
    });
  }
}

function assertApprovalRequirement(
  context:
    PrivacyRequestTransitionContext,
): void {
  const request =
    context.request;

  if (
    context.targetStatus !== "processing"
    || !privacyRequestRequiresApproval(
      request.request_type,
    )
  ) {
    return;
  }

  if (
    !request.approved_at
    || !request.approved_by_actor_id
  ) {
    throw new PrivacyDomainError({
      code:
        "PRIVACY_APPROVAL_REQUIRED",

      message:
        "La solicitud requiere aprobación previa.",

      details: {
        requestType:
          request.request_type,
      },
    });
  }

  if (
    request.approved_by_actor_id
    === context.actorId
  ) {
    throw new PrivacyDomainError({
      code:
        "PRIVACY_SEPARATION_OF_DUTIES",

      message:
        "Quien aprueba no puede ejecutar la operación sensible.",

      details: {
        approvedBy:
          request.approved_by_actor_id,
      },
    });
  }
}

function assertApprovalSeparation(
  context:
    PrivacyRequestTransitionContext,
): void {
  if (
    context.targetStatus !== "approved"
  ) {
    return;
  }

  const verifiedBy =
    context.request
      .verified_by_actor_id;

  if (
    verifiedBy
    && verifiedBy
      === context.actorId
  ) {
    throw new PrivacyDomainError({
      code:
        "PRIVACY_SEPARATION_OF_DUTIES",

      message:
        "Quien verifica la identidad no puede aprobar la misma solicitud.",

      details: {
        verifiedBy,
      },
    });
  }
}

function assertLegalHold(
  context:
    PrivacyRequestTransitionContext,
): void {
  if (
    context.request.request_type
      !== "erasure"
    || context.targetStatus
      !== "processing"
  ) {
    return;
  }

  if (
    context.legalHoldActive
    || context.request
      .legal_hold_detected
  ) {
    throw new PrivacyDomainError({
      code:
        "PRIVACY_LEGAL_HOLD_ACTIVE",

      message:
        "La supresión está bloqueada por una obligación de conservación.",

      details: {
        requestId:
          context.request.id,
      },
    });
  }
}

export function assertPrivacyTransition(
  context:
    PrivacyRequestTransitionContext,
): void {
  assertRequestNotFinal(
    context.request,
  );

  if (
    !canTransitionPrivacyRequest(
      context.request.status,
      context.targetStatus,
    )
  ) {
    throw new PrivacyDomainError({
      code:
        "PRIVACY_INVALID_TRANSITION",

      message:
        "La transición solicitada no está permitida.",

      details: {
        from:
          context.request.status,

        to:
          context.targetStatus,
      },
    });
  }

  assertIdentityRequirement(
    context,
  );

  assertApprovalSeparation(
    context,
  );

  assertApprovalRequirement(
    context,
  );

  assertLegalHold(
    context,
  );
}

export interface BuildPrivacyPatchInput
  extends PrivacyRequestTransitionContext {
  now?: string;
  decisionCode?: string | null;
  decisionNotes?: string | null;
}

export function buildPrivacyTransitionPatch(
  input: BuildPrivacyPatchInput,
): Partial<PrivacyRequestRecord> {
  assertPrivacyTransition(
    input,
  );

  const now =
    input.now
    ?? new Date().toISOString();

  const patch:
    Partial<PrivacyRequestRecord> = {
      status:
        input.targetStatus,

      version:
        input.request.version + 1,

      updated_at:
        now,
    };

  if (
    input.targetStatus
    === "verified"
  ) {
    patch.verified_at =
      now;

    patch.verified_by_actor_id =
      input.actorId;
  }

  if (
    input.targetStatus
    === "approved"
  ) {
    patch.approved_at =
      now;

    patch.approved_by_actor_id =
      input.actorId;
  }

  if (
    input.targetStatus
    === "processing"
  ) {
    patch.execution_started_at =
      input.request
        .execution_started_at
      ?? now;

    patch.executed_by_actor_id =
      input.actorId;

    patch.completed_at =
      null;
  }

  if (
    isFinalPrivacyStatus(
      input.targetStatus,
    )
    || input.targetStatus
      === "partially_fulfilled"
  ) {
    patch.completed_at =
      now;
  }

  if (
    input.decisionCode
    !== undefined
  ) {
    patch.decision_code =
      input.decisionCode;
  }

  if (
    input.decisionNotes
    !== undefined
  ) {
    patch.decision_notes =
      input.decisionNotes;
  }

  return patch;
}
