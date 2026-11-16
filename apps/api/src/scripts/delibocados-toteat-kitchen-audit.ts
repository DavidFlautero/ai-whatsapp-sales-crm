/**
 * Read-only audit after a REAL accepted WhatsApp -> Toteat export.
 * Never sends orders, marks printed, or changes DB. The final paper observation
 * must be supplied by an operator at the restaurant.
 */
import {config} from "dotenv";
config({path:"../../.env",quiet:true});
async function main(){
 const [{supabaseRequest},{readCompanySecret},
  {parseToteatCredentials,toteatReadOnlyUrl},
  {parseToteatJsonPreservingIds}]=await Promise.all([
   import("../services/db/supabase-rest.client.js"),
   import("../services/integrations/company-secret.repository.js"),
   import("../services/restaurant-ops/restaurant-toteat-readonly.service.js"),
   import("../services/restaurant-ops/restaurant-toteat-receipt.service.js")
 ]);
 type Export={order_id:string;external_reference:string;external_order_id:string|null;
   status:string;accepted_at:string|null};
 const rows=await supabaseRequest<Export[]>({
   table:"restaurant_ops_pos_exports",
   query:"?company_id=eq.delibocados&provider=eq.toteat"+
    "&select=order_id,external_reference,external_order_id,status,accepted_at"+
    "&order=created_at.desc&limit=15"
 });
 console.log("=== DELIBOCADOS / TOTEAT / COCINA / SOLO LECTURA ===");
 console.log("RECENT_EXPORTS:",rows.length);
 const accepted=rows.filter(x=>x.status==="accepted"&&
   /^[1-9][0-9]{5,19}$/.test(x.external_order_id??""));
 if(!accepted.length){
   console.log("NINGUNA_OR​​DEN_CRM_ACEPTADA_CON_ID");
   console.log("NOTA: pedido Chicharrón del test independiente fue cancelado por dueño");
   console.log("NO_PRUEBA_IMPRESORA");
   return;
 }
 const secret=await readCompanySecret({companyId:"delibocados",provider:"toteat",keyVersion:1});
 const credentials=parseToteatCredentials(secret??"");
 if(!credentials.ok)throw new Error("TOTEAT_CREDENTIALS_NOT_READY");
 for(const x of accepted.slice(0,5)){
   const url=toteatReadOnlyUrl(credentials.value,"shiftstatus");
   url.pathname="/mw/or/1.0/orderstatus";
   url.searchParams.set("ic",x.external_order_id!);
   url.searchParams.set("det","false");
   let status="NOT_VERIFIED",printing="NOT_VERIFIED";
   try{
     const response=await fetch(url,{method:"GET",redirect:"error",cache:"no-store",
       headers:{Accept:"application/json"},signal:AbortSignal.timeout(12000)});
     if(response.ok){
       const value=parseToteatJsonPreservingIds(await response.text()) as {
         ok?:unknown;data?:{orderReference?:unknown;orderId?:unknown;
           orderStatus?:unknown;deliveryStatusId?:unknown}
       };
       const p=value?.data;
       if(value?.ok===true && p?.orderReference===x.external_reference &&
           String(p.orderId)===x.external_order_id){
         status=String(p.orderStatus??"UNKNOWN");
         printing=p.deliveryStatusId===90?"TOTEAT_REPORTED_PRINT":"NOT_REPORTED";
       }
     }
   }catch{ /* provider unavailable: not proof of print */ }
   const [order,ticket,printEvents]=await Promise.all([
     supabaseRequest<Array<{status:string;fulfillment_mode:string}>>({
       table:"restaurant_ops_orders",
       query:"?company_id=eq.delibocados&id=eq."+x.order_id+
         "&select=status,fulfillment_mode&limit=1"
     }),
     supabaseRequest<Array<{status:string;printed_at:string|null}>>({
       table:"restaurant_ops_kitchen_tickets",
       query:"?company_id=eq.delibocados&order_id=eq."+x.order_id+
         "&select=status,printed_at&limit=1"
     }),
     supabaseRequest<Array<{event_type:string}>>({
       table:"restaurant_ops_order_events",
       query:"?company_id=eq.delibocados&order_id=eq."+x.order_id+
         "&event_type=eq.toteat_print_reported&select=event_type&limit=1"
     })
   ]);
   console.log(JSON.stringify({reference:x.external_reference,
     accepted:true,toteat_status:status,toteat_print_signal:printing,
     crm_status:order[0]?.status??null,crm_kitchen_ticket:ticket[0]?.status??null,
     db_print_timestamp:Boolean(ticket[0]?.printed_at),
     toteat_print_event_logged:printEvents.length>0,
     physical_paper_observed:"REQUIRES_PERSONAL_DEL_LOCAL"}));
 }
 console.log("NINGUN_POST_NINGUN_WHATSAPP_NINGUNA_ESCRITURA");
}
void main().catch(e=>{
 console.error("KITCHEN_AUDIT_FAILED:",e instanceof Error?e.message:"UNKNOWN");
 process.exitCode=1;
});
