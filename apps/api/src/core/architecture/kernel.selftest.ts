import assert from "node:assert/strict";

import {
  assertRolePolicyIntegrity,
  decideAccess,
  roleHasPermission,
  type AccessActor,
} from "../authorization/index.js";

import {
  resolveTenantContext,
  TenantContextError,
} from "../tenancy/index.js";

import {
  createRequestContext,
} from "../request-context/index.js";

function createActor(
  input: Partial<AccessActor>
    & Pick<AccessActor, "role">,
): AccessActor {
  return {
    id:
      input.id
      ?? `actor-${input.role}`,

    name:
      input.name
      ?? input.role,

    email:
      input.email
      ?? `${input.role}@example.com`,

    role:
      input.role,

    companyId:
      input.companyId
      === undefined
        ? "fulanitas"
        : input.companyId,

    active:
      input.active
      ?? true,
  };
}

function expectTenantError(
  action: () => unknown,
  code: TenantContextError["code"],
): void {
  assert.throws(
    action,
    (error: unknown) =>
      error instanceof TenantContextError
      && error.code === code,
  );
}

assertRolePolicyIntegrity();

assert.equal(
  roleHasPermission(
    "vendedor",
    "orders.create",
  ),
  true,
);

assert.equal(
  roleHasPermission(
    "vendedor",
    "integrations.manage",
  ),
  false,
);

assert.equal(
  roleHasPermission(
    "operario",
    "fulfillment.manage",
  ),
  true,
);

assert.equal(
  roleHasPermission(
    "solo_lectura",
    "orders.update",
  ),
  false,
);

const owner =
  createActor({
    role: "owner",
  });

const ownerTenant =
  resolveTenantContext({
    actor: owner,
    mode: "company",
  });

assert.equal(
  ownerTenant.effectiveCompanyId,
  "fulanitas",
);

assert.equal(
  decideAccess({
    actor: owner,
    tenant: ownerTenant,
    permission:
      "integrations.manage",
  }).allowed,
  true,
);

const seller =
  createActor({
    role: "vendedor",
  });

expectTenantError(
  () =>
    resolveTenantContext({
      actor: seller,
      mode: "company",
      headerCompanyId:
        "otra-empresa",
    }),
  "COMPANY_CONTEXT_MISMATCH",
);

const superadmin =
  createActor({
    role: "superadmin",
    companyId: null,
  });

expectTenantError(
  () =>
    resolveTenantContext({
      actor: superadmin,
      mode: "company",
    }),
  "COMPANY_CONTEXT_REQUIRED",
);

const selectedCompany =
  resolveTenantContext({
    actor: superadmin,
    mode: "company",
    headerCompanyId:
      "fulanitas",
  });

assert.equal(
  selectedCompany
    .superadminImpersonation,
  true,
);

const platformTenant =
  resolveTenantContext({
    actor: superadmin,
    mode: "platform",
  });

assert.equal(
  decideAccess({
    actor: superadmin,
    tenant: platformTenant,
    permission:
      "platform.companies.manage",
  }).allowed,
  true,
);

const requestContext =
  createRequestContext({
    actor: seller,

    tenant:
      resolveTenantContext({
        actor: seller,
        mode: "company",
      }),

    source: "dashboard",
    requestId:
      "architecture-test-0001",

    ipAddress:
      "127.0.0.1",

    userAgent:
      "kernel-selftest",
  });

assert.equal(
  requestContext.requestId,
  "architecture-test-0001",
);

assert.equal(
  requestContext
    .tenant
    .effectiveCompanyId,
  "fulanitas",
);

console.log(
  "✅ RBAC integrity",
);

console.log(
  "✅ Tenant isolation",
);

console.log(
  "✅ Superadmin explicit selection",
);

console.log(
  "✅ Platform isolation",
);

console.log(
  "✅ Request context",
);

console.log(
  "✅ KERNEL SELFTEST PASSED",
);
