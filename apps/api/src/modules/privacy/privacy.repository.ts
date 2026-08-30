import {
  supabaseRequest,
} from "../../services/db/supabase-rest.client.js";

import {
  type PrivacyConsentRecord,
  type PrivacyDataSubjectRecord,
  type PrivacyIdentityStatus,
  type PrivacyJsonObject,
  type PrivacyLegalHoldRecord,
  type PrivacyRequestEventRecord,
  type PrivacyRequestItemRecord,
  type PrivacyRequestPriority,
  type PrivacyRequestRecord,
  type PrivacyRequestStatus,
  type PrivacyRequestType,
  type PrivacyTenantPolicyRecord,
} from "./privacy.types.js";

export type PrivacyRepositoryErrorCode =
  | "PRIVACY_ROW_NOT_FOUND"
  | "PRIVACY_INSERT_FAILED"
  | "PRIVACY_VERSION_CONFLICT"
  | "PRIVACY_INVALID_QUERY";

export class PrivacyRepositoryError
  extends Error {
  readonly code:
    PrivacyRepositoryErrorCode;

  constructor(
    code: PrivacyRepositoryErrorCode,
    message: string,
  ) {
    super(message);

    this.name =
      "PrivacyRepositoryError";

    this.code =
      code;

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

function filterValue(
  value: string,
): string {
  return encodeURIComponent(
    value,
  );
}

function firstOrThrow<T>(
  rows: readonly T[],
  code:
    PrivacyRepositoryErrorCode,
  message: string,
): T {
  const first =
    rows[0];

  if (!first) {
    throw new PrivacyRepositoryError(
      code,
      message,
    );
  }

  return first;
}

export interface CreatePrivacySubjectRecord {
  company_id: string;
  subject_key: string;
  identifier_kind:
    PrivacyDataSubjectRecord[
      "identifier_kind"
    ];
  identifier_digest: string;
  primary_contact_id:
    string | null;
  status?:
    PrivacyDataSubjectRecord[
      "status"
    ];
}

export async function findPrivacySubjectByDigest(
  companyId: string,
  identifierDigest: string,
): Promise<
  PrivacyDataSubjectRecord | null
> {
  const rows =
    await supabaseRequest<
      PrivacyDataSubjectRecord[]
    >({
      table:
        "privacy_data_subjects",

      query:
        `?select=*`
        + `&company_id=eq.${filterValue(companyId)}`
        + `&identifier_digest=eq.${filterValue(identifierDigest)}`
        + "&limit=1",
    });

  return rows[0] ?? null;
}

export async function createPrivacySubject(
  input:
    CreatePrivacySubjectRecord,
): Promise<PrivacyDataSubjectRecord> {
  const rows =
    await supabaseRequest<
      PrivacyDataSubjectRecord[]
    >({
      table:
        "privacy_data_subjects",

      method:
        "POST",

      body: {
        ...input,

        status:
          input.status
          ?? "active",
      },

      prefer:
        "return=representation",
    });

  return firstOrThrow(
    rows,
    "PRIVACY_INSERT_FAILED",
    "No se pudo crear el sujeto de privacidad.",
  );
}

export async function findOrCreatePrivacySubject(
  input:
    CreatePrivacySubjectRecord,
): Promise<PrivacyDataSubjectRecord> {
  const existing =
    await findPrivacySubjectByDigest(
      input.company_id,
      input.identifier_digest,
    );

  if (existing) {
    return existing;
  }

  return createPrivacySubject(
    input,
  );
}

export interface CreatePrivacyRequestRecord {
  company_id: string;
  subject_id: string;
  request_code: string;
  request_type:
    PrivacyRequestType;
  source_channel:
    PrivacyRequestRecord[
      "source_channel"
    ];
  priority:
    PrivacyRequestPriority;
  due_at: string;
  requested_scope:
    PrivacyJsonObject;
  idempotency_key:
    string | null;
  created_by_actor_id:
    string | null;
}

export async function createPrivacyRequest(
  input:
    CreatePrivacyRequestRecord,
): Promise<PrivacyRequestRecord> {
  const rows =
    await supabaseRequest<
      PrivacyRequestRecord[]
    >({
      table:
        "privacy_requests",

      method:
        "POST",

      body: {
        ...input,

        status:
          "received",

        identity_verification_status:
          "pending",
      },

      prefer:
        "return=representation",
    });

  return firstOrThrow(
    rows,
    "PRIVACY_INSERT_FAILED",
    "No se pudo crear la solicitud de privacidad.",
  );
}

export async function getPrivacyRequest(
  companyId: string,
  requestId: string,
): Promise<PrivacyRequestRecord> {
  const rows =
    await supabaseRequest<
      PrivacyRequestRecord[]
    >({
      table:
        "privacy_requests",

      query:
        `?select=*`
        + `&company_id=eq.${filterValue(companyId)}`
        + `&id=eq.${filterValue(requestId)}`
        + "&limit=1",
    });

  return firstOrThrow(
    rows,
    "PRIVACY_ROW_NOT_FOUND",
    "La solicitud de privacidad no existe.",
  );
}

export interface ListPrivacyRequestsInput {
  companyId: string;
  status?:
    PrivacyRequestStatus;
  requestType?:
    PrivacyRequestType;
  subjectId?:
    string;
  dueBefore?:
    string;
  limit?:
    number;
  offset?:
    number;
}

export async function listPrivacyRequests(
  input:
    ListPrivacyRequestsInput,
): Promise<PrivacyRequestRecord[]> {
  const limit =
    Math.min(
      Math.max(
        input.limit ?? 25,
        1,
      ),
      100,
    );

  const offset =
    Math.max(
      input.offset ?? 0,
      0,
    );

  const filters = [
    "select=*",
    `company_id=eq.${filterValue(input.companyId)}`,
  ];

  if (input.status) {
    filters.push(
      `status=eq.${filterValue(input.status)}`,
    );
  }

  if (input.requestType) {
    filters.push(
      `request_type=eq.${filterValue(input.requestType)}`,
    );
  }

  if (input.subjectId) {
    filters.push(
      `subject_id=eq.${filterValue(input.subjectId)}`,
    );
  }

  if (input.dueBefore) {
    filters.push(
      `due_at=lte.${filterValue(input.dueBefore)}`,
    );
  }

  filters.push(
    "order=created_at.desc",
    `limit=${limit}`,
    `offset=${offset}`,
  );

  return supabaseRequest<
    PrivacyRequestRecord[]
  >({
    table:
      "privacy_requests",

    query:
      `?${filters.join("&")}`,
  });
}

export type PrivacyRequestMutablePatch =
  Partial<
    Pick<
      PrivacyRequestRecord,
      | "status"
      | "identity_verification_status"
      | "verification_method"
      | "verification_evidence_digest"
      | "verified_at"
      | "verified_by_actor_id"
      | "assigned_to_actor_id"
      | "decision_code"
      | "decision_notes"
      | "approved_at"
      | "approved_by_actor_id"
      | "execution_started_at"
      | "executed_by_actor_id"
      | "legal_hold_detected"
      | "result_summary"
      | "completed_at"
    >
  >;

export async function updatePrivacyRequest(
  input: {
    companyId: string;
    requestId: string;
    expectedVersion: number;
    patch:
      PrivacyRequestMutablePatch;
  },
): Promise<PrivacyRequestRecord> {
  const nextVersion =
    input.expectedVersion + 1;

  const rows =
    await supabaseRequest<
      PrivacyRequestRecord[]
    >({
      table:
        "privacy_requests",

      method:
        "PATCH",

      query:
        `?company_id=eq.${filterValue(input.companyId)}`
        + `&id=eq.${filterValue(input.requestId)}`
        + `&version=eq.${input.expectedVersion}`
        + "&select=*",

      body: {
        ...input.patch,

        version:
          nextVersion,
      },

      prefer:
        "return=representation",
    });

  return firstOrThrow(
    rows,
    "PRIVACY_VERSION_CONFLICT",
    "La solicitud fue modificada por otro proceso.",
  );
}

export async function updateIdentityVerification(
  input: {
    companyId: string;
    requestId: string;
    expectedVersion: number;
    status:
      PrivacyIdentityStatus;
    method:
      string | null;
    evidenceDigest:
      string | null;
    actorId:
      string;
    verifiedAt:
      string | null;
  },
): Promise<PrivacyRequestRecord> {
  return updatePrivacyRequest({
    companyId:
      input.companyId,

    requestId:
      input.requestId,

    expectedVersion:
      input.expectedVersion,

    patch: {
      identity_verification_status:
        input.status,

      verification_method:
        input.method,

      verification_evidence_digest:
        input.evidenceDigest,

      verified_at:
        input.verifiedAt,

      verified_by_actor_id:
        input.status === "verified"
        || input.status === "waived"
          ? input.actorId
          : null,
    },
  });
}

export interface CreatePrivacyRequestItemInput {
  store_code: string;
  action_code:
    PrivacyRequestItemRecord[
      "action_code"
    ];
  status?:
    PrivacyRequestItemRecord[
      "status"
    ];
}

export async function createPrivacyRequestItems(
  input: {
    companyId: string;
    requestId: string;
    items:
      CreatePrivacyRequestItemInput[];
  },
): Promise<PrivacyRequestItemRecord[]> {
  if (
    input.items.length === 0
  ) {
    return [];
  }

  const body =
    input.items.map(
      (item) => ({
        company_id:
          input.companyId,

        request_id:
          input.requestId,

        store_code:
          item.store_code,

        action_code:
          item.action_code,

        status:
          item.status
          ?? "pending",
      }),
    );

  return supabaseRequest<
    PrivacyRequestItemRecord[]
  >({
    table:
      "privacy_request_items",

    method:
      "POST",

    body,

    prefer:
      "return=representation",
  });
}

export async function appendPrivacyRequestEvent(
  input: {
    companyId: string;
    requestId: string;
    eventType: string;
    actorType:
      PrivacyRequestEventRecord[
        "actor_type"
      ];
    actorId:
      string | null;
    correlationId:
      string | null;
    payload:
      PrivacyJsonObject;
  },
): Promise<PrivacyRequestEventRecord> {
  const rows =
    await supabaseRequest<
      PrivacyRequestEventRecord[]
    >({
      table:
        "privacy_request_events",

      method:
        "POST",

      body: {
        company_id:
          input.companyId,

        request_id:
          input.requestId,

        event_type:
          input.eventType,

        actor_type:
          input.actorType,

        actor_id:
          input.actorId,

        correlation_id:
          input.correlationId,

        payload:
          input.payload,
      },

      prefer:
        "return=representation",
    });

  return firstOrThrow(
    rows,
    "PRIVACY_INSERT_FAILED",
    "No se pudo registrar el evento de auditoría.",
  );
}

export async function listPrivacyRequestEvents(
  companyId: string,
  requestId: string,
): Promise<
  PrivacyRequestEventRecord[]
> {
  return supabaseRequest<
    PrivacyRequestEventRecord[]
  >({
    table:
      "privacy_request_events",

    query:
      `?select=*`
      + `&company_id=eq.${filterValue(companyId)}`
      + `&request_id=eq.${filterValue(requestId)}`
      + "&order=sequence_number.asc",
  });
}

export async function getActivePrivacyPolicy(
  companyId: string,
): Promise<
  PrivacyTenantPolicyRecord | null
> {
  const rows =
    await supabaseRequest<
      PrivacyTenantPolicyRecord[]
    >({
      table:
        "privacy_tenant_policies",

      query:
        `?select=*`
        + `&company_id=eq.${filterValue(companyId)}`
        + "&status=eq.active"
        + "&order=version.desc"
        + "&limit=1",
    });

  return rows[0] ?? null;
}

export async function findActiveLegalHolds(
  companyId: string,
  subjectId: string,
): Promise<
  PrivacyLegalHoldRecord[]
> {
  const now =
    new Date().toISOString();

  return supabaseRequest<
    PrivacyLegalHoldRecord[]
  >({
    table:
      "privacy_legal_holds",

    query:
      `?select=*`
      + `&company_id=eq.${filterValue(companyId)}`
      + `&subject_id=eq.${filterValue(subjectId)}`
      + "&status=eq.active"
      + `&or=(expires_at.is.null,expires_at.gt.${filterValue(now)})`
      + "&order=starts_at.desc",
  });
}

export interface CreatePrivacyConsentRecord {
  company_id: string;
  subject_id: string;
  purpose_code: string;
  status:
    PrivacyConsentRecord[
      "status"
    ];
  lawful_basis:
    PrivacyConsentRecord[
      "lawful_basis"
    ];
  source_channel:
    PrivacyConsentRecord[
      "source_channel"
    ];
  notice_version:
    string | null;
  evidence_digest:
    string | null;
  evidence:
    PrivacyJsonObject;
  captured_by_actor_id:
    string | null;
  valid_from:
    string;
  valid_until:
    string | null;
  withdrawn_at:
    string | null;
  withdrawal_reason_code:
    string | null;
  idempotency_key:
    string | null;
}

export async function createPrivacyConsent(
  input:
    CreatePrivacyConsentRecord,
): Promise<PrivacyConsentRecord> {
  const rows =
    await supabaseRequest<
      PrivacyConsentRecord[]
    >({
      table:
        "privacy_consents",

      method:
        "POST",

      body:
        input,

      prefer:
        "return=representation",
    });

  return firstOrThrow(
    rows,
    "PRIVACY_INSERT_FAILED",
    "No se pudo registrar la evidencia de consentimiento.",
  );
}
