/**
 * Validates the documented Toteat "Monitoreo de las Ordenes" webhook envelope.
 * This module is pure: no HTTP, database or WhatsApp side effects.
 *
 * A deliveryStatusId of 90 says Toteat reported "Impreso en Cocina";
 * it does NOT prove the physical printer emitted a ticket.
 */
export type ToteatStatusEvent = {
  reference: string;
  externalOrderId: string;
  deliveryStatusId: number | null;
  orderStatus: string;
  modificationDate: string | null;
};
export type LocalOrderState =
  "confirmed" | "preparing" | "ready" | "out_for_delivery" |
  "completed" | "cancelled";

export type SafeTransition = {
  nextStatus: "preparing" | "ready" | "out_for_delivery" | "completed";
  reason: string;
};

function record(value: unknown): Record<string,unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string,unknown> : null;
}
const refPattern = /^delibocados-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseToteatOrderWebhook(
  body: unknown,
  expectedRestaurantId: string,
  expectedLocalNumber: string
): ToteatStatusEvent[] {
  const envelope = record(body);
  if (!envelope || envelope.ok !== true ||
      String(envelope.restaurantId ?? "") !== expectedRestaurantId ||
      String(envelope.localNumber ?? "") !== expectedLocalNumber ||
      !Array.isArray(envelope.data) || envelope.data.length > 50) {
    throw new Error("TOTEAT_WEBHOOK_ENVELOPE_INVALID");
  }
  const events: ToteatStatusEvent[] = [];
  for (const raw of envelope.data) {
    const entry = record(raw);
    if (!entry) throw new Error("TOTEAT_WEBHOOK_ORDER_INVALID");
    const reference = String(entry.orderReference ?? "");
    // Never accept another tenant, a test UUID without prefix, or free-form refs.
    if (!refPattern.test(reference)) throw new Error("TOTEAT_WEBHOOK_REFERENCE_INVALID");
    const id = entry.orderId;
    if (id != null && !/^[1-9][0-9]{0,19}$/.test(String(id)))
      throw new Error("TOTEAT_WEBHOOK_ORDER_ID_INVALID");
    // Toteat can return a 16-digit integer; JSON.parse may round it.
    // If it is unsafe, rely on the authenticated orderReference only.
    const verifiedExternalId = typeof id === "number" && !Number.isSafeInteger(id)
      ? "" : id == null ? "" : String(id);
    const rawStatus = entry.deliveryStatusId;
    const deliveryStatusId = rawStatus == null ? null : Number(rawStatus);
    if (deliveryStatusId !== null && !Number.isSafeInteger(deliveryStatusId))
      throw new Error("TOTEAT_WEBHOOK_STATUS_INVALID");
    const modificationDate =
      typeof entry.modificationDate === "string" && !Number.isNaN(Date.parse(entry.modificationDate))
        ? entry.modificationDate : null;
    events.push({
      reference,
      externalOrderId: verifiedExternalId,
      deliveryStatusId,
      orderStatus: String(entry.orderStatus ?? "").toUpperCase(),
      modificationDate
    });
  }
  return events;
}

/** Only advance ONE permitted state at a time. Never infer payment or printing. */
export function toteatSafeTransition(
  current: LocalOrderState,
  fulfillment: "pickup" | "delivery",
  courierAssigned: boolean,
  event: ToteatStatusEvent
): SafeTransition | null {
  if (current === "cancelled" || current === "completed") return null;
  // Cancelled/closed status without a confirmed delivery state is for operator review.
  if (event.orderStatus === "CANCELLED" ||
      [170,172,175,200].includes(event.deliveryStatusId ?? -1)) return null;
  if (current === "confirmed" && event.deliveryStatusId === 100)
    return {nextStatus:"preparing",reason:"TOTEAT_PREPARING"};
  if (current === "preparing" && event.deliveryStatusId === 110)
    return {nextStatus:"ready",reason:"TOTEAT_READY"};
  if (current === "ready" && fulfillment === "delivery" &&
      courierAssigned && event.deliveryStatusId === 120)
    return {nextStatus:"out_for_delivery",reason:"TOTEAT_OUT_FOR_DELIVERY"};
  if ((current === "ready" && fulfillment === "pickup" ||
       current === "out_for_delivery" && fulfillment === "delivery") &&
      event.deliveryStatusId === 180)
    return {nextStatus:"completed",reason:"TOTEAT_DELIVERED"};
  return null;
}

/** Explicitly distinct from a kitchen ticket printed_at timestamp. */
export function toteatStateLabel(id: number | null): string {
  const labels: Record<number,string> = {
    40:"Nuevo",90:"Toteat reporta impresión",100:"En preparación",
    110:"Listo",120:"En reparto",180:"Entregado",
    170:"Cancelado por cliente",172:"Cancelado",175:"No recibido",
    200:"Recaudación recibida en local"
  };
  return id == null ? "Sin estado de delivery" : labels[id] ?? "Desconocido";
}
