export const PERMISSIONS = [
  "platform.read",
  "platform.companies.manage",
  "platform.users.manage",
  "platform.billing.manage",
  "platform.integrations.manage",
  "platform.audit.read",

  "company.read",
  "company.settings.read",
  "company.settings.manage",
  "company.users.read",
  "company.users.manage",
  "company.billing.read",

  "privacy.requests.read",
  "privacy.requests.manage",
  "privacy.requests.verify",
  "privacy.requests.approve",
  "privacy.exports.create",
  "privacy.erasure.execute",
  "privacy.consents.read",
  "privacy.consents.manage",
  "privacy.policies.read",
  "privacy.policies.manage",
  "privacy.audit.read",

  "integrations.read",
  "integrations.manage",

  "conversations.read",
  "conversations.reply",
  "conversations.takeover",
  "conversations.assign",
  "conversations.close",

  "voice.read",
  "voice.manage",
  "voice.call",
  "voice.takeover",

  "crm.read",
  "crm.manage",

  "catalog.read",
  "catalog.manage",

  "pricing.read",
  "pricing.manage",

  "stock.read",
  "stock.adjust",
  "stock.transfer",

  "orders.read",
  "orders.create",
  "orders.update",
  "orders.cancel",

  "payments.read",
  "payments.confirm",
  "payments.refund",

  "fulfillment.read",
  "fulfillment.manage",

  "shipments.read",
  "shipments.manage",

  "campaigns.read",
  "campaigns.manage",

  "prompts.read",
  "prompts.manage",

  "analytics.read",
  "audit.read",
] as const;

export type Permission =
  (typeof PERMISSIONS)[number];

const permissionSet =
  new Set<string>(PERMISSIONS);

export function isPermission(
  value: unknown,
): value is Permission {
  return (
    typeof value === "string"
    && permissionSet.has(value)
  );
}

export function isPlatformPermission(
  permission: Permission,
): boolean {
  return permission.startsWith(
    "platform.",
  );
}

export function isCompanyPermission(
  permission: Permission,
): boolean {
  return !isPlatformPermission(
    permission,
  );
}
