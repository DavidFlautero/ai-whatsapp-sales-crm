import { existsSync } from "node:fs";
import { getDelibocadosChannel } from "../whapi/delibocados-channel.service.js";
import { supabaseRequest, supabaseRpc } from "../db/supabase-rest.client.js";
import { saveMessage } from "../whapi/whapi-durable-message.service.js";

type QueueItem = { id: string; order_id: string; kind: string; attempts: number };
type Order = {
  id: string; number: number; status: string; fulfillment_mode: "pickup" | "delivery";
  customer_phone: string;
};
type PayloadRow = {
  id: string; order_id: string; kind: string; payload: Record<string, unknown>;
};
type TestResult = { disabled?: string; claimed: number; sent: number; failed: number; suppressed: number };

const COMPANY = "delibocados";
const STOP_FILE = "/root/delibocados-ai.stop";

function message(order: Order, kind: string, status: unknown): string | null {
  if (kind === "order_confirmed") {
    if (order.status !== "confirmed") return null;
    return "Delibocados: recibimos tu pedido #" + order.number + ". Ya quedó confirmado.";
  }
  if (kind !== "order_status_changed" || status !== order.status) return null;
  switch (order.status) {
    case "preparing":
      return "Delibocados: tu pedido #" + order.number + " está en preparación.";
    case "ready":
      return order.fulfillment_mode === "pickup"
        ? "Delibocados: tu pedido #" + order.number + " ya está listo para retirar en el local."
        : "Delibocados: tu pedido #" + order.number + " está listo para despacho.";
    case "out_for_delivery":
      return "Delibocados: tu pedido #" + order.number + " salió a domicilio.";
    case "completed":
      return "Delibocados: pedido #" + order.number + " registrado como entregado. ¡Gracias!";
    case "cancelled":
      return "Delibocados: pedido #" + order.number + " cancelado. Si necesitás ayuda, respondé por este chat.";
    default:
      return null;
  }
}

async function updateOutbox(id: string, status: "sent" | "failed" | "suppressed") {
  await supabaseRequest<unknown[]>({
    table: "restaurant_ops_outbox", method: "PATCH",
    query: "?company_id=eq.delibocados&id=eq." + encodeURIComponent(id) +
      "&status=eq.processing",
    prefer: "return=minimal",
    body: { status, ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}) }
  });
}

export async function dispatchDelibocadosTestNotifications(): Promise<TestResult> {
  // Explicit opt-in + existing AI stop switch. Never send in an ordinary deployment.
  if (process.env.DELIBOCADOS_ORDER_NOTIFICATIONS_TEST !== "1")
    return { disabled: "TEST_NOTIFICATIONS_DISABLED", claimed: 0, sent: 0, failed: 0, suppressed: 0 };
  if (existsSync(STOP_FILE))
    return { disabled: "DELIBOCADOS_MESSAGING_PAUSED", claimed: 0, sent: 0, failed: 0, suppressed: 0 };

  const config = await getDelibocadosChannel();
  if (!config.testPhone || !/^[0-9]{8,15}$/.test(config.testPhone))
    throw new Error("TEST_PHONE_REQUIRED");

  const claimed = await supabaseRpc<QueueItem[]>("restaurant_ops_claim_test_outbox", {
    p_company_id: COMPANY, p_test_phone: config.testPhone, p_max: 5
  });

  const result: TestResult = { claimed: claimed.length, sent: 0, failed: 0, suppressed: 0 };
  for (const job of claimed) {
    try {
      const [orders, rows] = await Promise.all([
        supabaseRequest<Order[]>({
          table: "restaurant_ops_orders",
          query: "?company_id=eq.delibocados&id=eq." + encodeURIComponent(job.order_id) +
            "&customer_phone=eq." + encodeURIComponent(config.testPhone) +
            "&select=id,number,status,fulfillment_mode,customer_phone&limit=1"
        }),
        supabaseRequest<PayloadRow[]>({
          table: "restaurant_ops_outbox",
          query: "?company_id=eq.delibocados&id=eq." + encodeURIComponent(job.id) +
            "&select=id,order_id,kind,payload&limit=1"
        })
      ]);
      const order = orders[0]; const record = rows[0];
      const text = order && record ? message(order,job.kind,record.payload?.status) : null;
      if (!text) { await updateOutbox(job.id, "suppressed"); result.suppressed++; continue; }
      // Race-safe, operator/AI control: recheck feature flag and test recipient before send.
      if (process.env.DELIBOCADOS_ORDER_NOTIFICATIONS_TEST !== "1" || existsSync(STOP_FILE)
          || order.customer_phone !== config.testPhone) {
        await updateOutbox(job.id,"suppressed"); result.suppressed++; continue;
      }
      const response = await fetch("https://gate.whapi.cloud/messages/text", {
        method: "POST",
        headers: { Authorization: "Bearer " + config.token, "Content-Type": "application/json" },
        body: JSON.stringify({ to: config.testPhone, body: text }),
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error("WHAPI_NOTIFY_HTTP_" + response.status);
      const sent = await response.json() as { id?: string; message?: { id?: string } };
      // Mark sent to provider BEFORE attempting CRM persistence; avoid resending on CRM error.
      await updateOutbox(job.id, "sent");
      result.sent++;
      try {
        await saveMessage({
          contact_phone: config.testPhone,
          external_message_id: sent.id ?? sent.message?.id,
          direction: "outbound", channel: "whatsapp", message_type: "text",
          body: text, media: { provider: "whapi", source: "system_notification",
            order_id: order.id, outbox_id: job.id },
          raw_payload: { provider: "whapi", outbox_id: job.id },
          delivery_status: "sent", occurred_at: new Date().toISOString()
        }, COMPANY);
      } catch (error) {
        console.error("[RESTAURANT OUTBOX CRM ERROR]", {
          jobId: job.id, type: error instanceof Error ? error.name : "UNKNOWN"
        });
      }
    } catch (error) {
      console.error("[RESTAURANT OUTBOX SEND ERROR]", {
        jobId: job.id, type: error instanceof Error ? error.name : "UNKNOWN"
      });
      try { await updateOutbox(job.id,"failed"); } catch { /* requires manual reconciliation */ }
      result.failed++;
    }
  }
  return result;
}
