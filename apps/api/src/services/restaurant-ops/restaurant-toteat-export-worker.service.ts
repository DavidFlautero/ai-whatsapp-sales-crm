/**
 * Source=whatsapp -> Toteat real orders, guarded behind two independent opt-ins:
 * (1) feature env and owner integration enabled
 * (2) pilot UUID or explicit public release with a new-order cutover.
 *
 * This worker is NEVER enabled by adding code to the repo.
 * Database controlled claim consumes a single attempt BEFORE external I/O;
 * unknown is never retried. Only orders created after cutover are eligible.
 */
import {existsSync} from "node:fs";
import {supabaseRequest,supabaseRpc} from "../db/supabase-rest.client.js";
import {readCompanySecret} from "../integrations/company-secret.repository.js";
import {getCompanyIntegration} from "../integrations/company-integration.repository.js";
import {parseToteatCredentials,toteatReadOnlyUrl,type ToteatCredentials}
  from "./restaurant-toteat-readonly.service.js";
import {prepareToteatLines,type RegisteredLine,type ReviewedMapping}
  from "./restaurant-toteat-preparation.service.js";
import {makeToteatOrderPayload,serializeToteatExternalOrder,
  type ToteatExportOrder,type VerifiedSplit,type VerifiedFeeProduct}
  from "./restaurant-toteat-order-payload.service.js";
import {submitOneToteatOrder} from "./restaurant-toteat-order-client.service.js";
import {normalizeToteatName} from "./restaurant-toteat-catalog-map.service.js";

const COMPANY="delibocados",STOP="/root/delibocados-ai.stop";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Claim={id:string;order_id:string;external_reference:string};
type Product={name?:unknown;price?:unknown;localCode?:unknown;isModifier?:unknown};
type MenuDoc={revision:number;payload:{products?:Array<{
  id:string;name:string;priceCOP:number;priceNeedsReview?:boolean;available?:boolean;
}>}};
let started=false,busy=false;

export function toteatExportControls():{
  enabled:boolean;reason:string;cutover:string|null;onlyOrderId:string|null
}{
  if(process.env.DELIBOCADOS_TOTEAT_ORDER_EXPORT!=="1")
    return {enabled:false,reason:"EXPORT_FLAG_OFF",cutover:null,onlyOrderId:null};
  if(process.env.DELIBOCADOS_TOTEAT_EXPORT_ACK!=="OWNER_AUTHORIZED_REAL_ORDERS")
    return {enabled:false,reason:"OWNER_ACK_REQUIRED",cutover:null,onlyOrderId:null};
  if(existsSync(STOP))
    return {enabled:false,reason:"AI_STOP_FILE_PRESENT",cutover:null,onlyOrderId:null};
  const only=process.env.DELIBOCADOS_TOTEAT_EXPORT_ONLY_ORDER_ID?.trim()??"";
  if(only && !UUID.test(only))
    return {enabled:false,reason:"PILOT_ORDER_UUID_INVALID",cutover:null,onlyOrderId:null};
  if(!only && process.env.DELIBOCADOS_TOTEAT_EXPORT_PUBLIC!=="1")
    return {enabled:false,reason:"PILOT_UUID_OR_PUBLIC_RELEASE_REQUIRED",cutover:null,onlyOrderId:null};
  const cutover=process.env.DELIBOCADOS_TOTEAT_EXPORT_CUTOVER?.trim()??"";
  const date=Date.parse(cutover);
  if(!cutover||Number.isNaN(date)||date>Date.now()||
     date<Date.now()-30*24*3600*1000)
    return {enabled:false,reason:"VALID_RECENT_CUTOVER_REQUIRED",cutover:null,onlyOrderId:null};
  return {enabled:true,reason:"READY",cutover:new Date(date).toISOString(),onlyOrderId:only||null};
}

