import {
  insertPrivacyRow,
  patchPrivacyRows,
  selectPrivacyRow,
  selectPrivacyRows,
  type PrivacyApplicationRow,
} from "./privacy-application.store.js";

export const PRIVACY_WORKFLOW_STATUSES = [
  "received",
  "verified",
  "approved",
  "processing",
  "partially_fulfilled",
  "completed",
  "rejected",
  "cancelled",
] as const;

export type PrivacyRequestStatus =
  (typeof PRIVACY_WORKFLOW_STATUSES)[number];

const PRIVACY_REQUEST_STATUSES =
  PRIVACY_WORKFLOW_STATUSES;

export interface PrivacyWorkflowContext {
  companyId: string;
  actorId: string;
  actorRole: string;
  correlationId: string;
  reason?: string | null;
}

export interface PrivacyTransitionInput
  extends PrivacyWorkflowContext {
  requestId: string;
  targetStatus: PrivacyRequestStatus;
  expectedVersion: number;
  metadata?: Record<string, unknown>;
}

export class PrivacyWorkflowError
  extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    code: string,
    message: string,
    status = 409,
  ) {
    super(message);
    this.name =
      "PrivacyWorkflowError";
    this.code = code;
    this.status = status;
  }
}

const TERMINAL_STATUSES:
  ReadonlySet<PrivacyRequestStatus> =
    new Set([
      "completed",
      "rejected",
      "cancelled",
    ]);

const TRANSITIONS:
  Readonly<
    Record<
      PrivacyRequestStatus,
      readonly PrivacyRequestStatus[]
    >
  > = {
    received: [
      "verified",
      "rejected",
      "cancelled",
    ],
    verified: [
      "approved",
      "rejected",
      "cancelled",
    ],
    approved: [
      "processing",
      "rejected",
      "cancelled",
    ],
    processing: [
      "partially_fulfilled",
      "completed",
      "rejected",
    ],
    partially_fulfilled: [
      "processing",
      "completed",
      "rejected",
    ],
    completed: [],
    rejected: [],
    cancelled: [],
  };

function readString(
  row: PrivacyApplicationRow,
  field: string,
): string {
  const value =
    row[field];

  if (typeof value !== "string") {
    throw new PrivacyWorkflowError(
      "PRIVACY_INVALID_REQUEST_ROW",
      `El campo ${field} es inválido.`,
      500,
    );
  }

  return value;
}

function readVersion(
  row: PrivacyApplicationRow,
): number {
  const value =
    row.version;

  if (
    typeof value !== "number"
    || !Number.isInteger(value)
    || value < 1
  ) {
    throw new PrivacyWorkflowError(
      "PRIVACY_INVALID_REQUEST_VERSION",
      "La versión de la solicitud es inválida.",
      500,
    );
  }

  return value;
}

function readStatus(
  row: PrivacyApplicationRow,
): PrivacyRequestStatus {
  const value =
    row.status;

  if (
    typeof value !== "string"
    || !PRIVACY_REQUEST_STATUSES
      .includes(
        value as PrivacyRequestStatus,
      )
  ) {
    throw new PrivacyWorkflowError(
      "PRIVACY_INVALID_REQUEST_STATUS",
      "El estado de la solicitud es inválido.",
      500,
    );
  }

  return value as PrivacyRequestStatus;
}

function cleanMetadata(
  input:
    Record<string, unknown> = {},
): Record<string, unknown> {
  const output:
    Record<string, unknown> = {};

  for (
    const [key, value]
    of Object.entries(input)
      .slice(0, 30)
  ) {
    if (
      /(token|secret|password|phone|email|cookie)/i
        .test(key)
    ) {
      continue;
    }

    if (
      value === null
      || typeof value === "boolean"
      || typeof value === "number"
    ) {
      output[key] = value;
    } else if (
      typeof value === "string"
    ) {
      output[key] =
        value.slice(0, 500);
    }
  }

  return output;
}

async function loadRequest(
  companyId: string,
  requestId: string,
): Promise<PrivacyApplicationRow> {
  const request =
    await selectPrivacyRow(
      "privacy_requests",
      companyId,
      {
        filters: [
          {
            column: "id",
            value: requestId,
          },
        ],
      },
    );

  if (!request) {
    throw new PrivacyWorkflowError(
      "PRIVACY_REQUEST_NOT_FOUND",
      "La solicitud no existe.",
      404,
    );
  }

  return request;
}

async function assertNoLegalHold(
  companyId: string,
  request: PrivacyApplicationRow,
): Promise<void> {
  const subjectId =
    readString(
      request,
      "subject_id",
    );

  const holds =
    await selectPrivacyRows(
      "privacy_legal_holds",
      companyId,
      {
        filters: [
          {
            column: "subject_id",
            value: subjectId,
          },
          {
            column: "status",
            value: "active",
          },
        ],
        limit: 1,
      },
    );

  if (holds.length > 0) {
    throw new PrivacyWorkflowError(
      "PRIVACY_ACTIVE_LEGAL_HOLD",
      "La solicitud está bloqueada por conservación legal.",
      423,
    );
  }
}

