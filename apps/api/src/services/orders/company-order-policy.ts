export type OrderAdapter =
  | "ninox"
  | "toteat"
  | "pos360"
  | "native";

export type OrderAccessRequest = {
  companyId: string;
  resourceCompanyId: string;
  adapter: OrderAdapter;
  allowedAdapters: string[];
  ordersEnabled: boolean;
  integrationVerified: boolean;
  actorAuthorized: boolean;
  customerConfirmed: boolean;
};

export type OrderAccessDecision = {
  allowed: boolean;
  reason: string;
};

export function evaluateOrderAccess(
  input: OrderAccessRequest,
): OrderAccessDecision {
  const deny = (reason: string): OrderAccessDecision => ({
    allowed: false,
    reason,
  });

  if (
    !/^[a-z0-9][a-z0-9-]{0,63}$/.test(input.companyId) ||
    input.companyId !== input.resourceCompanyId
  ) {
    return deny("COMPANY_SCOPE_MISMATCH");
  }

  if (!input.ordersEnabled) {
    return deny("ORDERS_DISABLED");
  }

  if (!input.allowedAdapters.includes(input.adapter)) {
    return deny("ADAPTER_NOT_ALLOWED");
  }

  if (!input.integrationVerified) {
    return deny("INTEGRATION_NOT_VERIFIED");
  }

  if (!input.actorAuthorized) {
    return deny("ACTOR_NOT_AUTHORIZED");
  }

  if (!input.customerConfirmed) {
    return deny("CUSTOMER_CONFIRMATION_REQUIRED");
  }

  return {
    allowed: true,
    reason: "AUTHORIZED",
  };
}
