/**
 * Read-only, post-deployment WhatsApp → PostgreSQL → kitchen → CRM verification.
 * Run from apps/api with env loaded: pnpm exec tsx src/scripts/delibocados-ops-smoke.ts
 * Does not create orders, send messages, change states, print credentials or terminate the shell.
 */
import "dotenv/config";
import { getDelibocadosChannel } from "../services/whapi/delibocados-channel.service.js";
import { supabaseRequest } from "../services/db/supabase-rest.client.js";
import { getContactByPhone } from "../services/crm/crm.repository.js";

type Row = Record<string,unknown>;
async function main() {
  console.log("=== DELIBOCADOS / VERIFICACIÓN REAL ===");
  let phone = "";
  try {
    const channel = await getDelibocadosChannel();
    phone = channel.testPhone;
    console.log("Canal existente: configurado");
    console.log("Número de pruebas: terminado en",phone.slice(-4));
  } catch {
    console.log("Canal: falta configurar el número de prueba o no se puede leer");
    return;
  }
  try {
    const orders = await supabaseRequest<Row[]>({
      table:"restaurant_ops_orders",
      query:"?company_id=eq.delibocados&customer_phone=eq."+encodeURIComponent(phone)+
        "&select=id,number,source,status,fulfillment_mode,total_cop,payment_status,created_at&order=created_at.desc&limit=5"
    });
    if (!orders.length) {
      console.log("Pedidos: todavía no hay pedidos del número de pruebas.");
      console.log("Enviá MENÚ desde ese número y completá hasta CONFIRMAR PEDIDO.");
      return;
    }
    console.log("Últimos pedidos del número de pruebas:");
    for(const order of orders) {
      const orderId = String(order.id);
      const [items,tickets,events] = await Promise.all([
        supabaseRequest<Row[]>({table:"restaurant_ops_order_items",
          query:"?company_id=eq.delibocados&order_id=eq."+orderId+
            "&select=product_name,quantity,unit_price_cop,line_total_cop"}),
        supabaseRequest<Row[]>({table:"restaurant_ops_kitchen_tickets",
          query:"?company_id=eq.delibocados&order_id=eq."+orderId+
            "&select=status,queued_at,started_at,ready_at"}),
        supabaseRequest<Row[]>({table:"restaurant_ops_order_events",
          query:"?company_id=eq.delibocados&order_id=eq."+orderId+
            "&select=event_type,created_at&order=created_at.asc&limit=100"})
      ]);
      console.log({
        number:order.number,source:order.source,status:order.status,
        fulfillment:order.fulfillment_mode,totalCOP:order.total_cop,
        payment:order.payment_status,items:items.length,
        kitchenTicket:tickets.length === 1 ? tickets[0].status : "MISSING_OR_DUPLICATED",
        eventCount:events.length,createdAt:order.created_at
      });
    }
    const contact = await getContactByPhone(phone,"delibocados");
    console.log("CRM:",contact ? {
      hasName:Boolean(contact.name),
      nameConfirmed:contact.metadata?.name_confirmed === true,
      source:contact.metadata?.name_source,
      customerStatus:contact.status
    } : "Contacto todavía ausente");
  } catch(error) {
    console.log("La verificación no pudo completarse:",error instanceof Error ? error.message : "ERROR");
  }
  console.log("=== FIN (SIN MODIFICAR DATOS) ===");
}
void main();
