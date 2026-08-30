import {
  sanitizePrivacyAuditPayload,
  buildPrivacySubjectIdentity,
  createPrivacyIdempotencyKey,
  createPrivacyRequestCode,
} from "./privacy-crypto.js";

import {
  createPrivacyRequest,
  createPrivacyRequestItems,
  findOrCreatePrivacySubject,
  getActivePrivacyPolicy,
  getPrivacyRequest,
  listPrivacyRequestEvents,
  listPrivacyRequests,
  findActiveLegalHolds,
  appendPrivacyRequestEvent,
  type CreatePrivacyRequestItemInput,
} from "./privacy.repository.js";

import {
  PRIVACY_STORE_CODES,
  type PrivacyDataSubjectRecord,
  type PrivacyItemAction,
  type PrivacyJson,
  type PrivacyJsonObject,
  type PrivacyLegalHoldRecord,
  type PrivacyRequestEventRecord,
  type PrivacyRequestItemRecord,
  type PrivacyRequestRecord,
  type PrivacyStoreCode,
} from "./privacy.types.js";

import {
  type PrivacyCreateRequestInput,
  type PrivacyListQuery,
} from "./privacy.schema.js";

export interface PrivacyServiceContext {
  companyId: string;
  actorId: string;
  correlationId: string;
}

export interface CreatePrivacyRequestServiceInput {
  context:
    PrivacyServiceContext;
  data:
    PrivacyCreateRequestInput;
}

export interface PrivacyRequestBundle {
  request:
    PrivacyRequestRecord;
  subject:
    PrivacyDataSubjectRecord;
  items:
    PrivacyRequestItemRecord[];
}

export interface PrivacyRequestDetail {
  request:
    PrivacyRequestRecord;
  events:
    PrivacyRequestEventRecord[];
  activeLegalHolds:
    PrivacyLegalHoldRecord[];
}

function toPrivacyObject(
  value: unknown,
): PrivacyJsonObject {
  const sanitized =
    sanitizePrivacyAuditPayload(
      value,
    );

  if (
    sanitized === null
    || Array.isArray(sanitized)
    || typeof sanitized !== "object"
  ) {
    return {};
  }

  return sanitized;
}

function addPlanItem(
  target:
    CreatePrivacyRequestItemInput[],
  seen:
    Set<string>,
  store:
    PrivacyStoreCode,
  action:
    PrivacyItemAction,
): void {
  const key =
    `${store}:${action}`;

  if (seen.has(key)) {
    return;
  }

  seen.add(key);

  target.push({
    store_code:
      store,

    action_code:
      action,

    status:
      "pending",
  });
}

function buildPrivacyExecutionPlan(
  requestType:
    PrivacyRequestRecord[
      "request_type"
    ],
): CreatePrivacyRequestItemInput[] {
  const result:
    CreatePrivacyRequestItemInput[] = [];

  const seen =
    new Set<string>();

  for (
    const store
    of PRIVACY_STORE_CODES
  ) {
    addPlanItem(
      result,
      seen,
      store,
      "discover",
    );
  }

  switch (requestType) {
    case "access":
    case "export":
      for (
        const store
        of PRIVACY_STORE_CODES
      ) {
        addPlanItem(
          result,
          seen,
          store,
          "export",
        );
      }

      break;

    case "rectification":
      for (
        const store
        of [
          "supabase_crm",
          "supabase_conversations",
          "supabase_commerce",
          "external_crm",
        ] as const
      ) {
        addPlanItem(
          result,
          seen,
          store,
          "rectify",
        );
      }

      break;

    case "restriction":
      for (
        const store
        of PRIVACY_STORE_CODES
      ) {
        addPlanItem(
          result,
          seen,
          store,
          "restrict",
        );
      }

      break;

    case "erasure":
      for (
        const store
        of [
          "supabase_crm",
          "supabase_conversations",
          "supabase_commerce",
          "supabase_voice",
          "voice_sqlite",
          "local_audit_logs",
        ] as const
      ) {
        addPlanItem(
          result,
          seen,
          store,
          "anonymize",
        );
      }

      for (
        const store
        of [
          "voice_recordings",
          "vector_memory",
        ] as const
      ) {
        addPlanItem(
          result,
          seen,
          store,
          "delete",
        );
      }

      for (
        const store
        of [
          "supabase_crm",
          "external_crm",
        ] as const
      ) {
        addPlanItem(
          result,
          seen,
          store,
          "suppress",
        );
      }

      break;

    case "objection":
    case "consent_withdrawal":
      for (
        const store
        of [
          "supabase_crm",
          "external_crm",
        ] as const
      ) {
        addPlanItem(
          result,
          seen,
          store,
          "suppress",
        );
      }

      break;
  }

  return result;
}

