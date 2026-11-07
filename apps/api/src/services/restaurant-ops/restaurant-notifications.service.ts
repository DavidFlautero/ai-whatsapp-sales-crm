import { existsSync } from "node:fs";
import { getDelibocadosChannel } from "../whapi/delibocados-channel.service.js";
import { supabaseRequest, supabaseRpc } from "../db/supabase-rest.client.js";
import { saveMessage } from "../whapi/whapi-durable-message.service.js";

type QueueItem = { id: string; order_id: string; kind: string; attempts: number };
type Order = {
  id: string; number: number; status: string; fulfillment_mode: "pickup" | "delivery";
  customer_phone: string;
  payment_status: string;
  payment_method: string;
  source: string;
};
type PayloadRow = {
  id: string; order_id: string; kind: string; payload: Record<string, unknown>;
};
type TestResult = { disabled?: string; claimed: number; sent: number; failed: number; suppressed: number };

const COMPANY = "delibocados";
const STOP_FILE = "/root/delibocados-ai.stop";

export function notificationText(order: Order, kind: string, payload: Record<string, unknown>): string | null {
  const number=order.number;
  if(kind==="order_confirmed") {
    if(order.source==="whatsapp")return null; // checkout itself sends an immediate acknowledgement
    return order.payment_status==="cash_on_delivery" ?
      "Delibocados: pedido #"+number+" aceptado y enviado a la cola de cocina. Pago en efectivo al recibir.":
      "Delibocados: pedido #"+number+" registrado. Esperamos confirmar el pago antes de enviarlo a cocina.";
  }
  if(kind==="payment_proof_received") {
    return order.payment_status==="proof_submitted"
      ? "Delibocados: recibimos tu comprobante del pedido #"+number+
        ". Está en revisión. Te avisaremos cuando se verifique el ingreso." : null;
  }
  if(kind==="payment_verified") {
    if(order.payment_method==="mixed" &&
       payload.stage==="partial_transfer_approved" &&
       order.payment_status==="cash_on_delivery") {
      const due=Number(payload.cash_due_cop);
      if(!Number.isSafeInteger(due)||due<=0)return null;
      return "Delibocados: confirmamos la transferencia parcial del pedido #"+
        number+". Quedan $"+due.toLocaleString("es-CO")+
        " COP en efectivo al recibir. El pedido ya puede pasar a cocina.";
    }
    if(order.payment_method==="mixed"&&payload.stage==="split_settled"&&
       order.payment_status==="verified")
      return "Delibocados: el pago dividido del pedido #"+number+
        " quedó conciliado y sin saldo pendiente. ¡Gracias!";
    return order.payment_status==="verified"
      ? "Delibocados: verificamos el pago del pedido #"+number+
        ". Ya está en la cola de cocina. ¡Gracias!" : null;
  }
  if(kind==="payment_rejected") {
    if(order.payment_status!=="pending")return null;
    const reason=String(payload.reason??"").replace(/[\r\n]/g," ").slice(0,200);
    return "Delibocados: no pudimos verificar el comprobante del pedido #"+number+
      (reason?" ("+reason+")":"")+
      ". Enviá un nuevo comprobante o comunicate con un encargado. No pasó a cocina.";
  }
  if(kind==="courier_assigned") {
    return order.status==="completed"||order.status==="cancelled" ? null :
      "Delibocados: asignamos un repartidor al pedido #"+number+
      ". Te avisaremos cuando salga de cocina.";
  }
  if(kind!=="order_status_changed" || payload.status!==order.status)return null;
  switch(order.status) {
    case "preparing":return "Delibocados: estamos preparando tu pedido #"+number+".";
    case "ready":return order.fulfillment_mode==="pickup"
      ?"Delibocados: tu pedido #"+number+" está listo para retirar."
      :"Delibocados: tu pedido #"+number+" está listo para despacho.";
    case "out_for_delivery":return "Delibocados: tu pedido #"+number+" ya salió a domicilio.";
    case "completed":return "Delibocados: pedido #"+number+" entregado. ¡Gracias!";
    case "cancelled":return "Delibocados: pedido #"+number+" cancelado. Si necesitás ayuda, respondé aquí.";
    default:return null;
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

async function dispatch(mode:"test"|"live"): Promise<TestResult> {
  // Both modes are explicit opt-ins. Refuse ambiguous mixed configuration.
  const testOn=process.env.DELIBOCADOS_ORDER_NOTIFICATIONS_TEST === "1";
  const liveOn=process.env.DELIBOCADOS_ORDER_NOTIFICATIONS_LIVE === "1";
  if (testOn && liveOn) return { disabled:"CONFLICTING_NOTIFICATION_MODES",claimed:0,sent:0,failed:0,suppressed:0 };
  if ((mode==="test" && !testOn) || (mode==="live" && !liveOn))
    return { disabled:"NOTIFICATIONS_DISABLED",claimed:0,sent:0,failed:0,suppressed:0 };
  if (existsSync(STOP_FILE))
    return { disabled: "DELIBOCADOS_MESSAGING_PAUSED", claimed: 0, sent: 0, failed: 0, suppressed: 0 };

  const config = await getDelibocadosChannel();
  if (!config.testPhone || !/^[0-9]{8,15}$/.test(config.testPhone))
    throw new Error("TEST_PHONE_REQUIRED");

  const claimed = mode==="test" ?
    await supabaseRpc<QueueItem[]>("restaurant_ops_claim_test_outbox",{
      p_company_id:COMPANY,p_test_phone:config.testPhone,p_max:5
    }) :
    await supabaseRpc<QueueItem[]>("restaurant_ops_claim_live_outbox",{
      p_company_id:COMPANY,p_max:10
    });

  const result: TestResult = { claimed: claimed.length, sent: 0, failed: 0, suppressed: 0 };
  for (const job of claimed) {
    try {
      const [orders, rows] = await Promise.all([
        supabaseRequest<Order[]>({
          table: "restaurant_ops_orders",
          query: "?company_id=eq.delibocados&id=eq." + encodeURIComponent(job.order_id) +
            (mode==="test" ? "&customer_phone=eq."+encodeURIComponent(config.testPhone) : "") +
            "&select=id,number,status,fulfillment_mode,customer_phone,payment_status,payment_method,source&limit=1"
        }),
        supabaseRequest<PayloadRow[]>({
          table: "restaurant_ops_outbox",
          query: "?company_id=eq.delibocados&id=eq." + encodeURIComponent(job.id) +
            "&select=id,order_id,kind,payload&limit=1"
        })
      ]);
      const order = orders[0]; const record = rows[0];
      const text = order && record ? notificationText(order,job.kind,record.payload??{}) : null;
      if (!text) { await updateOutbox(job.id, "suppressed"); result.suppressed++; continue; }
      const recipient = mode==="test" ? config.testPhone : order.customer_phone;
      const modeEnabled = mode==="test" ?
        process.env.DELIBOCADOS_ORDER_NOTIFICATIONS_TEST === "1" :
        process.env.DELIBOCADOS_ORDER_NOTIFICATIONS_LIVE === "1";
      // Recheck guardrails immediately before each send.
      if (!modeEnabled || existsSync(STOP_FILE) ||
          !/^[0-9]{8,15}$/.test(recipient) ||
          (mode==="test" && order.customer_phone !== config.testPhone)) {
        await updateOutbox(job.id,"suppressed"); result.suppressed++; continue;
      }
      const response = await fetch("https://gate.whapi.cloud/messages/text", {
        method: "POST",
        headers: { Authorization: "Bearer " + config.token, "Content-Type": "application/json" },
        body: JSON.stringify({ to: recipient, body: text }),
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error("WHAPI_NOTIFY_HTTP_" + response.status);
      const sent = await response.json() as { id?: string; message?: { id?: string } };
      // Mark sent to provider BEFORE attempting CRM persistence; avoid resending on CRM error.
      await updateOutbox(job.id, "sent");
      result.sent++;
      try {
        await saveMessage({
          contact_phone: recipient,
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

export async function dispatchDelibocadosTestNotifications():Promise<TestResult> {
  return dispatch("test");
}

// A single isolated test-channel dispatcher, never public WhatsApp by default.
let workerStarted = false;
let workerBusy = false;
export function startRestaurantNotificationsWorker(): void {
  const testOn=process.env.DELIBOCADOS_ORDER_NOTIFICATIONS_TEST === "1";
  const liveOn=process.env.DELIBOCADOS_ORDER_NOTIFICATIONS_LIVE === "1";
  if (workerStarted || testOn === liveOn) return;
  const mode=liveOn?"live" as const:"test" as const;
  workerStarted = true;
  const timer = setInterval(() => {
    if (workerBusy || existsSync(STOP_FILE)) return;
    workerBusy = true;
    void dispatch(mode)
      .catch(e => console.error("[RESTAURANT NOTIFICATION WORKER]",{
        type:e instanceof Error?e.name:"UNKNOWN"
      }))
      .finally(() => { workerBusy = false; });
  },10000);
  timer.unref();
  console.log("[RESTAURANT NOTIFICATIONS] worker ready: "+mode);
}
