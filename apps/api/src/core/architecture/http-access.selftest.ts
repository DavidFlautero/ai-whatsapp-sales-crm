import assert from "node:assert/strict";

import type {
  NextFunction,
  Request,
  Response,
} from "express";

import type {
  SessionUser,
} from "../../auth/auth.types.js";

import {
  requirePermission,
  resolveAccessContext,
} from "../http/index.js";

type ResponseState = {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
};

function createResponse(): {
  response: Response;
  state: ResponseState;
} {
  const state: ResponseState = {
    statusCode: 200,
    body: null,
    headers: {},
  };

  const response = {
    status(
      statusCode: number,
    ) {
      state.statusCode =
        statusCode;

      return this;
    },

    json(
      body: unknown,
    ) {
      state.body =
        body;

      return this;
    },

    setHeader(
      name: string,
      value: string | number,
    ) {
      state.headers[
        name.toLowerCase()
      ] = String(value);

      return this;
    },
  } as unknown as Response;

  return {
    response,
    state,
  };
}

function createRequest(
  user: SessionUser,
  options: {
    headers?:
      Record<string, string>;

    params?:
      Record<string, string>;
  } = {},
): Request {
  const headers =
    options.headers
    ?? {};

  return {
    authUser:
      user,

    accessActor:
      undefined,

    tenantContext:
      undefined,

    requestContext:
      undefined,

    accessDecision:
      undefined,

    headers,

    params:
      options.params
      ?? {},

    ip:
      "127.0.0.1",

    socket: {
      remoteAddress:
        "127.0.0.1",
    },

    get(
      name: string,
    ) {
      return headers[
        name.toLowerCase()
      ];
    },
  } as unknown as Request;
}

