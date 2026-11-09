/**
 * Read-only Stage 1+2 readiness probe. No Whapi, no Toteat POST, no orders.
 */
import {config} from "dotenv";
config({path:"../../.env",quiet:true});
async function main(){
  const [{supabaseRequest},{parseNaturalItemSelection,buildOrderSummary},
    {explicitPurchaseStatement,explicitFulfillment},
    {interpretNaturalPreparation}]=await Promise.all([
      import("../services/db/supabase-rest.client.js"),
      import("../services/restaurant-ops/restaurant-whatsapp-checkout.service.js"),
      import("../services/restaurant-ops/restaurant-natural-checkout-routing.service.js"),
      import("../services/restaurant-ops/restaurant-cart-intake.service.js")
    ]);
  const [docs,mappings]=await Promise.all([
    supabaseRequest<Array<{revision:number;payload:{products:Array<{
      id:string;name:string;priceCOP:number;available?:boolean;priceNeedsReview?:boolean
    }>}}>>({
      table:"restaurant_menu_documents",
      query:"?company_id=eq.delibocados&select=revision,payload&limit=1"
    }),
    supabaseRequest<Array<{product_id:string;external_product_code:string;
      active:boolean;reviewed_at:string|null}>>({
      table:"restaurant_ops_pos_product_map",
      query:"?company_id=eq.delibocados&provider=eq.toteat"+
        "&select=product_id,external_product_code,active,reviewed_at&limit=1500"
    })
  ]);
  const all=docs[0]?.payload?.products??[];
  const available=all.filter(p=>p.id&&p.name&&p.available!==false&&
    p.priceNeedsReview!==true&&Number.isSafeInteger(Number(p.priceCOP))&&
    Number(p.priceCOP)>=0);
  const matched=mappings.filter(m=>m.active&&Boolean(m.reviewed_at));
  const localIds=new Set(available.map(x=>x.id));
  const reviewed=matched.filter(x=>localIds.has(x.product_id));
  const input="Hola, quiero una hamburguesa tradicional y una Coca Cola Retornable 250 para retirar en el local. ¿Cuánto me sale todo?";
  const lines=parseNaturalItemSelection(input,available);
  const prep=lines?interpretNaturalPreparation(input,lines):null;
  const ready=prep?.kind==="safe"&&prep.lines.length===2 &&
    explicitPurchaseStatement(input)&&explicitFulfillment(input)==="pickup";
  console.log("=== DELIBOCADOS / ETAPAS 1 Y 2 / SOLO LECTURA ===");
  console.log("Revision:",docs[0]?.revision??"MISSING");
  console.log("Productos:",all.length,"Vendibles verificados:",available.length);
  console.log("Mapeos Toteat revisados:",reviewed.length);
  console.log("Chicharron:",all.find(x=>x.id==="deli-055")?.priceNeedsReview===false
    ?"APROBADO":"PENDIENTE");
  if(ready){
    const summary=buildOrderSummary({
      id:"dry-run",createdAt:new Date().toISOString(),menuRevision:docs[0].revision,
      stage:"confirm",items:prep.lines,mode:"pickup",
      customerName:"Prueba Técnica",payment:"cash"
    },available,[]);
    console.log("Simulacion de compra:",prep.lines.map(l=>l.productId).join(", "));
    console.log("Total simulacion COP:",summary.total);
    console.log("Confirmacion explicita requerida:",summary.text.includes("CONFIRMAR PEDIDO"));
  }else console.log("Compra simulada: PRODUCT_MATCH_OR_ROUTING_PENDING");
  const allReady=all.length===133&&available.length===133&&
    reviewed.length===133&&ready;
  console.log("ETAPAS 1/2 READY (SOLO PRUEBAS):",allReady?"YES":"NO");
  console.log("NO POST / NO WHATSAPP / NO IMPRESION / NO DB WRITES");
  if(!allReady)process.exitCode=2;
}
void main().catch(error=>{
  console.error("READINESS_FAILED",error instanceof Error?error.name:"UNKNOWN");
  process.exitCode=1;
});
