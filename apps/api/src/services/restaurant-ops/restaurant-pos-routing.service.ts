/**
 * Delibocados POS routing contract.
 *
 * Pure, side-effect-free policy. In particular, this module DOES NOT send an
 * order to Toteat or POS360, authenticate a QR token, or assert print success.
 * The future outbox worker must validate the restaurant and source at the
 * server boundary and preserve one destination per internal order.
 */
export type RestaurantOrderSource = "whatsapp" | "qr" | "web" | "panel" | "external";
export type RestaurantFulfillment = "pickup" | "delivery" | "dine_in";
export type RestaurantPos = "toteat" | "pos360";
export type RouteBlockReason =
  | "WRONG_COMPANY"
  | "CUSTOMER_CONFIRMATION_REQUIRED"
  | "ORDER_NOT_CONFIRMABLE"
  | "PAYMENT_REVIEW_REQUIRED"
  | "UNSUPPORTED_WHATSAPP_FULFILLMENT"
  | "QR_TABLE_VERIFICATION_REQUIRED"
  | "QR_DINE_IN_REQUIRED"
  | "MANUAL_SOURCE_ROUTING_REQUIRED";

export type RouteInput = {
  companyId: string;
  source: RestaurantOrderSource;
  fulfillmentMode: RestaurantFulfillment;
  orderStatus: "confirmed" | "preparing" | "ready" | "out_for_delivery" | "completed" | "cancelled";
  customerConfirmed: boolean;
  paymentStatus: "pending" | "proof_submitted" | "verified" | "cash_on_delivery" | "refunded";
  /**
   * Only the backend can construct this after validating an active table's
   * non-guessable QR token / server-side table selection. Never trust a browser
   * boolean or table name as verified identity.
   */
  verifiedTable?: { id: string; validatedServerSide: true };
  qrKind?: "table" | "general";
};
export type RouteResult =
  | { ready: true; provider: RestaurantPos; reason: "READY"; tableId?: string }
  | { ready: false; provider: RestaurantPos | null; reason: RouteBlockReason };

export function decideDelibocadosPosRoute(order: RouteInput): RouteResult {
  if (order.companyId !== "delibocados") {
    return { ready: false, provider: null, reason: "WRONG_COMPANY" };
  }
  if (!order.customerConfirmed) {
    return { ready: false, provider: null, reason: "CUSTOMER_CONFIRMATION_REQUIRED" };
  }
  if (order.orderStatus !== "confirmed") {
    return { ready: false, provider: null, reason: "ORDER_NOT_CONFIRMABLE" };
  }

  if (order.source === "whatsapp") {
    if (!["pickup", "delivery"].includes(order.fulfillmentMode)) {
      return { ready: false, provider: "toteat", reason: "UNSUPPORTED_WHATSAPP_FULFILLMENT" };
    }
    // A user-supplied screenshot is NOT proof that a bank transfer settled.
    if (!["verified", "cash_on_delivery"].includes(order.paymentStatus)) {
      return { ready: false, provider: "toteat", reason: "PAYMENT_REVIEW_REQUIRED" };
    }
    return { ready: true, provider: "toteat", reason: "READY" };
  }

  if (order.source === "qr") {
    if (order.fulfillmentMode !== "dine_in") {
      return { ready: false, provider: "pos360", reason: "QR_DINE_IN_REQUIRED" };
    }
    // Both table QR and general QR go to POS360, but only once an actual table
    // has been selected AND validated against the current restaurant floorplan.
    if (!order.qrKind || !["table", "general"].includes(order.qrKind) ||
      !order.verifiedTable?.id?.trim() ||
      order.verifiedTable.validatedServerSide !== true) {
      return { ready: false, provider: "pos360", reason: "QR_TABLE_VERIFICATION_REQUIRED" };
    }
    return { ready: true, provider: "pos360", reason: "READY", tableId: order.verifiedTable.id };
  }

  // Never silently fall back to either POS for a website or staff-entered order.
  return { ready: false, provider: null, reason: "MANUAL_SOURCE_ROUTING_REQUIRED" };
}
