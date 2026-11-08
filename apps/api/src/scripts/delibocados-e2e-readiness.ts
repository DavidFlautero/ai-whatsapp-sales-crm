/**
 * Delibocados: preflight real y NO destructivo para la prueba controlada.
 * Uso desde /var/www/control:
 * pnpm --filter @ventas/api exec tsx src/scripts/delibocados-e2e-readiness.ts
 *
 * No envía mensajes, no crea pedidos, no cambia estados, no contacta impresoras
 * ni realiza POST a Toteat. Nunca imprime tokens, números completos o direcciones.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";

config({ path: "../../.env", quiet: true });

type Row = Record<string, unknown>;
type Check = { state: "ok" | "blocked" | "pending"; detail: string };
const checks: Record<string, Check> = {};
function report(name: string, state: Check["state"], detail: string) {
  checks[name] = { state, detail };
  console.log(`${state.toUpperCase().padEnd(7)} | ${name} | ${detail}`);
}

async function main() {
  console.log("=== DELIBOCADOS / PREPARACIÓN E2E (SOLO LECTURA) ===");
  const paused = existsSync("/root/delibocados-ai.stop");
  report("IA", paused ? "blocked" : "pending", paused
    ? "Archivo de pausa presente; no se responderá a clientes."
    : "Sin archivo de pausa; comprobar flags de prueba antes de escribir.");
  const onlyTest = process.env.DELIBOCADOS_CHECKOUT_LIVE !== "1"
    && process.env.DELIBOCADOS_ORDER_NOTIFICATIONS_LIVE !== "1";
  report("Aislamiento", onlyTest ? "ok" : "blocked", onlyTest
    ? "Modo público no solicitado en variables visibles de este proceso."
    : "Hay variables LIVE activas. No ejecutar pedidos de prueba sin revisar PM2.");

  const [{ getDelibocadosChannel }, { supabaseRequest }] = await Promise.all([
    import("../services/whapi/delibocados-channel.service.js"),
    import("../services/db/supabase-rest.client.js")
  ]);
  let testPhone = "";
  try {
    const channel = await getDelibocadosChannel();
    testPhone = channel.testPhone;
    if (!channel.enabled || !/^[0-9]{8,15}$/.test(testPhone) ||
        testPhone === channel.phone) throw new Error("INVALID_TEST_PHONE");
    report("Whapi", "pending", "Canal configurado; prueba de salud remota en curso.");
    const response = await fetch("https://gate.whapi.cloud/health?wakeup=false", {
      headers: { Authorization: `Bearer ${channel.token}` },
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error("HTTP_" + response.status);
    const health = await response.json() as { user?: { id?: string } };
    const sender = String(health.user?.id ?? "").split("@")[0].replace(/\D/g, "");
    if (sender !== channel.phone) throw new Error("SENDER_MISMATCH");
    report("Whapi", "ok", "Canal activo y emisor verificado. TestPhone ****" + testPhone.slice(-4));
  } catch (error) {
    report("Whapi", "blocked", "No verificado: " +
      (error instanceof Error ? error.message : "ERROR"));
  }

  try {
    const menus = await supabaseRequest<Array<{revision:number;payload?:{
      products?: Array<{id?:string;available?:boolean;priceNeedsReview?:boolean;priceCOP?:number}>}
    }>>({ table:"restaurant_menu_documents",
      query:"?company_id=eq.delibocados&select=revision,payload&limit=1" });
    const products = menus[0]?.payload?.products ?? [];
    const valid = products.filter(x => x.id && x.available !== false &&
      x.priceNeedsReview !== true && Number.isSafeInteger(Number(x.priceCOP)) &&
      Number(x.priceCOP) >= 0).length;
    report("Menú", valid > 0 ? "ok" : "blocked",
      valid + " productos con precio validado; revisión " + String(menus[0]?.revision ?? "N/A"));
  } catch {
    report("Menú", "blocked", "No se pudo consultar el catálogo oficial.");
  }

  if (!/^[0-9]{8,15}$/.test(testPhone)) {
    report("Pedido", "blocked", "Falta validar el teléfono de pruebas.");
  } else {
    try {
      const orders = await supabaseRequest<Row[]>({
        table:"restaurant_ops_orders",
        query:"?company_id=eq.delibocados&customer_phone=eq."+encodeURIComponent(testPhone)+
          "&select=id,number,source,status,payment_status,payment_method,total_cop,subtotal_cop,delivery_fee_cop,created_at"+
          "&order=created_at.desc&limit=1"
      });
      const order=orders[0];
      if (!order) {
        report("Pedido", "pending", "No hay pedido de prueba registrado. Usar WhatsApp con el testPhone.");
      } else {
        const id=String(order.id);
        const [items,tickets,events] = await Promise.all([
          supabaseRequest<Row[]>({table:"restaurant_ops_order_items",
            query:"?company_id=eq.delibocados&order_id=eq."+encodeURIComponent(id)+
              "&select=quantity,line_total_cop,product_id"}),
          supabaseRequest<Row[]>({table:"restaurant_ops_kitchen_tickets",
            query:"?company_id=eq.delibocados&order_id=eq."+encodeURIComponent(id)+
              "&select=status,printed_at,queued_at&limit=2"}),
          supabaseRequest<Row[]>({table:"restaurant_ops_order_events",
            query:"?company_id=eq.delibocados&order_id=eq."+encodeURIComponent(id)+
              "&select=event_type&limit=100"})
        ]);
        const subtotal=items.reduce((n,x)=>n+Number(x.line_total_cop),0);
        const consistent=items.length>0 && tickets.length===1 &&
          Number.isSafeInteger(subtotal) &&
          subtotal === Number(order.subtotal_cop) &&
          subtotal + Number(order.delivery_fee_cop) === Number(order.total_cop);
        report("Pedido", consistent ? "ok" : "blocked",
          "Pedido #"+String(order.number)+"; líneas="+items.length+
          "; eventos="+events.length+"; suma="+(consistent?"válida":"inconsistente"));
        report("Pago", ["verified","cash_on_delivery"].includes(String(order.payment_status))
          ? "ok":"blocked", "Estado="+String(order.payment_status));
        report("Cocina interna", tickets.length===1 ? "ok":"blocked",
          tickets.length===1?"Ticket="+String(tickets[0].status):"Falta o está duplicado");
        report("Impresión física", "pending", tickets[0]?.printed_at
          ? "Hay timestamp en BD; falta comprobación visual del papel en el restaurante."
          : "No consta impresión; requiere Print Server/impresora y confirmación en sede.");
      }
    } catch {
      report("Pedido", "blocked", "Consulta de pedidos/tickets incompleta.");
    }
  }
  report("Toteat", "pending",
    "No hay exportador activado en esta versión; faltan credenciales, códigos mapeados y prueba de recepción.");
  report("Comandera", "pending",
    "No considerar impreso sin estado real de Toteat/Print Server y papel observado en cocina.");
  console.log("=== RESULTADO (NO SE ENVIÓ NADA) ===");
  console.log(JSON.stringify({checks}, null, 2));
}
void main().catch((error:unknown)=>{
  console.error("PREFLIGHT_INCOMPLETO",error instanceof Error?error.message:"ERROR");
});