function transitionPatch(
  request: PrivacyApplicationRow,
  target: PrivacyRequestStatus,
  context: PrivacyWorkflowContext,
): PrivacyApplicationRow {
  const now =
    new Date().toISOString();

  const patch:
    PrivacyApplicationRow = {
      status: target,
      version:
        readVersion(request) + 1,
      updated_at: now,
    };

  if (target === "verified") {
    patch.identity_verification_status =
      "verified";
    patch.verified_at = now;
    patch.verified_by_actor_id =
      context.actorId;
  }

  if (target === "approved") {
    patch.approved_at = now;
    patch.approved_by_actor_id =
      context.actorId;
  }

  if (target === "processing") {
    patch.processing_started_at =
      request.processing_started_at
      ?? now;
    patch.completed_at = null;
  }

  if (
    target === "completed"
    || target === "partially_fulfilled"
  ) {
    patch.completed_at = now;
  }

  if (
    target === "rejected"
    || target === "cancelled"
  ) {
    patch.closed_at = now;
    patch.resolution_reason =
      context.reason ?? null;
  }

  return patch;
}

function assertSeparationOfDuties(
  request: PrivacyApplicationRow,
  target: PrivacyRequestStatus,
  context: PrivacyWorkflowContext,
): void {
  if (target !== "approved") {
    return;
  }

  if (
    request.verified_by_actor_id
    === context.actorId
  ) {
    throw new PrivacyWorkflowError(
      "PRIVACY_DUAL_CONTROL_REQUIRED",
      "La misma persona no puede verificar y aprobar.",
      403,
    );
  }

  if (
    context.actorRole !== "owner"
    && context.actorRole
      !== "superadmin"
  ) {
    throw new PrivacyWorkflowError(
      "PRIVACY_APPROVAL_ROLE_REQUIRED",
      "La aprobación exige owner o superadmin.",
      403,
    );
  }
}

export async function transitionPrivacyRequest(
  input: PrivacyTransitionInput,
): Promise<PrivacyApplicationRow> {
  const request =
    await loadRequest(
      input.companyId,
      input.requestId,
    );

  const currentStatus =
    readStatus(request);

  const currentVersion =
    readVersion(request);

  if (
    currentVersion
    !== input.expectedVersion
  ) {
    throw new PrivacyWorkflowError(
      "PRIVACY_VERSION_CONFLICT",
      "La solicitud cambió; vuelva a cargarla.",
    );
  }

  if (
    TERMINAL_STATUSES
      .has(currentStatus)
  ) {
    throw new PrivacyWorkflowError(
      "PRIVACY_REQUEST_ALREADY_CLOSED",
      "La solicitud ya está cerrada.",
    );
  }

  if (
    !TRANSITIONS[currentStatus]
      .includes(input.targetStatus)
  ) {
    throw new PrivacyWorkflowError(
      "PRIVACY_TRANSITION_NOT_ALLOWED",
      `No se permite ${currentStatus} → ${input.targetStatus}.`,
    );
  }

  assertSeparationOfDuties(
    request,
    input.targetStatus,
    input,
  );

  if (
    readString(
      request,
      "request_type",
    ) === "erasure"
    && (
      input.targetStatus
        === "processing"
      || input.targetStatus
        === "completed"
    )
  ) {
    await assertNoLegalHold(
      input.companyId,
      request,
    );
  }

  const updatedRows =
    await patchPrivacyRows(
      "privacy_requests",
      input.companyId,
      [
        {
          column: "id",
          value: input.requestId,
        },
        {
          column: "version",
          value: input.expectedVersion,
        },
        {
          column: "status",
          value: currentStatus,
        },
      ],
      transitionPatch(
        request,
        input.targetStatus,
        input,
      ),
    );

  const updated =
    updatedRows[0];

  if (!updated) {
    throw new PrivacyWorkflowError(
      "PRIVACY_CONCURRENT_MODIFICATION",
      "Otra operación modificó la solicitud.",
    );
  }

  await insertPrivacyRow(
    "privacy_request_events",
    input.companyId,
    {
      request_id:
        input.requestId,
      event_type:
        `privacy.request.${input.targetStatus}`,
      actor_type:
        "staff",
      actor_id:
        input.actorId,
      correlation_id:
        input.correlationId,
      payload: {
        from:
          currentStatus,
        to:
          input.targetStatus,
        reason:
          input.reason ?? null,
        metadata:
          cleanMetadata(
            input.metadata,
          ),
        previous_version:
          input.expectedVersion,
        resulting_version:
          input.expectedVersion + 1,
      },
    },
  );

  return updated;
}

