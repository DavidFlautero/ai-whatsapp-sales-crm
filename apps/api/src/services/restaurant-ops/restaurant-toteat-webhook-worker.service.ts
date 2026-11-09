import {supabaseRequest,supabaseRpc} from "../db/supabase-rest.client.js";
import {getCompanyIntegration} from "../integrations/company-integration.repository.js";
import {
  toteatSafeTransition,type LocalOrderState,type ToteatStatusEvent
} from "./restaurant-toteat-status-sync.service.js";

type Event={
  id:string;company_id:string;external_reference:string;external_order_id:string;
  order_status:string;delivery_status_id:number|null;modification_date:string|null;
};
type PosExport={order_id:string;external_order_id:string|null;status:string};
type Order={
  id:string;company_id:string;source:string;status:LocalOrderState;
  version:number;fulfillment_mode:"pickup"|"delivery";courier_id:string|null;
};
const COMPANY="delibocados";
let started=false,busy=false;

async function finish(id:string,status:"applied"|"ignored"|"failed",reason:string){
  await supabaseRpc("restaurant_ops_toteat_finish_event",{
    p_company_id:COMPANY,p_event_id:id,p_status:status,p_reason:reason
  });
}
async function processOne():Promise<void>{
  // Do not claim an event until the restaurant owner enables this integration.
  const integration=await getCompanyIntegration(COMPANY,"toteat");
  if(integration?.status!=="connected"||integration.enabled!==true)return;
  const job=await supabaseRpc<Event|null>("restaurant_ops_toteat_claim_event",{
    p_company_id:COMPANY
  });
  if(!job)return;
  let outcome:"applied"|"ignored"|"failed"="ignored";
  let reason="NO_APPLICABLE_TRANSITION";
  try{
    const exports=await supabaseRequest<PosExport[]>({
      table:"restaurant_ops_pos_exports",
      query:"?company_id=eq.delibocados&provider=eq.toteat"+
        "&external_reference=eq."+encodeURIComponent(job.external_reference)+
        "&status=eq.accepted"+
        "&select=order_id,external_order_id,status&limit=1"
    });
    const exportRow=exports[0];
    if(!exportRow || !job.external_order_id ||
       exportRow.external_order_id!==job.external_order_id){
      reason="NO_VERIFIED_TOTEAT_ACCEPTANCE";
    }else{
      const orders=await supabaseRequest<Order[]>({
        table:"restaurant_ops_orders",
        query:"?company_id=eq.delibocados&id=eq."+
          encodeURIComponent(exportRow.order_id)+
          "&select=id,company_id,source,status,version,fulfillment_mode,courier_id&limit=1"
      });
      const order=orders[0];
      if(!order || order.source!=="whatsapp"){
        reason="ORDER_SOURCE_MISMATCH";
      }else{
        const event:ToteatStatusEvent={
          reference:job.external_reference,
          externalOrderId:job.external_order_id,
          deliveryStatusId:job.delivery_status_id,
          orderStatus:job.order_status,
          modificationDate:job.modification_date
        };
        const transition=toteatSafeTransition(order.status,order.fulfillment_mode,
          Boolean(order.courier_id),event);
        if(transition){
          await supabaseRpc("restaurant_ops_transition_order",{
            p_company_id:COMPANY,p_order_id:order.id,p_expected_version:order.version,
            p_next_status:transition.nextStatus,
            p_actor_id:"toteat-webhook",p_actor_role:"system",p_reason:transition.reason
          });
          outcome="applied";
          reason=transition.reason;
        }
      }
    }
  }catch(error){
    outcome="failed";
    reason="REQUIRES_MANUAL_RECONCILIATION";
    console.error("[TOTEAT STATUS SYNC]",{type:error instanceof Error?error.name:"UNKNOWN"});
  }
  await finish(job.id,outcome,reason);
}

export function startToteatWebhookWorker():void {
  if(started || process.env.DELIBOCADOS_TOTEAT_WEBHOOK_ENABLED!=="1" ||
      process.env.DELIBOCADOS_TOTEAT_STATUS_SYNC_LIVE!=="1")return;
  started=true;
  const timer=setInterval(()=>{
    if(busy || process.env.DELIBOCADOS_TOTEAT_STATUS_SYNC_LIVE!=="1")return;
    busy=true;
    void processOne().catch(error=>{
      console.error("[TOTEAT STATUS WORKER]",{
        type:error instanceof Error?error.name:"UNKNOWN"
      });
    }).finally(()=>{busy=false;});
  },5000);
  timer.unref();
  console.log("[TOTEAT STATUS WORKER] ready; external order export remains separate");
}
