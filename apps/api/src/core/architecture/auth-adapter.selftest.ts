import assert from "node:assert/strict";

import {
  toAccessActor,
  AuthActorAdapterError,
} from "../auth-adapter/index.js";

const owner =
  toAccessActor({
    id: "owner-1",
    name: "Owner",
    email: "OWNER@EXAMPLE.COM",
    role: "owner",
    companyId: "FULANITAS",
    active: true,
  });

assert.equal(
  owner.companyId,
  "fulanitas",
);

assert.equal(
  owner.email,
  "owner@example.com",
);

const superadmin =
  toAccessActor({
    id: "superadmin-1",
    name: "Superadmin",
    email: "admin@example.com",
    role: "superadmin",
    companyId: "ignored-company",
    active: true,
  });

assert.equal(
  superadmin.companyId,
  null,
);

assert.throws(
  () =>
    toAccessActor({
      id: "seller-1",
      name: "Seller",
      email: "seller@example.com",
      role: "vendedor",
      companyId: null,
      active: true,
    }),

  (error: unknown) =>
    error
      instanceof AuthActorAdapterError
    && error.code
      === "COMPANY_REQUIRED",
);

console.log(
  "✅ Existing SessionUser adapted",
);

console.log(
  "✅ Company normalized",
);

console.log(
  "✅ Superadmin company removed",
);

console.log(
  "✅ Missing company rejected",
);

console.log(
  "✅ AUTH ADAPTER SELFTEST PASSED",
);
