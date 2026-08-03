import type {
  TenantContext,
} from "../tenancy/tenant-context.js";

import {
  isPlatformPermission,
  type Permission,
} from "./permission.catalog.js";

import {
  roleHasPermission,
} from "./role-policy.js";

import type {
  AccessActor,
  AccessDecision,
  AccessDecisionCode,
} from "./authorization.types.js";

export type DecideAccessInput = {
  actor: AccessActor;
  tenant: TenantContext;
  permission: Permission;
};

function denied(
  input: DecideAccessInput,
  code: AccessDecisionCode,
): AccessDecision {
  return {
    allowed: false,
    code,
    permission: input.permission,
    actorId: input.actor.id,
    role: input.actor.role,
    effectiveCompanyId:
      input.tenant.effectiveCompanyId,
  };
}

export function decideAccess(
  input: DecideAccessInput,
): AccessDecision {
  if (!input.actor.active) {
    return denied(
      input,
      "ACTOR_INACTIVE",
    );
  }

  if (
    isPlatformPermission(
      input.permission,
    )
  ) {
    if (
      input.tenant.mode
      !== "platform"
    ) {
      return denied(
        input,
        "PLATFORM_CONTEXT_REQUIRED",
      );
    }

    if (
      input.actor.role
      !== "superadmin"
    ) {
      return denied(
        input,
        "PERMISSION_NOT_GRANTED",
      );
    }
  } else {
    if (
      input.tenant.mode
      !== "company"
      || !input.tenant.effectiveCompanyId
    ) {
      return denied(
        input,
        "COMPANY_CONTEXT_REQUIRED",
      );
    }

    if (
      input.actor.role !== "superadmin"
      && input.actor.companyId
        !== input.tenant.effectiveCompanyId
    ) {
      return denied(
        input,
        "TENANT_MISMATCH",
      );
    }
  }

  if (
    !roleHasPermission(
      input.actor.role,
      input.permission,
    )
  ) {
    return denied(
      input,
      "PERMISSION_NOT_GRANTED",
    );
  }

  return {
    allowed: true,
    code: "ALLOWED",
    permission: input.permission,
    actorId: input.actor.id,
    role: input.actor.role,
    effectiveCompanyId:
      input.tenant.effectiveCompanyId,
  };
}

export class AuthorizationError
  extends Error {
  readonly decision:
    AccessDecision;

  constructor(
    decision: AccessDecision,
  ) {
    super(
      `Access denied: ${decision.code}`,
    );

    this.name =
      "AuthorizationError";

    this.decision =
      decision;
  }
}

export function assertAccess(
  input: DecideAccessInput,
): AccessDecision {
  const decision =
    decideAccess(input);

  if (!decision.allowed) {
    throw new AuthorizationError(
      decision,
    );
  }

  return decision;
}
