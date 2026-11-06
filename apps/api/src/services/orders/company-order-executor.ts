import {
  evaluateOrderAccess,
  type OrderAccessRequest,
} from "./company-order-policy.js";

export type CompanyOrderOperation = {
  companyId: string;
  resourceCompanyId: string;
  operation: "create" | "modify" | "cancel";
  orderId?: string;
  idempotencyKey: string;
};

export type OrderExecutionResult = {
  executed: boolean;
  reason: string;
};

export async function executeCompanyOrder(
  operation: CompanyOrderOperation,
  access: OrderAccessRequest,
  adapter: (
    operation: CompanyOrderOperation
  ) => Promise<void>,
): Promise<OrderExecutionResult> {
  if (
    operation.companyId !== access.companyId ||
    operation.resourceCompanyId !== access.resourceCompanyId
  ) {
    return {
      executed: false,
      reason: "OPERATION_SCOPE_MISMATCH",
    };
  }

  const decision = evaluateOrderAccess(access);

  if (!decision.allowed) {
    return {
      executed: false,
      reason: decision.reason,
    };
  }

  if (!operation.idempotencyKey.trim()) {
    return {
      executed: false,
      reason: "IDEMPOTENCY_KEY_REQUIRED",
    };
  }

  await adapter(operation);

  return {
    executed: true,
    reason: "EXECUTED",
  };
}
