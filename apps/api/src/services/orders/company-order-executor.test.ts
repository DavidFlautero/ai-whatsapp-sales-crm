import test from "node:test";
import assert from "node:assert/strict";

import {
  executeCompanyOrder,
  type CompanyOrderOperation,
} from "./company-order-executor.js";

import type {
  OrderAccessRequest,
} from "./company-order-policy.js";

const operation: CompanyOrderOperation = {
  companyId: "delibocados",
  resourceCompanyId: "delibocados",
  operation: "create",
  idempotencyKey: "test-001",
};

const access: OrderAccessRequest = {
  companyId: "delibocados",
  resourceCompanyId: "delibocados",
  adapter: "toteat",
  allowedAdapters: ["toteat"],
  ordersEnabled: true,
  integrationVerified: true,
  actorAuthorized: true,
  customerConfirmed: true,
};

test("bloquea pedidos de otra empresa", async () => {
  let calls = 0;

  const result = await executeCompanyOrder(
    { ...operation, resourceCompanyId: "fulanitas" },
    access,
    async () => { calls++; },
  );

  assert.equal(result.executed, false);
  assert.equal(calls, 0);
});

test("bloquea integraciones no verificadas", async () => {
  let calls = 0;

  const result = await executeCompanyOrder(
    operation,
    { ...access, integrationVerified: false },
    async () => { calls++; },
  );

  assert.equal(result.executed, false);
  assert.equal(calls, 0);
});

test("bloquea pedidos sin confirmacion", async () => {
  let calls = 0;

  const result = await executeCompanyOrder(
    operation,
    { ...access, customerConfirmed: false },
    async () => { calls++; },
  );

  assert.equal(result.executed, false);
  assert.equal(calls, 0);
});

test("exige clave de idempotencia", async () => {
  let calls = 0;

  const result = await executeCompanyOrder(
    { ...operation, idempotencyKey: "" },
    access,
    async () => { calls++; },
  );

  assert.equal(result.executed, false);
  assert.equal(calls, 0);
});

test("ejecuta adaptador autorizado", async () => {
  let calls = 0;

  const result = await executeCompanyOrder(
    operation,
    access,
    async () => { calls++; },
  );

  assert.equal(result.executed, true);
  assert.equal(calls, 1);
});

test("no reporta exito si falla el adaptador", async () => {
  await assert.rejects(
    executeCompanyOrder(
      operation,
      access,
      async () => {
        throw new Error("ADAPTER_FAILED");
      },
    ),
    /ADAPTER_FAILED/,
  );
});