export async function verifyPrivacyRequestIdentity(
  input:
    Omit<
      PrivacyTransitionInput,
      "targetStatus"
    > & {
      verificationMethod: string;
      evidenceDigest: string;
    },
): Promise<PrivacyApplicationRow> {
  const request =
    await loadRequest(
      input.companyId,
      input.requestId,
    );

  if (
    request.identity_verification_status
    === "verified"
  ) {
    throw new PrivacyWorkflowError(
      "PRIVACY_ALREADY_VERIFIED",
      "La identidad ya fue verificada.",
    );
  }

  const updated =
    await transitionPrivacyRequest({
      ...input,
      targetStatus: "verified",
      metadata: {
        ...input.metadata,
        verification_method:
          input.verificationMethod,
        evidence_digest:
          input.evidenceDigest,
      },
    });

  const patched =
    await patchPrivacyRows(
      "privacy_requests",
      input.companyId,
      [
        {
          column: "id",
          value: input.requestId,
        },
        {
          column: "version",
          value:
            input.expectedVersion + 1,
        },
      ],
      {
        verification_method:
          input.verificationMethod,
        verification_evidence_digest:
          input.evidenceDigest,
      },
    );

  return patched[0] ?? updated;
}

export async function approvePrivacyRequest(
  input:
    Omit<
      PrivacyTransitionInput,
      "targetStatus"
    >,
): Promise<PrivacyApplicationRow> {
  return transitionPrivacyRequest({
    ...input,
    targetStatus: "approved",
  });
}

export async function authorizePrivacyErasure(
  input:
    Omit<
      PrivacyTransitionInput,
      "targetStatus"
    >,
): Promise<PrivacyApplicationRow> {
  const request =
    await loadRequest(
      input.companyId,
      input.requestId,
    );

  if (
    request.request_type
    !== "erasure"
  ) {
    throw new PrivacyWorkflowError(
      "PRIVACY_NOT_ERASURE_REQUEST",
      "La solicitud no es de supresión.",
    );
  }

  /*
   * Esta operación solamente autoriza el procesamiento.
   * No borra datos directamente. El ejecutor auditado
   * e idempotente se implementará en 0C5.
   */
  return transitionPrivacyRequest({
    ...input,
    targetStatus: "processing",
  });
}
type PrivacyCompatibilityRecord =
  Record<string, unknown>;

function asCompatibilityRecord(
  value: unknown,
): PrivacyCompatibilityRecord {
  if (
    typeof value === "object"
    && value !== null
    && !Array.isArray(value)
  ) {
    return value as
      PrivacyCompatibilityRecord;
  }

  return {};
}

function compatibilityValue(
  primary: PrivacyCompatibilityRecord,
  secondary: PrivacyCompatibilityRecord,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    const primaryValue =
      primary[key];

    if (primaryValue !== undefined) {
      return primaryValue;
    }

    const secondaryValue =
      secondary[key];

    if (secondaryValue !== undefined) {
      return secondaryValue;
    }
  }

  return undefined;
}

function compatibilityString(
  primary: PrivacyCompatibilityRecord,
  secondary: PrivacyCompatibilityRecord,
  keys: readonly string[],
  fallback = "",
): string {
  const value =
    compatibilityValue(
      primary,
      secondary,
      ...keys,
    );

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number"
    || typeof value === "boolean"
  ) {
    return String(value);
  }

  return fallback;
}

