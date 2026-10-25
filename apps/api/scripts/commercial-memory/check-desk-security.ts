import assert from "node:assert/strict";

import {
  commercialCompanyGuard,
} from "../../src/modules/commercial-memory/commercial-memory-access.js";

const COMPANY = "eventos-mediterraneo";

const guard = commercialCompanyGuard(
  COMPANY,
);

const originalFlag =
  process.env.CM_DASHBOARD_ENABLED;

type TestRequest = {
  authUser?: {
    id: string;
    role: string;
  };

  tenantContext?: unknown;

  headers?: Record<string, string>;
};

function tenant(
  effectiveCompanyId: string | null,
  mode = "company",
) {
  return {
    mode,
    effectiveCompanyId,
    actorCompanyId:
      effectiveCompanyId,
    source: "session",
    superadminImpersonation: false,
  };
}

async function test(
  name: string,
  request: TestRequest,
  enabled: boolean,
  expected: number | "allowed",
) {
  process.env.CM_DASHBOARD_ENABLED =
    enabled ? "true" : "false";

  let allowed = false;
  let responseCode = 200;

  const response = {
    status(code: number) {
      responseCode = code;
      return this;
    },

    json(_data: unknown) {
      return this;
    },
  };

  await Promise.resolve(
    guard(
      request as never,
      response as never,
      (() => {
        allowed = true;
      }) as never,
    ),
  );

  if (expected === "allowed") {
    assert.equal(
      allowed,
      true,
      name,
    );
  } else {
    assert.equal(
      allowed,
      false,
      name,
    );

    assert.equal(
      responseCode,
      expected,
      name,
    );
  }

  console.log(
    "SECURITY_OK",
    name,
  );
}

async function main() {
  const admin = {
    id: "security-test-user",
    role: "admin",
  };

  try {
    await test(
      "FEATURE_DISABLED",
      {
        authUser: admin,
        tenantContext: tenant(COMPANY),
      },
      false,
      503,
    );

    await test(
      "ANONYMOUS_DENIED",
      {
        tenantContext: tenant(COMPANY),
      },
      true,
      401,
    );

    await test(
      "TENANT_MISSING",
      {
        authUser: admin,
      },
      true,
      403,
    );

    await test(
      "WRONG_COMPANY",
      {
        authUser: admin,
        tenantContext: tenant(
          "otra-empresa",
        ),
      },
      true,
      403,
    );

    await test(
      "PLATFORM_MODE_DENIED",
      {
        authUser: {
          id: "platform-user",
          role: "superadmin",
        },

        tenantContext: tenant(
          COMPANY,
          "platform",
        ),
      },
      true,
      403,
    );

    await test(
      "ACTOR_COMPANY_NOT_SUFFICIENT",
      {
        authUser: admin,
        tenantContext: {
          mode: "company",
          effectiveCompanyId:
            "otra-empresa",
          actorCompanyId: COMPANY,
        },
      },
      true,
      403,
    );

    await test(
      "SPOOFED_LEGACY_FIELD",
      {
        authUser: admin,

        tenantContext: {
          mode: "company",
          companyId: COMPANY,
          effectiveCompanyId:
            "otra-empresa",
        },

        headers: {
          "x-company-id": COMPANY,
        },
      },
      true,
      403,
    );

    await test(
      "MATCHING_COMPANY",
      {
        authUser: admin,
        tenantContext: tenant(COMPANY),
      },
      true,
      "allowed",
    );

    console.log(
      "CM_SECURITY_REAL_CONTRACT_PASSED",
    );
  } finally {
    if (originalFlag === undefined) {
      delete process.env
        .CM_DASHBOARD_ENABLED;
    } else {
      process.env.CM_DASHBOARD_ENABLED =
        originalFlag;
    }
  }
}

main().catch(error => {
  console.error(
    "CM_SECURITY_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
