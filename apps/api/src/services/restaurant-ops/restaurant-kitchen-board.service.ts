/**
 * Delibocados kitchen audit projection (READ ONLY).
 * A local ticket and a database printed_at timestamp are never treated as
 * physical POS acceptance or observed printer output.
 */
export type KitchenOrder = {
  id: string; number: number; source: string; fulfillment_mode: string;
  status: string; payment_status: string; created_at: string;
  preparing_at?: string | null; ready_at?: string | null;
};
export type KitchenTicket = {
  id: string; order_id: string; status: string; queued_at: string;
  started_at?: string | null; ready_at?: string | null;
  printed_at?: string | null;
};
export type KitchenExport = {
  order_id: string; provider: string; status: string;
  attempts: number; accepted_at?: string | null;
};
export type KitchenAlert =
  "TICKET_FALTANTE" |
  "PAGO_PENDIENTE_DE_REVISION" |
  "COBRO_NO_CONFIRMADO_EN_SISTEMA" |
  "COCINA_DESINCRONIZADA" |
  "DEMORA_POSIBLE" |
  "POS_ESTADO_INCIERTO";
export type KitchenBoardEntry = {
  orderId: string; number: number; source: string; fulfillment: string;
  status: string; paymentStatus: string; ticketStatus: string | null;
  printEvidence: "db_timestamp" | "not_recorded";
  posProvider: string | null; posExportStatus: string | null;
  minutesElapsed: number; alerts: KitchenAlert[];
};
export type KitchenBoard = {
  entries: KitchenBoardEntry[];
  summary: {
    totalRecent: number; active: number; queued: number; working: number;
    ready: number; paymentHeld: number; missingTicket: number;
    printTimestampRecorded: number; completedCashUnconfirmed: number;
    possibleDelays: number; ambiguousPos: number;
  };
  evidenceNotice: string;
  truncated: boolean;
};

const activeStates = new Set(["confirmed","preparing","ready"]);
const paymentAllowed = new Set(["verified","cash_on_delivery"]);

export function buildKitchenBoard(
  orders: KitchenOrder[],
  tickets: KitchenTicket[],
  exports: KitchenExport[],
  nowMs: number,
  truncated = false
): KitchenBoard {
  const ticketByOrder = new Map(tickets.map(t => [t.order_id,t]));
  const exportByOrder = new Map(exports.map(x => [x.order_id,x]));
  const entries: KitchenBoardEntry[] = orders.map(order => {
    const ticket = ticketByOrder.get(order.id);
    const pos = exportByOrder.get(order.id);
    const alerts: KitchenAlert[] = [];
    const active = activeStates.has(order.status);
    if(active && !ticket)alerts.push("TICKET_FALTANTE");
    if(active && !paymentAllowed.has(order.payment_status))
      alerts.push("PAGO_PENDIENTE_DE_REVISION");
    if(order.status==="completed" && order.payment_status==="cash_on_delivery")
      alerts.push("COBRO_NO_CONFIRMADO_EN_SISTEMA");
    if(ticket && (
      (order.status==="preparing" && ticket.status!=="working") ||
      (order.status==="ready" && ticket.status!=="ready")
    ))alerts.push("COCINA_DESINCRONIZADA");
    const timestamp=order.status==="preparing" && order.preparing_at
      ? Date.parse(order.preparing_at) : Date.parse(order.created_at);
    const minutesElapsed=Number.isFinite(timestamp)
      ? Math.max(0,Math.floor((nowMs-timestamp)/60000)) : 0;
    if(order.status==="preparing" && minutesElapsed>30)alerts.push("DEMORA_POSIBLE");
    if(pos && ["unknown","sending"].includes(pos.status))
      alerts.push("POS_ESTADO_INCIERTO");
    return {
      orderId:order.id,number:order.number,source:order.source,
      fulfillment:order.fulfillment_mode,status:order.status,
      paymentStatus:order.payment_status,ticketStatus:ticket?.status??null,
      printEvidence:ticket?.printed_at?"db_timestamp":"not_recorded",
      posProvider:pos?.provider??null,posExportStatus:pos?.status??null,
      minutesElapsed,alerts
    };
  });
  const summary = {
    totalRecent:entries.length,
    active:entries.filter(x=>activeStates.has(x.status)).length,
    queued:entries.filter(x=>x.status==="confirmed"&&x.ticketStatus==="queued").length,
    working:entries.filter(x=>x.status==="preparing").length,
    ready:entries.filter(x=>x.status==="ready").length,
    paymentHeld:entries.filter(x=>x.alerts.includes("PAGO_PENDIENTE_DE_REVISION")).length,
    missingTicket:entries.filter(x=>x.alerts.includes("TICKET_FALTANTE")).length,
    printTimestampRecorded:entries.filter(x=>x.printEvidence==="db_timestamp").length,
    completedCashUnconfirmed:entries.filter(x=>x.alerts.includes("COBRO_NO_CONFIRMADO_EN_SISTEMA")).length,
    possibleDelays:entries.filter(x=>x.alerts.includes("DEMORA_POSIBLE")).length,
    ambiguousPos:entries.filter(x=>x.alerts.includes("POS_ESTADO_INCIERTO")).length
  };
  return {
    entries,summary,truncated,
    evidenceNotice:"La marca printed_at indica un registro en la base de datos, NO prueba de impresión física ni aceptación por el POS."
  };
}