function executeMiddleware(
  middleware: (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => unknown,

  request: Request,
) {
  const {
    response,
    state,
  } = createResponse();

  let nextCalled =
    false;

  let forwardedError:
    unknown = null;

  const next = (
    error?: unknown,
  ) => {
    if (error) {
      forwardedError =
        error;

      return;
    }

    nextCalled =
      true;
  };

  middleware(
    request,
    response,
    next as NextFunction,
  );

  return {
    request,
    state,
    nextCalled,
    forwardedError,
  };
}

const owner: SessionUser = {
  id: "owner-1",
  name: "Owner",
  email: "owner@example.com",
  role: "owner",
  companyId: "fulanitas",
  active: true,
};

const seller: SessionUser = {
  id: "seller-1",
  name: "Seller",
  email: "seller@example.com",
  role: "vendedor",
  companyId: "fulanitas",
  active: true,
};

const superadmin: SessionUser = {
  id: "superadmin-1",
  name: "Superadmin",
  email: "admin@example.com",
  role: "superadmin",
  companyId: null,
  active: true,
};

/*
 * Owner dentro de su empresa.
 */

const ownerRequest =
  createRequest(owner);

const ownerContextResult =
  executeMiddleware(
    resolveAccessContext({
      mode: "company",
    }),
    ownerRequest,
  );

assert.equal(
  ownerContextResult.forwardedError,
  null,
);

assert.equal(
  ownerContextResult.nextCalled,
  true,
);

assert.equal(
  ownerRequest
    .tenantContext
    ?.effectiveCompanyId,
  "fulanitas",
);

assert.match(
  ownerRequest
    .requestContext
    ?.requestId
    ?? "",
  /^[A-Za-z0-9._:-]{8,128}$/,
);

const ownerPermissionResult =
  executeMiddleware(
    requirePermission(
      "integrations.manage",
    ),
    ownerRequest,
  );

assert.equal(
  ownerPermissionResult.nextCalled,
  true,
);

assert.equal(
  ownerRequest
    .accessDecision
    ?.allowed,
  true,
);

/*
 * Vendedor intentando acceder a otra empresa.
 */

const foreignCompanyRequest =
  createRequest(
    seller,
    {
      headers: {
        "x-company-id":
          "otra-empresa",
      },
    },
  );

const foreignCompanyResult =
  executeMiddleware(
    resolveAccessContext({
      mode: "company",
    }),
    foreignCompanyRequest,
  );

assert.equal(
  foreignCompanyResult.nextCalled,
  false,
);

assert.equal(
  foreignCompanyResult
    .state
    .statusCode,
  403,
);

assert.deepEqual(
  foreignCompanyResult
    .state
    .body,
  {
    ok: false,
    error:
      "COMPANY_CONTEXT_MISMATCH",
    requestId: null,
  },
);

/*
 * Superadmin sin selección explícita.
 */

const superadminWithoutCompany =
  executeMiddleware(
    resolveAccessContext({
      mode: "company",
    }),
    createRequest(
      superadmin,
    ),
  );

assert.equal(
  superadminWithoutCompany
    .nextCalled,
  false,
);

assert.equal(
  superadminWithoutCompany
    .state
    .statusCode,
  400,
);

/*
 * Superadmin seleccionando empresa.
 */

const superadminCompanyRequest =
  createRequest(
    superadmin,
    {
      headers: {
        "x-company-id":
          "fulanitas",

        "x-request-id":
          "superadmin-test-0001",
      },
    },
  );

const superadminCompanyResult =
  executeMiddleware(
    resolveAccessContext({
      mode: "company",
    }),
    superadminCompanyRequest,
  );

assert.equal(
  superadminCompanyResult
    .forwardedError,
  null,
);

assert.equal(
  superadminCompanyResult
    .nextCalled,
  true,
);

assert.equal(
  superadminCompanyRequest
    .tenantContext
    ?.effectiveCompanyId,
  "fulanitas",
);

assert.equal(
  superadminCompanyRequest
    .tenantContext
    ?.superadminImpersonation,
  true,
);

assert.equal(
  superadminCompanyRequest
    .requestContext
    ?.requestId,
  "superadmin-test-0001",
);

/*
 * Vendedor sin permiso de integraciones.
 */

const sellerRequest =
  createRequest(seller);

const sellerContextResult =
  executeMiddleware(
    resolveAccessContext({
      mode: "company",
    }),
    sellerRequest,
  );

assert.equal(
  sellerContextResult.nextCalled,
  true,
);

const deniedIntegrationResult =
  executeMiddleware(
    requirePermission(
      "integrations.manage",
    ),
    sellerRequest,
  );

assert.equal(
  deniedIntegrationResult.nextCalled,
  false,
);

assert.equal(
  deniedIntegrationResult
    .state
    .statusCode,
  403,
);

assert.equal(
  sellerRequest
    .accessDecision
    ?.allowed,
  false,
);

assert.equal(
  sellerRequest
    .accessDecision
    ?.code,
  "PERMISSION_NOT_GRANTED",
);

/*
 * El mismo acceso en modo observación.
 */

const shadowSellerRequest =
  createRequest(seller);

executeMiddleware(
  resolveAccessContext({
    mode: "company",
  }),
  shadowSellerRequest,
);

const shadowResult =
  executeMiddleware(
    requirePermission(
      "integrations.manage",
      {
        mode: "shadow",
      },
    ),
    shadowSellerRequest,
  );

assert.equal(
  shadowResult.nextCalled,
  true,
);

assert.equal(
  shadowSellerRequest
    .accessDecision
    ?.allowed,
  false,
);

/*
 * Owner intentando entrar al contexto global.
 */

const ownerPlatformResult =
  executeMiddleware(
    resolveAccessContext({
      mode: "platform",
    }),
    createRequest(owner),
  );

assert.equal(
  ownerPlatformResult.nextCalled,
  false,
);

assert.equal(
  ownerPlatformResult
    .state
    .statusCode,
  403,
);

console.log(
  "✅ Contexto empresarial del owner.",
);

console.log(
  "✅ Permiso empresarial concedido.",
);

console.log(
  "✅ Acceso entre empresas bloqueado.",
);

console.log(
  "✅ Superadmin requiere empresa explícita.",
);

console.log(
  "✅ Impersonación empresarial detectada.",
);

console.log(
  "✅ Request ID propagado.",
);

console.log(
  "✅ Vendedor restringido.",
);

console.log(
  "✅ Modo shadow funcionando.",
);

console.log(
  "✅ Contexto global aislado.",
);

console.log(
  "✅ HTTP ACCESS SELFTEST PASSED",
);
