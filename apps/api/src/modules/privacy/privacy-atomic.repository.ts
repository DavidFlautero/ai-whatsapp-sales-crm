import {
  supabaseRpc,
} from "../../services/db/supabase-rest.client.js";

import type {
  PrivacyEventActorType,
  PrivacyJsonObject,
  PrivacyRequestEventRecord,
  PrivacyRequestRecord,
  PrivacyRequestStatus,
  PrivacyTenantPolicyRecord,
} from "./privacy.types.js";

export interface AtomicPrivacyTransitionInput {
  companyId: string;
  requestId: string;
  expectedVersion: number;
  targetStatus: PrivacyRequestStatus;
  actorType: PrivacyEventActorType;
  actorId: string;
  correlationId: string;
  reason?: string | null;
  patch?: PrivacyJsonObject;
  payload?: PrivacyJsonObject;
}

export interface AtomicPrivacyTransitionResult {
  request: PrivacyRequestRecord;
  event: PrivacyRequestEventRecord;
}

export interface ActivatePrivacyPolicyInput {
  companyId: string;
  policyId: string;
  actorId: string;
}

export interface ActivatePrivacyPolicyResult {
  policy: PrivacyTenantPolicyRecord;
}

export class PrivacyAtomicRepositoryError
  extends Error {
  readonly code: string;

  constructor(
    code: string,
    message: string,
  ) {
    super(message);
    this.name =
      "PrivacyAtomicRepositoryError";
    this.code = code;
  }
}

function requiredText(
  value: string,
  code: string,
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new PrivacyAtomicRepositoryError(
      code,
      "Falta un identificador requerido.",
    );
  }

  return normalized;
}

export async function transitionPrivacyRequestAtomic(
  input: AtomicPrivacyTransitionInput,
): Promise<AtomicPrivacyTransitionResult> {
  if (
    !Number.isInteger(
      input.expectedVersion,
    )
    || input.expectedVersion < 1
  ) {
    throw new PrivacyAtomicRepositoryError(
      "PRIVACY_INVALID_VERSION",
      "La versión esperada es inválida.",
    );
  }

  const result =
    await supabaseRpc<
      AtomicPrivacyTransitionResult
    >(
      "privacy_transition_request_atomic",
      {
        p_company_id:
          requiredText(
            input.companyId,
            "PRIVACY_COMPANY_REQUIRED",
          ),

        p_request_id:
          requiredText(
            input.requestId,
            "PRIVACY_REQUEST_REQUIRED",
          ),

        p_expected_version:
          input.expectedVersion,

        p_target_status:
          input.targetStatus,

        p_actor_type:
          input.actorType,

        p_actor_id:
          requiredText(
            input.actorId,
            "PRIVACY_ACTOR_REQUIRED",
          ),

        p_correlation_id:
          requiredText(
            input.correlationId,
            "PRIVACY_CORRELATION_REQUIRED",
          ),

        p_reason:
          input.reason ?? null,

        p_patch:
          input.patch ?? {},

        p_payload:
          input.payload ?? {},
      },
    );

  if (
    !result
    || !result.request
    || !result.event
  ) {
    throw new PrivacyAtomicRepositoryError(
      "PRIVACY_ATOMIC_RESULT_INVALID",
      "El RPC no devolvió solicitud y evento.",
    );
  }

  if (
    result.request.company_id
    !== input.companyId
    || result.event.company_id
      !== input.companyId
  ) {
    throw new PrivacyAtomicRepositoryError(
      "PRIVACY_CROSS_TENANT_RESULT",
      "El RPC devolvió datos de otra empresa.",
    );
  }

  return result;
}

export async function activatePrivacyPolicyAtomic(
  input: ActivatePrivacyPolicyInput,
): Promise<ActivatePrivacyPolicyResult> {
  const result =
    await supabaseRpc<
      ActivatePrivacyPolicyResult
    >(
      "privacy_activate_policy_atomic",
      {
        p_company_id:
          requiredText(
            input.companyId,
            "PRIVACY_COMPANY_REQUIRED",
          ),

        p_policy_id:
          requiredText(
            input.policyId,
            "PRIVACY_POLICY_REQUIRED",
          ),

        p_actor_id:
          requiredText(
            input.actorId,
            "PRIVACY_ACTOR_REQUIRED",
          ),
      },
    );

  if (
    !result
    || !result.policy
  ) {
    throw new PrivacyAtomicRepositoryError(
      "PRIVACY_POLICY_RESULT_INVALID",
      "El RPC no devolvió la política.",
    );
  }

  if (
    result.policy.company_id
    !== input.companyId
  ) {
    throw new PrivacyAtomicRepositoryError(
      "PRIVACY_CROSS_TENANT_RESULT",
      "El RPC devolvió una política de otra empresa.",
    );
  }

  return result;
}
