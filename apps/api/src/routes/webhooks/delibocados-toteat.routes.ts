import {createHash,timingSafeEqual} from "node:crypto";
import {Router} from "express";
import {supabaseRequest} from "../../services/db/supabase-rest.client.js";
import {readCompanySecret} from "../../services/integrations/company-secret.repository.js";
import {parseToteatCredentials} from "../../services/restaurant-ops/restaurant-toteat-readonly.service.js";
import {parseToteatOrderWebhook} from "../../services/restaurant-ops/restaurant-toteat-status-sync.service.js";

export const delibocadosToteatWebhookRoutes=Router();

function secretMatches(provided:string,expected:string):boolean {
  if(expected.length<32 || !provided)return false;
  const left=Buffer.from(provided),right=Buffer.from(expected);
  return left.length===right.length && timingSafeEqual(left,right);
}

/**
 * Configure Toteat -> Pedidos -> Webhook using CUSTOM HEADER:
 * X-Delibocados-Toteat-Secret: <independent random secret>.
 *
 * The bearer token for Toteat API is NEVER the webhook authentication secret.
 * Respond quickly after a durable inbox write; process asynchronously.
 */
delibocadosToteatWebhookRoutes.post("/orders",async(req,res)=>{
  if(process.env.DELIBOCADOS_TOTEAT_WEBHOOK_ENABLED!=="1"){
    res.status(404).json({ok:false,error:"WEBHOOK_DISABLED"});return;
  }
  const expected=process.env.DELIBOCADOS_TOTEAT_WEBHOOK_SECRET?.trim()??"";
  const supplied=req.get("x-delibocados-toteat-secret")??"";
  if(!secretMatches(supplied,expected)){
    res.status(401).json({ok:false,error:"UNAUTHORIZED"});return;
  }
  try {
    const secret=await readCompanySecret({
      companyId:"delibocados",provider:"toteat",keyVersion:1
    });
    const parsed=parseToteatCredentials(secret??"");
    if(!parsed.ok){
      res.status(503).json({ok:false,error:"TOTEAT_CONFIG_NOT_READY"});return;
    }
    const events=parseToteatOrderWebhook(
      req.body,parsed.value.restaurantId,parsed.value.localNumber
    );
    const rows=events.map(e=>({
      company_id:"delibocados",
      event_key:createHash("sha256").update(JSON.stringify([
        e.reference,e.externalOrderId,e.orderStatus,e.deliveryStatusId,e.modificationDate
      ])).digest("hex"),
      external_reference:e.reference,
      external_order_id:e.externalOrderId,
      order_status:e.orderStatus,
      delivery_status_id:e.deliveryStatusId,
      modification_date:e.modificationDate,
      status:"pending"
    }));
    if(rows.length){
      // Duplicate deliveries remain one event. Never process from the HTTP handler.
      await supabaseRequest<unknown[]>({
        table:"restaurant_ops_toteat_webhook_inbox",method:"POST",
        query:"?on_conflict=company_id,event_key",
        prefer:"resolution=ignore-duplicates,return=minimal",
        body:rows
      });
    }
    res.status(200).json({ok:true,received:events.length});
  }catch(error){
    const message=error instanceof Error?error.message:"UNKNOWN";
    if(message.startsWith("TOTEAT_WEBHOOK_")){
      res.status(400).json({ok:false,error:"INVALID_TOTEAT_EVENT"});return;
    }
    console.error("[TOTEAT WEBHOOK INBOX]",{
      error:error instanceof Error?error.name:"UNKNOWN"
    });
    res.status(503).json({ok:false,error:"TOTEAT_WEBHOOK_TEMPORARILY_UNAVAILABLE"});
  }
});