async function getToteatProducts(
  creds:ToteatCredentials
):Promise<Product[]>{
  const response=await fetch(toteatReadOnlyUrl(creds,"products"),{
    method:"GET",redirect:"error",cache:"no-store",
    headers:{Accept:"application/json"},signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw new Error("TOTEAT_PRODUCTS_UNAVAILABLE");
  const body=await response.json() as {ok?:unknown;data?:unknown};
  if(body?.ok!==true || !Array.isArray(body.data))
    throw new Error("TOTEAT_PRODUCT_RESPONSE_INVALID");
  return body.data as Product[];
}
async function checkShiftOpen(creds:ToteatCredentials):Promise<boolean>{
  try{
    const response=await fetch(toteatReadOnlyUrl(creds,"shiftstatus"),{
      method:"GET",redirect:"error",cache:"no-store",
      headers:{Accept:"application/json"},signal:AbortSignal.timeout(12000)
    });
    if(!response.ok)return false;
    const body=await response.json() as {ok?:unknown;data?:{status?:unknown}};
    return body?.ok===true && body.data?.status==="open";
  }catch{return false;}
}
export function checkToteatCatalogSnapshot(
  items:RegisteredLine[],mappings:ReviewedMapping[],remote:Product[],
  feeCode?:string|null,feeAmount?:number
):{ok:boolean;reason:string;feeProduct:VerifiedFeeProduct|null}{
  const mapping=new Map(mappings.filter(x=>x.active&&x.reviewed_at)
    .map(x=>[x.product_id,x.external_product_code]));
  for(const item of items){
    const code=mapping.get(item.product_id);
    if(!code)return {ok:false,reason:"ITEM_UNMAPPED",feeProduct:null};
    const matches=remote.filter(x=>x.localCode===code &&
      x.isModifier===false &&
      normalizeToteatName(String(x.name??""))===normalizeToteatName(item.product_name) &&
      Number(x.price)===item.unit_price_cop);
    if(matches.length!==1)
      return {ok:false,reason:"ITEM_PRICE_OR_CATALOG_DRIFT",feeProduct:null};
  }
  if(!feeCode || !feeAmount)return {ok:true,reason:"OK",feeProduct:null};
  const feeMatches=remote.filter(x=>x.isModifier===false &&
    x.localCode===feeCode && Number(x.price)===feeAmount);
  if(feeMatches.length!==1)
    return {ok:false,reason:"DELIVERY_FEE_SKU_NOT_VERIFIED",feeProduct:null};
  return {ok:true,reason:"OK",feeProduct:{
    productCode:feeCode,productName:String(feeMatches[0].name),priceCOP:feeAmount
  }};
}
async function finish(id:string,outcome:"accepted"|"unknown"|"rejected",externalId:string|null){
  await supabaseRpc("restaurant_ops_pos_finish_toteat",{
    p_company_id:COMPANY,p_export_id:id,p_outcome:outcome,
    p_external_order_id:outcome==="accepted"?externalId:null
  });
}

/** Called by the worker only. Exposed for isolated manual tests, not an HTTP route. */
export async function exportOneConfirmedWhatsappOrder():Promise<{
  action:"disabled"|"empty"|"finished";reason:string;outcome?:string;
}>{
  const controls=toteatExportControls();
  if(!controls.enabled || !controls.cutover)
    return {action:"disabled",reason:controls.reason};
  const integration=await getCompanyIntegration(COMPANY,"toteat");
  if(integration?.enabled!==true||integration.status!=="connected")
    return {action:"disabled",reason:"TOTEAT_OWNER_INTEGRATION_DISABLED"};
  const secret=await readCompanySecret({companyId:COMPANY,provider:"toteat",keyVersion:1});
  const parsed=parseToteatCredentials(secret??"");
  if(!parsed.ok)
    return {action:"disabled",reason:"TOTEAT_CREDENTIALS_INVALID"};
  const claim=await supabaseRpc<Claim|null>("restaurant_ops_pos_claim_toteat_controlled",{
    p_company_id:COMPANY,p_cutover:controls.cutover,
    p_only_order_id:controls.onlyOrderId,
    p_allow_delivery:process.env.DELIBOCADOS_TOTEAT_DELIVERY_ENABLED==="1" &&
      Boolean(process.env.DELIBOCADOS_TOTEAT_DELIVERY_FEE_CODE?.trim())
  });
  if(!claim)return {action:"empty",reason:"NO_ELIGIBLE_NEW_ORDER"};
  // Claim already consumed this attempt. Any failure from this point requires
  // an audit and must never cause automatic resending.
  let outcome:"accepted"|"unknown"|"rejected"="unknown";
  let externalId:string|null=null,reason="PROVIDER_RESULT_UNKNOWN";
  let postAttempted=false;
  try{
    if(!UUID.test(claim.id)||!UUID.test(claim.order_id) ||
       claim.external_reference!=="delibocados-"+claim.order_id)
      throw new Error("CLAIM_INVALID");
    const [orders,items,mappings,menus,splits]=await Promise.all([
      supabaseRequest<ToteatExportOrder[]>({table:"restaurant_ops_orders",
        query:"?company_id=eq.delibocados&id=eq."+claim.order_id+
        "&select=id,company_id,source,status,customer_name,payment_method,payment_status,"+
        "fulfillment_mode,subtotal_cop,delivery_fee_cop,total_cop,customer_note,address,created_at,menu_revision&limit=1"}),
      supabaseRequest<RegisteredLine[]>({table:"restaurant_ops_order_items",
        query:"?company_id=eq.delibocados&order_id=eq."+claim.order_id+
        "&select=product_id,product_name,quantity,unit_price_cop,instructions&order=id.asc&limit=60"}),
      supabaseRequest<ReviewedMapping[]>({table:"restaurant_ops_pos_product_map",
        query:"?company_id=eq.delibocados&provider=eq.toteat"+
        "&select=product_id,external_product_code,active,reviewed_at&limit=150"}),
      supabaseRequest<MenuDoc[]>({table:"restaurant_menu_documents",
        query:"?company_id=eq.delibocados&select=revision,payload&limit=1"}),
      supabaseRequest<VerifiedSplit[]>({table:"restaurant_ops_split_payments",
        query:"?company_id=eq.delibocados&order_id=eq."+claim.order_id+
        "&select=transfer_due_cop,cash_due_cop,transfer_verified_cop,cash_collected_cop&limit=1"})
    ]);
    const order=orders[0] as ToteatExportOrder & {menu_revision?:number}|undefined;
    if(!order || !menus[0] || order.menu_revision!==menus[0].revision)
      throw new Error("MENU_REVISION_CHANGED_REQUIRES_REVIEW");
    const latest=new Map((menus[0].payload.products??[]).map(p=>[p.id,p]));
    if(items.some(item=>{
      const p=latest.get(item.product_id);
      return !p || p.available===false || p.priceNeedsReview===true ||
        p.name!==item.product_name || p.priceCOP!==item.unit_price_cop;
    }))throw new Error("ORDER_CATALOG_PRICE_CHANGED");
    const prepared=prepareToteatLines(order,items,mappings);
    if(!prepared.ready)throw new Error(prepared.reason);
    const feeCode=process.env.DELIBOCADOS_TOTEAT_DELIVERY_FEE_CODE?.trim();
    if(prepared.kind==="delivery"&&prepared.deliveryFeeCOP>0&&!feeCode)
      throw new Error("DELIVERY_FEE_CODE_NOT_CONFIGURED");
    if(!(await checkShiftOpen(parsed.value)))
      throw new Error("TOTEAT_SHIFT_NOT_OPEN");
    const remote=await getToteatProducts(parsed.value);
    const validated=checkToteatCatalogSnapshot(items,mappings,remote,
      prepared.kind==="delivery"?feeCode:null,
      prepared.kind==="delivery"?prepared.deliveryFeeCOP:undefined);
    if(!validated.ok)throw new Error(validated.reason);
    const body=makeToteatOrderPayload({
      order,preparation:prepared,restaurantId:parsed.value.restaurantId,
      localNumber:parsed.value.localNumber,split:splits[0],
      lineProductNames:items.map(x=>x.product_name),
      deliveryFeeProduct:validated.feeProduct,nowISO:new Date().toISOString()
    });
    if(!body.ready)throw new Error(body.reason);
    // Recheck all three independent switches immediately before POST.
    const renewed=toteatExportControls();
    const current=await getCompanyIntegration(COMPANY,"toteat");
    if(!renewed.enabled||renewed.cutover!==controls.cutover||
       renewed.onlyOrderId!==controls.onlyOrderId||
       current?.enabled!==true||current.status!=="connected")
      throw new Error("EXPORT_DISABLED_DURING_PREPARATION");
    postAttempted=true; // From here even a network error may mean Toteat got it.
    const result=await submitOneToteatOrder({
      credentials:parsed.value,
      orderReference:prepared.orderReference,
      serializedBody:serializeToteatExternalOrder(body.value)
    });
    outcome=result.outcome;
    externalId=result.externalOrderId;
    reason=result.evidence;
  }catch(error){
    // A failed LOCAL preflight consumes this one attempt without any POST.
    // Unknown is safer than silently requeuing a potential external order.
    reason=error instanceof Error?error.message:"UNKNOWN";
    outcome=postAttempted?"unknown":"rejected";externalId=null;
  }
  try{await finish(claim.id,outcome,externalId);}
  catch{
    console.error("[DELI TOTEAT EXPORT] DB_FINALIZATION_REQUIRES_MANUAL_RECONCILIATION",
      {id:claim.id});
    return {action:"finished",reason:"DB_FINALIZATION_FAILED",outcome:"unknown"};
  }
  console.log("[DELI TOTEAT EXPORT]",{exportId:claim.id,
    outcome,reason,reference:claim.external_reference,
    ...(outcome==="accepted"?{externalId}:{} )});
  return {action:"finished",reason,outcome};
}
export function startToteatExportWorker():void{
  if(started || !toteatExportControls().enabled)return;
  started=true;
  const timer=setInterval(()=>{
    if(busy)return;
    busy=true;
    void exportOneConfirmedWhatsappOrder().catch(()=>{
      console.error("[DELI TOTEAT EXPORT] WORKER_EXCEPTION");
    }).finally(()=>{busy=false;});
  },30_000); // provider GET /products + shiftstatus <= 2/min
  timer.unref();
  console.log("[DELI TOTEAT EXPORT] armed for NEW orders after cutover, default OFF");
}
