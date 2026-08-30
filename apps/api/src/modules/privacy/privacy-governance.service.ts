import {
  supabaseRequest,
} from "../../services/db/supabase-rest.client.js";

import {
  buildPrivacySubjectIdentity,
  computePrivacyEvidenceDigest,
  sanitizePrivacyAuditPayload,
} from "./privacy-crypto.js";

import {
  createPrivacyConsent,
  findOrCreatePrivacySubject,
  getActivePrivacyPolicy,
} from "./privacy.repository.js";

import {
  type PrivacyConsentRecord,
  type PrivacyJsonObject,
  type PrivacyLegalHoldRecord,
  type PrivacyTenantPolicyRecord,
} from "./privacy.types.js";

import {
  type PrivacyConsentInput,
  type PrivacyLegalHoldInput,
  type PrivacyPolicyInput,
} from "./privacy.schema.js";

import {
  type PrivacyServiceContext,
} from "./privacy-request.service.js";

function filterValue(
  value: string,
): string {
  return encodeURIComponent(
    value,
  );
}

function firstOrThrow<T>(
  rows: readonly T[],
  message: string,
): T {
  const first =
    rows[0];

  if (!first) {
    throw new Error(
      message,
    );
  }

  return first;
}

function toPrivacyObject(
  value: unknown,
): PrivacyJsonObject {
  const sanitized =
    sanitizePrivacyAuditPayload(
      value,
    );

  if (
    sanitized
    && typeof sanitized === "object"
    && !Array.isArray(sanitized)
  ) {
    return sanitized;
  }

  return {};
}

export async function getActivePrivacyPolicyService(
  context:
    PrivacyServiceContext,
): Promise<
  PrivacyTenantPolicyRecord | null
> {
  return getActivePrivacyPolicy(
    context.companyId,
  );
}

export async function createPrivacyPolicyDraftService(
  input: {
    context:
      PrivacyServiceContext;
    data:
      PrivacyPolicyInput;
  },
): Promise<PrivacyTenantPolicyRecord> {
  const existing =
    await supabaseRequest<
      PrivacyTenantPolicyRecord[]
    >({
      table:
        "privacy_tenant_policies",

      query:
        `?select=version`
        + `&company_id=eq.${filterValue(input.context.companyId)}`
        + "&order=version.desc"
        + "&limit=1",
    });

  const nextVersion =
    (
      existing[0]
        ?.version
      ?? 0
    ) + 1;

  const metadata =
    input.data.policy_metadata
      ? toPrivacyObject(
          input.data.policy_metadata,
        )
      : undefined;

  const rows =
    await supabaseRequest<
      PrivacyTenantPolicyRecord[]
    >({
      table:
        "privacy_tenant_policies",

      method:
        "POST",

      body: {
        ...input.data,

        company_id:
          input.context.companyId,

        version:
          nextVersion,

        status:
          "draft",

        policy_metadata:
          metadata,

        activated_at:
          null,

        retired_at:
          null,

        created_by_actor_id:
          input.context.actorId,

        updated_by_actor_id:
          input.context.actorId,
      },

      prefer:
        "return=representation",
    });

  return firstOrThrow(
    rows,
    "No se pudo crear la política de privacidad.",
  );
}

export async function recordPrivacyConsentService(
  input: {
    context:
      PrivacyServiceContext;
    data:
      PrivacyConsentInput;
  },
): Promise<PrivacyConsentRecord> {
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

  const now =
    new Date().toISOString();

  const evidence =
    toPrivacyObject(
      input.data.evidence,
    );

  return createPrivacyConsent({
    company_id:
      input.context.companyId,

    subject_id:
      subject.id,

    purpose_code:
      input.data.purpose_code,

    status:
      input.data.status,

    lawful_basis:
      input.data.lawful_basis,

    source_channel:
      input.data.source_channel,

    notice_version:
      input.data.notice_version
      ?? null,

    evidence_digest:
      computePrivacyEvidenceDigest(
        evidence,
      ),

    evidence,

    captured_by_actor_id:
      input.context.actorId,

    valid_from:
      input.data.valid_from
      ?? now,

    valid_until:
      input.data.valid_until
      ?? null,

    withdrawn_at:
      input.data.status
        === "withdrawn"
        ? now
        : null,

    withdrawal_reason_code:
      input.data
        .withdrawal_reason_code
      ?? null,

    idempotency_key:
      input.data.idempotency_key
      ?? null,
  });
}

export async function createPrivacyLegalHoldService(
  input: {
    context:
      PrivacyServiceContext;
    data:
      PrivacyLegalHoldInput;
  },
): Promise<PrivacyLegalHoldRecord> {
  const now =
    new Date().toISOString();

  const authorityDigest =
    input.data.authority_reference
      ? computePrivacyEvidenceDigest({
          authority:
            input.data.authority_reference,
        })
      : null;

  const rows =
    await supabaseRequest<
      PrivacyLegalHoldRecord[]
    >({
      table:
        "privacy_legal_holds",

      method:
        "POST",

      body: {
        company_id:
          input.context.companyId,

        subject_id:
          input.data.subject_id,

        status:
          "active",

        reason_code:
          input.data.reason_code,

        authority_reference_digest:
          authorityDigest,

        scope:
          toPrivacyObject(
            input.data.scope,
          ),

        starts_at:
          input.data.starts_at
          ?? now,

        expires_at:
          input.data.expires_at
          ?? null,

        released_at:
          null,

        released_by_actor_id:
          null,

        created_by_actor_id:
          input.context.actorId,
      },

      prefer:
        "return=representation",
    });

  return firstOrThrow(
    rows,
    "No se pudo crear el bloqueo legal.",
  );
}
