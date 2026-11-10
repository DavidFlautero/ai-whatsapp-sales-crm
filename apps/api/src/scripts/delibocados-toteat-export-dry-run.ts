/** Read-only verification of prepared orders for Toteat; NEVER sends a POST. */
import {config} from "dotenv";
config({path:"../../.env",quiet:true});
async function main(){
  const [{supabaseRequest},{prepareToteatLines}]=await Promise.all([
    import("../services/db/supabase-rest.client.js"),
    import("../services/restaurant-ops/restaurant-toteat-preparation.service.js")
  ]);
  const [exports,mappings]=await Promise.all([
    supabaseRequest<Array<{order_id:string;status:string;external_reference:string}>>({
      table:"restaurant_ops_pos_exports",
      query:"?company_id=eq.delibocados&provider=eq.toteat"+
        "&select=order_id,status,external_reference&order=created_at.desc&limit=50"
    }),
    supabaseRequest<Array<{
      product_id:string;external_product_code:string;active:boolean;reviewed_at:string|null;
    }>>({
      table:"restaurant_ops_pos_product_map",
      query:"?company_id=eq.delibocados&provider=eq.toteat"+
        "&select=product_id,external_product_code,active,reviewed_at&limit=1500"
    })
  ]);
  const reviewed=mappings.filter(x=>x.active&&x.reviewed_at).length;
  console.log("=== TOTEAT / PREPARACION SIN ENVIOS ===");
  console.log("MAPEOS APROBADOS:",reviewed);
  console.log("EXPORTACIONES EXISTENTES:",exports.length);
  const statuses:Record<string,number>={};
  for(const ex of exports)statuses[ex.status]=(statuses[ex.status]??0)+1;
  console.log("ESTADOS:",JSON.stringify(statuses));
  for(const entry of exports.slice(0,15)){
    const orders=await supabaseRequest<Array<{
      id:string;company_id:string;source:string;status:string;payment_status:string;
      fulfillment_mode:string;subtotal_cop:number;delivery_fee_cop:number;total_cop:number;
    }>>({
      table:"restaurant_ops_orders",
      query:"?company_id=eq.delibocados&id=eq."+encodeURIComponent(entry.order_id)+
        "&select=id,company_id,source,status,payment_status,fulfillment_mode,"+
        "subtotal_cop,delivery_fee_cop,total_cop&limit=1"
    });
    const items=await supabaseRequest<Array<{
      product_id:string;product_name:string;quantity:number;unit_price_cop:number;instructions:string;
    }>>({
      table:"restaurant_ops_order_items",
      query:"?company_id=eq.delibocados&order_id=eq."+encodeURIComponent(entry.order_id)+
        "&select=product_id,product_name,quantity,unit_price_cop,instructions"
    });
    if(!orders[0])continue;
    const prep=prepareToteatLines(orders[0],items,mappings);
    console.log("EXPORTACION",entry.external_reference.slice(0,24),{
      status:entry.status,lines:items.length,
      ready:prep.ready,
      result:prep.ready?"DOCUMENT_CONTRACT_STILL_PENDING":prep.reason
    });
  }
  console.log("POST A TOTEAT: DESHABILITADO");
  console.log("IMPRESION: NO REALIZADA");
  console.log("=== FIN ===");
}
void main().catch(error=>{
  console.error("PRECHECK_FAILED",{
    type:error instanceof Error?error.name:"UNKNOWN"
  });
  process.exitCode=1;
});