function addDays(
  start: Date,
  days: number,
): string {
  const due =
    new Date(
      start.getTime()
      + days
        * 24
        * 60
        * 60
        * 1000,
    );

  return due.toISOString();
}

function eventPayload(
  value: PrivacyJsonObject,
): PrivacyJsonObject {
  const sanitized =
    sanitizePrivacyAuditPayload(
      value,
    ) as PrivacyJson;

  if (
    sanitized
    && !Array.isArray(sanitized)
    && typeof sanitized === "object"
  ) {
    return sanitized;
  }

  return {};
}

export async function createPrivacyRequestService(
  input:
    CreatePrivacyRequestServiceInput,
): Promise<PrivacyRequestBundle> {
  const identity =
    buildPrivacySubjectIdentity({
      companyId:
        input.context.companyId,

      kind:
        input.data.identifier.kind,

      value:
        input.data.identifier.value,
    });

  const subject =
    await findOrCreatePrivacySubject({
      company_id:
        input.context.companyId,

      subject_key:
        identity.subjectKey,

      identifier_kind:
        identity.identifierKind,

      identifier_digest:
        identity.identifierDigest,

      primary_contact_id:
        input.data.identifier
          .contact_id
        ?? null,
    });

  const policy =
    await getActivePrivacyPolicy(
      input.context.companyId,
    );

  const receivedAt =
    new Date();

  const request =
    await createPrivacyRequest({
      company_id:
        input.context.companyId,

      subject_id:
        subject.id,

      request_code:
        createPrivacyRequestCode(
          receivedAt,
        ),

      request_type:
        input.data.request_type,

      source_channel:
        input.data.source_channel,

      priority:
        input.data.priority,

      due_at:
        addDays(
          receivedAt,
          policy?.request_due_days
          ?? 30,
        ),

      requested_scope:
        toPrivacyObject(
          input.data.requested_scope,
        ),

      idempotency_key:
        input.data.idempotency_key
        ?? createPrivacyIdempotencyKey(),

      created_by_actor_id:
        input.context.actorId,
    });

  const items =
    await createPrivacyRequestItems({
      companyId:
        input.context.companyId,

      requestId:
        request.id,

      items:
        buildPrivacyExecutionPlan(
          request.request_type,
        ),
    });

  await appendPrivacyRequestEvent({
    companyId:
      input.context.companyId,

    requestId:
      request.id,

    eventType:
      "privacy.request.received",

    actorType:
      "operator",

    actorId:
      input.context.actorId,

    correlationId:
      input.context.correlationId,

    payload:
      eventPayload({
        request_type:
          request.request_type,

        source_channel:
          request.source_channel,

        priority:
          request.priority,

        policy_version:
          policy?.version
          ?? null,

        planned_items:
          items.length,
      }),
  });

  return {
    request,
    subject,
    items,
  };
}

export async function listPrivacyRequestsService(
  context:
    PrivacyServiceContext,
  query:
    PrivacyListQuery,
): Promise<PrivacyRequestRecord[]> {
  return listPrivacyRequests({
    companyId:
      context.companyId,

    status:
      query.status,

    requestType:
      query.request_type,

    subjectId:
      query.subject_id,

    dueBefore:
      query.due_before,

    limit:
      query.limit,

    offset:
      query.offset,
  });
}

export async function getPrivacyRequestDetailService(
  context:
    PrivacyServiceContext,
  requestId: string,
): Promise<PrivacyRequestDetail> {
  const request =
    await getPrivacyRequest(
      context.companyId,
      requestId,
    );

  const [
    events,
    activeLegalHolds,
  ] = await Promise.all([
    listPrivacyRequestEvents(
      context.companyId,
      requestId,
    ),

    findActiveLegalHolds(
      context.companyId,
      request.subject_id,
    ),
  ]);

  return {
    request,
    events,
    activeLegalHolds,
  };
}
