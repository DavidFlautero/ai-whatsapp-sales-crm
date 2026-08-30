import {
  ACCESS_ROLES,
  type AccessRole,
} from "./authorization.types.js";

import {
  PERMISSIONS,
  isCompanyPermission,
  type Permission,
} from "./permission.catalog.js";

const companyPermissions:
  readonly Permission[] =
    PERMISSIONS.filter(
      isCompanyPermission,
    );

const readOnlyPermissions:
  readonly Permission[] =
    companyPermissions.filter(
      (permission) =>
        permission.endsWith(".read"),
    );

function definePermissions(
  ...permissions: Permission[]
): readonly Permission[] {
  return permissions;
}

export const ROLE_PERMISSIONS:
  Readonly<
    Record<
      AccessRole,
      readonly Permission[]
    >
  > = {
  superadmin: [
    ...PERMISSIONS,
  ],

  owner: [
    ...companyPermissions,
  ],

  admin:
    companyPermissions.filter(
      (permission) =>
        permission
        !== "payments.refund"
        && permission
        !== "privacy.requests.approve"
        && permission
        !== "privacy.erasure.execute",
    ),

  supervisor: definePermissions(
    "company.read",
    "company.settings.read",
    "company.users.read",

    "privacy.requests.read",
    "privacy.requests.manage",
    "privacy.requests.verify",
    "privacy.consents.read",
    "privacy.policies.read",
    "privacy.audit.read",

    "integrations.read",

    "conversations.read",
    "conversations.reply",
    "conversations.takeover",
    "conversations.assign",
    "conversations.close",

    "voice.read",
    "voice.call",
    "voice.takeover",

    "crm.read",
    "crm.manage",

    "catalog.read",
    "catalog.manage",
    "pricing.read",

    "stock.read",
    "stock.adjust",
    "stock.transfer",

    "orders.read",
    "orders.create",
    "orders.update",
    "orders.cancel",

    "payments.read",
    "payments.confirm",

    "fulfillment.read",
    "fulfillment.manage",

    "shipments.read",
    "shipments.manage",

    "campaigns.read",
    "campaigns.manage",

    "prompts.read",
    "analytics.read",
    "audit.read",
  ),

  vendedor: definePermissions(
    "company.read",
    "company.settings.read",

    "conversations.read",
    "conversations.reply",
    "conversations.takeover",
    "conversations.close",

    "voice.read",
    "voice.call",
    "voice.takeover",

    "crm.read",
    "crm.manage",

    "catalog.read",
    "pricing.read",
    "stock.read",

    "orders.read",
    "orders.create",
    "orders.update",

    "payments.read",

    "fulfillment.read",
    "shipments.read",

    "campaigns.read",
    "analytics.read",
  ),

  operario: definePermissions(
    "company.read",

    "catalog.read",
    "stock.read",

    "orders.read",

    "fulfillment.read",
    "fulfillment.manage",

    "shipments.read",
    "shipments.manage",
  ),

  solo_lectura: [
    ...readOnlyPermissions,
  ],
};

export function permissionsForRole(
  role: AccessRole,
): ReadonlySet<Permission> {
  return new Set<Permission>(
    ROLE_PERMISSIONS[role],
  );
}

export function roleHasPermission(
  role: AccessRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[
    role
  ].includes(permission);
}

export function assertRolePolicyIntegrity(): void {
  const knownPermissions =
    new Set<Permission>(
      PERMISSIONS,
    );

  for (const role of ACCESS_ROLES) {
    const permissions =
      ROLE_PERMISSIONS[role];

    const uniquePermissions =
      new Set<Permission>(
        permissions,
      );

    if (
      uniquePermissions.size
      !== permissions.length
    ) {
      throw new Error(
        `Permisos duplicados en el rol ${role}.`,
      );
    }

    for (const permission of permissions) {
      if (
        !knownPermissions.has(
          permission,
        )
      ) {
        throw new Error(
          `Permiso desconocido en ${role}: ${permission}`,
        );
      }
    }
  }

  if (
    ROLE_PERMISSIONS
      .superadmin
      .length
    !== PERMISSIONS.length
  ) {
    throw new Error(
      "Superadmin no contiene todos los permisos.",
    );
  }
}
