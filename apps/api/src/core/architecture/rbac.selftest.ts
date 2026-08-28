import assert from "node:assert/strict";

import {
  ACCESS_ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  assertRolePolicyIntegrity,
  roleHasPermission,
} from "../authorization/index.js";

assertRolePolicyIntegrity();

assert.equal(
  ACCESS_ROLES.length,
  7,
);

assert.equal(
  ROLE_PERMISSIONS
    .superadmin
    .length,
  PERMISSIONS.length,
);

assert.equal(
  roleHasPermission(
    "owner",
    "integrations.manage",
  ),
  true,
);

assert.equal(
  roleHasPermission(
    "admin",
    "payments.refund",
  ),
  false,
);

assert.equal(
  roleHasPermission(
    "supervisor",
    "payments.confirm",
  ),
  true,
);

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
    "operario",
    "payments.confirm",
  ),
  false,
);

assert.equal(
  roleHasPermission(
    "solo_lectura",
    "orders.read",
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

for (
  const permission
  of ROLE_PERMISSIONS
    .solo_lectura
) {
  assert.equal(
    permission.endsWith(".read"),
    true,
  );
}

console.log(
  "✅ Siete roles verificados.",
);

console.log(
  "✅ Superadmin completo.",
);

console.log(
  "✅ Owner verificado.",
);

console.log(
  "✅ Admin sin reembolsos.",
);

console.log(
  "✅ Supervisor verificado.",
);

console.log(
  "✅ Vendedor restringido.",
);

console.log(
  "✅ Operario restringido.",
);

console.log(
  "✅ Solo lectura restringido.",
);

console.log(
  "✅ RBAC SELFTEST PASSED",
);
