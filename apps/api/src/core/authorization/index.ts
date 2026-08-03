export {
  PERMISSIONS,
  isPermission,
  isPlatformPermission,
  isCompanyPermission,
} from "./permission.catalog.js";

export type {
  Permission,
} from "./permission.catalog.js";

export {
  ACCESS_ROLES,
  isAccessRole,
} from "./authorization.types.js";

export type {
  AccessRole,
  AccessActor,
  AccessDecision,
  AccessDecisionCode,
} from "./authorization.types.js";

export {
  ROLE_PERMISSIONS,
  permissionsForRole,
  roleHasPermission,
  assertRolePolicyIntegrity,
} from "./role-policy.js";

export {
  decideAccess,
  assertAccess,
  AuthorizationError,
} from "./authorization.service.js";

export type {
  DecideAccessInput,
} from "./authorization.service.js";
