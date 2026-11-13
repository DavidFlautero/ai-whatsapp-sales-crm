/**
 * Read-only readiness checks for QR order pilot.
 * Does not create an order or use a real QR token.
 */
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
config({path:"../../.env",quiet:true});

async function main(){
  const {supabaseRequest}=await import("../services/db/supabase-rest.client.js");
  const tables=await supabaseRequest<Array<{id:string;label:string;enabled:boolean;updated_at:string}>>({
    table:"restaurant_ops_qr_tables",
    query:"?company_id=eq.delibocados&label=eq.Mesa%206&enabled=eq.true&select=id,label,enabled,updated_at&limit=2"
  });
  if(tables.length!==1)throw new Error("PILOT_TABLE_NOT_UNIQUE");
  const threshold=process.env.DELIBOCADOS_QR_REQUIRE_ROTATION_AFTER;
  if(threshold){
    const rotatedAt=new Date(tables[0].updated_at).getTime();
    const minimum=new Date(threshold).getTime();
    if(!Number.isFinite(rotatedAt)||!Number.isFinite(minimum)||rotatedAt<=minimum)
      throw new Error("PILOT_QR_MUST_BE_REGENERATED_AFTER_MENU_DEPLOY");
  }
  const tableId=tables[0].id;
  const menus=await supabaseRequest<Array<{revision:number;payload:{products?:Array<{
    id:string;name:string;priceCOP:number;priceNeedsReview?:boolean;available?:boolean
  }>}}>>({
    table:"restaurant_menu_documents",
    query:"?company_id=eq.delibocados&select=revision,payload&limit=1"
  });
  const catalog=menus[0];
  if(!catalog||!Number.isSafeInteger(catalog.revision)||catalog.revision<1)
    throw new Error("MENU_REVISION_NOT_READY");
  const eligible=(catalog.payload?.products||[]).filter(p=>
    typeof p.id==="string"&&typeof p.name==="string"&&
    p.available!==false&&p.priceNeedsReview!==true&&
    Number.isSafeInteger(p.priceCOP)&&p.priceCOP>=0);
  if(eligible.length<10)throw new Error("MENU_HAS_TOO_FEW_VERIFIED_PRODUCTS");

  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error("SUPABASE_NOT_CONFIGURED");
  // Invalid tenant + customerConfirmed=false triggers the function's very
  // first authorization check, before any order/queue writes.
  const probe=await fetch(url.replace(/\/+$/,"")+
      "/rest/v1/rpc/restaurant_ops_create_qr_order",{
    method:"POST",
    headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},
    body:JSON.stringify({
      p_company_id:"__readiness_only__",p_source_key:randomUUID(),
      p_qr_kind:"table",p_qr_token:"0".repeat(48),
      p_table_id:tableId,p_customer_phone:"000000000000",p_customer_name:"Test",
      p_items:[],p_expected_menu_revision:catalog.revision,
      p_payment_method:"cash",p_payment_status:"pending",
      p_customer_confirmed:false,p_customer_note:""
    })
  });
  const json=await probe.json().catch(()=>null) as Record<string,unknown>|null;
  if(probe.ok)throw new Error("UNEXPECTED_RPC_MUTATION");
  if(!json||typeof json.message!=="string"||
     !json.message.includes("QR_CHECKOUT_NOT_AUTHORIZED"))
    throw new Error("QR_ORDER_RPC_NOT_READY");
  console.log("QR_PREFLIGHT_OK");
  console.log("PILOT_TABLE_ID="+tableId);
  console.log("MENU_REVISION="+catalog.revision);
  console.log("VERIFIED_PRODUCTS="+eligible.length);
}
void main().catch(err=>{
  console.error("QR_PREFLIGHT_BLOCKED="+(err instanceof Error?err.message:"UNKNOWN"));
  process.exitCode=1;
});
