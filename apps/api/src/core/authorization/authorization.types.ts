import type {
  Permission,
} from "./permission.catalog.js";

export const ACCESS_ROLES = [
  "superadmin",
  "owner",
  "admin",
  "supervisor",
  "vendedor",
  "operario",
  "solo_lectura",
] as const;

export type AccessRole =
  (typeof ACCESS_ROLES)[number];

const roleSet =
  new Set<string>(ACCESS_ROLES);

export function isAccessRole(
  value: unknown,
): value is AccessRole {
  return (
    typeof value === "string"
    && roleSet.has(value)
  );
}

export type AccessActor = {
  id: string;
  name: string;
  email: string;

  role: AccessRole;
  companyId: string | null;

  active: boolean;
};

export type AccessDecisionCode =
  | "ALLOWED"
  | "ACTOR_INACTIVE"
  | "TENANT_REQUIRED"
  | "TENANT_MISMATCH"
  | "PLATFORM_CONTEXT_REQUIRED"
  | "COMPANY_CONTEXT_REQUIRED"
  | "PERMISSION_NOT_GRANTED";

export type AccessDecision = {
  allowed: boolean;
  code: AccessDecisionCode;

  permission: Permission;

  actorId: string;
  role: AccessRole;

  effectiveCompanyId: string | null;
};
