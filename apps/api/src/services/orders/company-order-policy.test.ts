import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateOrderAccess,
  type OrderAccessRequest,
} from "./company-order-policy.js";

const base: OrderAccessRequest = {
  companyId: "delibocados",
  resourceCompanyId: "delibocados",
  adapter: "toteat",
  allowedAdapters: ["toteat"],
  ordersEnabled: true,
  integrationVerified: true,
  actorAuthorized: true,
  customerConfirmed: true,
};

test("rechaza operaciones entre empresas", () => {
  const result = evaluateOrderAccess({
    ...base,
    resourceCompanyId: "fulanitas",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "COMPANY_SCOPE_MISMATCH");
});

test("rechaza integraciones no verificadas", () => {
  const result = evaluateOrderAccess({
    ...base,
    integrationVerified: false,
  });

  assert.equal(result.allowed, false);
});

test("rechaza operaciones sin confirmacion", () => {
  const result = evaluateOrderAccess({
    ...base,
    customerConfirmed: false,
  });

  assert.equal(result.allowed, false);
});

test("rechaza adaptadores no autorizados", () => {
  const result = evaluateOrderAccess({
    ...base,
    adapter: "ninox",
  });

  assert.equal(result.allowed, false);
});

test("rechaza pedidos deshabilitados", () => {
  const result = evaluateOrderAccess({
    ...base,
    ordersEnabled: false,
  });

  assert.equal(result.allowed, false);
});

test("autoriza cuando todas las condiciones se cumplen", () => {
  const result = evaluateOrderAccess(base);

  assert.equal(result.allowed, true);
  assert.equal(result.reason, "AUTHORIZED");
});