function compatibilityNumber(
  primary: PrivacyCompatibilityRecord,
  secondary: PrivacyCompatibilityRecord,
  keys: readonly string[],
): number {
  const value =
    compatibilityValue(
      primary,
      secondary,
      ...keys,
    );

  const number =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function compatibilityMetadata(
  primary: PrivacyCompatibilityRecord,
  secondary: PrivacyCompatibilityRecord,
): Record<string, unknown> | undefined {
  const value =
    compatibilityValue(
      primary,
      secondary,
      "metadata",
    );

  if (
    typeof value === "object"
    && value !== null
    && !Array.isArray(value)
  ) {
    return value as
      Record<string, unknown>;
  }

  return undefined;
}

function normalizeTransitionArguments(
  args: readonly unknown[],
): PrivacyTransitionInput {
  if (
    args.length === 1
    && typeof args[0] === "object"
    && args[0] !== null
  ) {
    const root =
      asCompatibilityRecord(
        args[0],
      );

    const body =
      asCompatibilityRecord(
        root.input
        ?? root.body
        ?? root.transition
        ?? root,
      );

    return {
      companyId:
        compatibilityString(
          root,
          body,
          [
            "companyId",
            "company_id",
          ],
        ),

      requestId:
        compatibilityString(
          root,
          body,
          [
            "requestId",
            "request_id",
            "privacyRequestId",
          ],
        ),

      actorId:
        compatibilityString(
          root,
          body,
          [
            "actorId",
            "actor_id",
          ],
        ),

      actorRole:
        compatibilityString(
          root,
          body,
          [
            "actorRole",
            "actor_role",
            "role",
          ],
          "admin",
        ),

      correlationId:
        compatibilityString(
          root,
          body,
          [
            "correlationId",
            "correlation_id",
            "requestContextId",
          ],
          "privacy-workflow",
        ),

      targetStatus:
        compatibilityString(
          root,
          body,
          [
            "targetStatus",
            "target_status",
            "status",
          ],
        ) as PrivacyRequestStatus,

      expectedVersion:
        compatibilityNumber(
          root,
          body,
          [
            "expectedVersion",
            "expected_version",
            "version",
          ],
        ),

      reason:
        compatibilityString(
          root,
          body,
          [
            "reason",
          ],
        )
        || null,

      metadata:
        compatibilityMetadata(
          root,
          body,
        ),
    };
  }

  const body =
    asCompatibilityRecord(
      args[2],
    );

  const context =
    asCompatibilityRecord(
      args[3],
    );

  return {
    companyId:
      typeof args[0] === "string"
        ? args[0]
        : compatibilityString(
            context,
            body,
            [
              "companyId",
              "company_id",
            ],
          ),

    requestId:
      typeof args[1] === "string"
        ? args[1]
        : compatibilityString(
            context,
            body,
            [
              "requestId",
              "request_id",
            ],
          ),

    actorId:
      compatibilityString(
        context,
        body,
        [
          "actorId",
          "actor_id",
        ],
        typeof args[3] === "string"
          ? args[3]
          : "",
      ),

    actorRole:
      compatibilityString(
        context,
        body,
        [
          "actorRole",
          "actor_role",
          "role",
        ],
        typeof args[4] === "string"
          ? args[4]
          : "admin",
      ),

    correlationId:
      compatibilityString(
        context,
        body,
        [
          "correlationId",
          "correlation_id",
        ],
        typeof args[5] === "string"
          ? args[5]
          : "privacy-workflow",
      ),

    targetStatus:
      compatibilityString(
        body,
        context,
        [
          "targetStatus",
          "target_status",
          "status",
        ],
      ) as PrivacyRequestStatus,

    expectedVersion:
      compatibilityNumber(
        body,
        context,
        [
          "expectedVersion",
          "expected_version",
          "version",
        ],
      ),

    reason:
      compatibilityString(
        body,
        context,
        [
          "reason",
        ],
      )
      || null,

    metadata:
      compatibilityMetadata(
        body,
        context,
      ),
  };
}

/*
 * Adaptador temporal para el contrato utilizado por
 * privacy.controller.ts. Mantiene un único motor real:
 * transitionPrivacyRequest().
 */
export async function transitionPrivacyRequestService(
  ...args: unknown[]
): Promise<PrivacyApplicationRow> {
  return transitionPrivacyRequest(
    normalizeTransitionArguments(
      args,
    ),
  );
}

export async function verifyPrivacyIdentityService(
  ...args: unknown[]
): Promise<PrivacyApplicationRow> {
  const normalized =
    normalizeTransitionArguments(
      args,
    );

  const root =
    asCompatibilityRecord(
      args[0],
    );

  const positionalBody =
    asCompatibilityRecord(
      args[2],
    );

  const body =
    asCompatibilityRecord(
      root.input
      ?? root.body
      ?? positionalBody,
    );

  const verificationMethod =
    compatibilityString(
      root,
      body,
      [
        "verificationMethod",
        "verification_method",
        "method",
      ],
    );

  const evidenceDigest =
    compatibilityString(
      root,
      body,
      [
        "evidenceDigest",
        "evidence_digest",
        "verificationEvidenceDigest",
      ],
    );

  if (!verificationMethod) {
    throw new PrivacyWorkflowError(
      "PRIVACY_VERIFICATION_METHOD_REQUIRED",
      "Falta el método de verificación.",
      400,
    );
  }

  if (
    !/^[a-f0-9]{64}$/i
      .test(evidenceDigest)
  ) {
    throw new PrivacyWorkflowError(
      "PRIVACY_VERIFICATION_DIGEST_INVALID",
      "La evidencia de verificación es inválida.",
      400,
    );
  }

  return verifyPrivacyRequestIdentity({
    companyId:
      normalized.companyId,

    requestId:
      normalized.requestId,

    actorId:
      normalized.actorId,

    actorRole:
      normalized.actorRole,

    correlationId:
      normalized.correlationId,

    expectedVersion:
      normalized.expectedVersion,

    reason:
      normalized.reason,

    metadata:
      normalized.metadata,

    verificationMethod,

    evidenceDigest:
      evidenceDigest.toLowerCase(),
  });
}
