export type OrderStatus =
  | "new"
  | "interested"
  | "draft"
  | "pending_payment"
  | "paid"
  | "sent"
  | "cancelled";

export async function createDraftOrder() {
  return {
    id: crypto.randomUUID(),
    status: "draft" satisfies OrderStatus
  };
}
