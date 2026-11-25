/**
 * Delibocados public QR checkout. Normal checkout is disabled by default.
 * An independently gated one-use Mesa 1 pilot is opt-in and enforced in SQL.
 * No POS transport / printing here.
 * QR token is sent only inside POST JSON, never as a query parameter or log.
 */
import { createHash } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z, ZodError } from "zod";
import { supabaseRequest, supabaseRpc } from "../services/db/supabase-rest.client.js";
import { quoteVerifiedDeliveryAddress } from "../services/restaurant-ops/restaurant-delivery-routing.service.js";

export const restaurantQrPublicRoutes=Router();
// /context accepts a UUID or the editor ID (mesa_<32 hex>).
// /order still requires the verified UUID returned by /context.
const base=z.object({
  kind:z.enum(["table","general"]),
  tableId:z.union([z.string().uuid(),z.string().regex(/^mesa_[0-9a-f]{32}$/)]),
  token:z.string().min(32).max(200).regex(/^[A-Za-z0-9_-]+$/)
}).strict();
const orderInput=base.extend({
  tableId:z.string().uuid(),
  sourceKey:z.string().uuid(),
  customerName:z.string().trim().min(2).max(120),
  customerPhone:z.union([z.string().regex(/^[0-9]{8,15}$/),z.literal("")]).optional(),
  items:z.array(z.object({
    productId:z.string().trim().min(1).max(100),
    quantity:z.number().int().min(1).max(25),
    instructions:z.string().max(500).optional()
  }).strict()).min(1).max(60),
  expectedMenuRevision:z.number().int().positive(),
  paymentMethod:z.enum(["cash","transfer"]),
  customerNote:z.string().max(2000).optional(),
  customerConfirmed:z.literal(true)
}).strict();

type Table={id:string;company_id:string;label:string;enabled:boolean;qr_token_sha256:string};
type General={enabled:boolean;qr_token_sha256:string};
type MenuDoc={revision:number;payload:{products?:Array<{
  id?:string;name?:string;category?:string;available?:boolean;
  priceNeedsReview?:boolean;priceCOP?:number
}>}};
type Row=Record<string,unknown>;
type SessionRow={id:string;opened_at:string};
type AccountOrderRow={
  id:string;number:number;status:string;total_cop:number;created_at:string;
  restaurant_ops_order_items?:Array<{
    product_name:string;quantity:number;line_total_cop:number;instructions:string
  }>;
};
/** The single-use pilot gate is consulted only for its public availability bit.
 * SQL rechecks and locks the same row before creating ANY order.
 */
async function pilotGateOpen(tableId:string):Promise<boolean>{
  const gates=await supabaseRequest<Array<{
    table_id:string;enabled:boolean;valid_from:string|null;
    expires_at:string|null;consumed_at:string|null;
  }>>({
    table:"restaurant_ops_qr_single_use_pilot",
    query:"?singleton=eq.1&select=table_id,enabled,valid_from,expires_at,consumed_at&limit=1"
  });
  const g=gates[0];
  const now=Date.now();
  return Boolean(g&&g.table_id===tableId&&g.enabled&&!g.consumed_at&&
    g.valid_from&&g.expires_at&&
    Date.parse(g.valid_from)<=now&&Date.parse(g.expires_at)>now);
}

/** A verified table QR is a capability: return its check without customer PII. */
async function loadOpenTableAccount(tableId:string){
  const sessions=await supabaseRequest<SessionRow[]>({
    table:"restaurant_ops_table_sessions",
    query:"?company_id=eq.delibocados&qr_table_id=eq."+encodeURIComponent(tableId)+
      "&status=eq.open&select=id,opened_at&limit=1"
  });
  const session=sessions[0];
  if(!session)return null;
  const orders=await supabaseRequest<AccountOrderRow[]>({
    table:"restaurant_ops_orders",
    query:"?company_id=eq.delibocados&table_session_id=eq."+encodeURIComponent(session.id)+
      "&select=id,number,status,total_cop,created_at,"+
      "restaurant_ops_order_items(product_name,quantity,line_total_cop,instructions)"+
      "&order=created_at.asc&limit=200"
  });
  return {
    id:session.id,openedAt:session.opened_at,
    orders:orders.map(o=>({
      number:o.number,status:o.status,
      createdAt:o.created_at,totalCOP:o.status==="cancelled"?0:o.total_cop,
      items:o.status==="cancelled"?[]:(o.restaurant_ops_order_items??[]).map(i=>({
        name:i.product_name,quantity:i.quantity,totalCOP:i.line_total_cop,
        instructions:i.instructions
      }))
    })),
    totalCOP:orders.reduce((n,o)=>n+(o.status==="cancelled"?0:o.total_cop),0),
    truncated:orders.length===200
  };
}
const counters=new Map<string,{count:number;reset:number}>();
function limited(req:Request,max:number):boolean{
  const now=Date.now();const key=(req.ip||"unknown").slice(0,100)+":"+(req.path||"");
  const entry=counters.get(key);
  if(counters.size>5000){
    for(const [k,v] of counters)if(v.reset<=now)counters.delete(k);
  }
  if(!entry||entry.reset<=now){counters.set(key,{count:1,reset:now+60000});return false;}
  entry.count+=1;
  return entry.count>max;
}
function jsonError(res:Response,status:number,error:string){
  return res.status(status).setHeader("Cache-Control","no-store").json({ok:false,error});
}
async function verifiedTable(input:z.infer<typeof base>):Promise<{id:string;label:string}|null>{
  const hash=createHash("sha256").update(input.token).digest("hex");
  // Resolve the editor's public identifier to a DB UUID before checkout.
  // The editor ID alone never grants authority; the active table's token hash
  // must still match. Raw tokens are never logged or returned.
  const lookupColumn=input.tableId.startsWith("mesa_")?"editor_table_id":"id";
  const tables=await supabaseRequest<Table[]>({table:"restaurant_ops_qr_tables",
    query:"?company_id=eq.delibocados&"+lookupColumn+"=eq."+encodeURIComponent(input.tableId)+
      "&enabled=eq.true&select=id,company_id,label,enabled,qr_token_sha256&limit=1"});
  const table=tables[0];
  if(!table)return null;
  if(input.kind==="table"){
    if(table.qr_token_sha256!==hash)return null;
  }else{
    const rows=await supabaseRequest<General[]>({table:"restaurant_ops_qr_general",
      query:"?company_id=eq.delibocados&enabled=eq.true"+
        "&select=enabled,qr_token_sha256&limit=1"});
    if(rows[0]?.qr_token_sha256!==hash)return null;
  }
  return {id:table.id,label:table.label};
}

/** Public menu photo/description adapter. Do not expose arbitrary URLs or credentials. */
function enrichMenuProducts<T extends {id?:string}>(menu:MenuDoc,products:T[]){
 const originals=menu.payload.products??[];
 const details=new Map<string,(typeof originals)[number]>();
 for(const p of originals){if(typeof p.id==="string")details.set(p.id,p);}
 const assets=(menu.payload as {images?:Record<string,unknown>}).images??{};
 return products.map(p=>{
   const original=details.get(p.id??"") as (typeof originals)[number]&{description?:unknown;imageId?:unknown}|undefined;
   const description=typeof original?.description==="string"?original.description.slice(0,400):"";
   const img=assets[String(original?.imageId??"")];
   const value=typeof img==="string"?img:"";
   let imageUrl:string|null=null;
   if(/^\/restaurant-menu-media\/[a-f0-9]{32}\.(png|jpg|webp)$/i.test(value))imageUrl="https://delibocados.online"+value;
   else if(/^https:\/\/delibocados\.online\/restaurant-menu-media\/[a-f0-9]{32}\.(png|jpg|webp)$/i.test(value))imageUrl=value;
   else if(value.length<250000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))imageUrl=value;
   return {...p,description,imageUrl};
 });
}

async function handler(req:Request,res:Response,checkout:boolean){
  const normalEnabled=process.env.DELIBOCADOS_QR_CHECKOUT_ENABLED==="1";
  const pilotConfigured=process.env.DELIBOCADOS_QR_MESA1_PILOT_ENABLED==="1";
  const previewEnabled=process.env.DELIBOCADOS_QR_MENU_PREVIEW_ENABLED==="1";
  // Never combine the full public checkout and the tightly scoped pilot.
  if(normalEnabled&&pilotConfigured)
    return jsonError(res,503,"QR_MODE_CONFLICT");
  // The pilot flag never enables unrestricted checkout.
  if(!normalEnabled&&!pilotConfigured&&(checkout||!previewEnabled))
    return jsonError(res,503,"QR_CHECKOUT_NOT_ENABLED");
  // Enabled tables with a valid per-table or general QR capability can order.
  // Identity is verified against the enabled Supabase registry, never a
  // browser-submitted table label or an unverified editor identifier.
  if(limited(req,checkout?5:20))
    return jsonError(res,429,"QR_RATE_LIMIT");
  if(!req.is("application/json"))
    return jsonError(res,415,"JSON_REQUIRED");
  let input:z.infer<typeof base>|z.infer<typeof orderInput>;
  try {
    input=(checkout?orderInput:base).parse(req.body);
  }catch(e){
    return jsonError(res,400,e instanceof ZodError?"INVALID_INPUT":"BAD_REQUEST");
  }
  try{
    const table=await verifiedTable(input);
    if(!table)return jsonError(res,404,"QR_NOT_AVAILABLE");

    // Token verification is independent of the additional one-use pilot gate.
    // The pilot is constrained a second time by the transactional SQL RPC.
    if(!checkout){
      const ordersEnabled=normalEnabled||Boolean(
        pilotConfigured&&input.kind==="table"&&table.label==="Mesa 1"&&
        await pilotGateOpen(table.id)
      );
      const menus=await supabaseRequest<MenuDoc[]>({
        table:"restaurant_menu_documents",
        query:"?company_id=eq.delibocados&select=revision,payload&limit=1"
      });
      const menu=menus[0];
      if(!menu)return jsonError(res,503,"MENU_NOT_AVAILABLE");
      const products=(menu.payload.products??[]).filter(p=>
        typeof p.id==="string"&&typeof p.name==="string"&&
        p.available!==false&&p.priceNeedsReview!==true&&
        Number.isSafeInteger(p.priceCOP)&&Number(p.priceCOP)>=0
      ).slice(0,600).map(p=>({
        id:p.id,name:p.name,category:p.category??"",priceCOP:p.priceCOP
      }));
      const richProducts=enrichMenuProducts(menu,products);
      // An armed pilot presents only the sole SKU that SQL permits.
      const visibleProducts=pilotConfigured&&ordersEnabled
        ? richProducts.filter(p=>p.id==="deli-006"&&p.priceCOP===14000)
        : richProducts;
      const account=await loadOpenTableAccount(table.id);
      res.setHeader("Cache-Control","no-store");
      return res.json({ok:true,table,revision:menu.revision,
        products:visibleProducts,ordersEnabled,account});
    }
    const payload=input as z.infer<typeof orderInput>;
    if(!normalEnabled){
      // Shallow rejection in HTTP; the SQL pilot function enforces all conditions
      // again within an atomic transaction. Nothing here can authorize another table.
      if(!pilotConfigured||payload.kind!=="table"||
         table.label!=="Mesa 1"||payload.paymentMethod!=="cash"||
         payload.items.length!==1||
         payload.items[0].productId!=="deli-006"||
         payload.items[0].quantity!==1||
         (payload.items[0].instructions??"").trim()!==""||
         (payload.customerNote??"").length>220)
        return jsonError(res,403,"QR_PILOT_SCOPE_DENIED");
    }
    const order=await supabaseRpc<Row>(
      normalEnabled?"restaurant_ops_create_qr_order":"restaurant_ops_create_qr_order_pilot",{
      p_company_id:"delibocados",
      p_source_key:payload.sourceKey,
      p_qr_kind:payload.kind,
      p_qr_token:payload.token,
      p_table_id:payload.tableId,
      p_customer_phone:payload.customerPhone?.trim()||null,
      p_customer_name:payload.customerName,
      p_items:payload.items,
      p_expected_menu_revision:payload.expectedMenuRevision,
      p_payment_method:payload.paymentMethod,
      p_payment_status:payload.paymentMethod==="cash"?"cash_on_delivery":"pending",
      p_customer_confirmed:true,
      p_customer_note:payload.customerNote??""
    });
    if(order.source!=="qr"||order.fulfillment_mode!=="dine_in"||
      order.qr_table_id!==payload.tableId)
      return jsonError(res,503,"QR_ORDER_UNVERIFIED");
    // The order has already committed. A failed read of the running bill
    // must NEVER turn a successful checkout into an ambiguous 503/retry.
    let account:Awaited<ReturnType<typeof loadOpenTableAccount>>=null;
    try {
      account=await loadOpenTableAccount(table.id);
    } catch {
      console.error("[DELI QR ACCOUNT]",{error:"POST_CHECKOUT_READ_FAILED"});
    }
    res.setHeader("Cache-Control","no-store");
    return res.status(201).json({
      ok:true,order:{id:order.id,number:order.number,
        status:order.status,paymentStatus:order.payment_status,
        totalCOP:order.total_cop,table:table.label},
      account,
      note:"Pedido agregado a la cuenta de mesa. Confirmar recepción en cocina."
    });
  }catch(e){
    // Never print tokens, SQL arguments, raw errors or client identities.
    console.error("[DELI QR CHECKOUT]",{error:"DATABASE_OR_VALIDATION_FAILURE"});
    return jsonError(res,503,"QR_OPERATION_UNAVAILABLE");
  }
}

/**
 * Public checkout on the already-published /context and /order paths.
 * No user-supplied price, fee or zone is trusted. Public orders remain
 * OFF unless DELIBOCADOS_WEB_CHECKOUT_ENABLED=1.
 */
const webLine=z.object({
  productId:z.string().trim().min(1).max(100),
  quantity:z.number().int().min(1).max(25),
  instructions:z.string().max(500).optional()
}).strict();
const webContext=z.object({
  kind:z.enum(["pickup","delivery"]),
  address:z.string().trim().max(300).optional()
}).strict();
const webOrder=webContext.extend({
  sourceKey:z.string().uuid(),
  customerName:z.string().trim().min(2).max(120),
  customerPhone:z.string().regex(/^[0-9]{8,15}$/),
  items:z.array(webLine).min(1).max(60),
  expectedMenuRevision:z.number().int().positive(),
  paymentMethod:z.enum(["cash","transfer"]),
  customerNote:z.string().max(2000).optional(),
  addressNote:z.string().max(500).optional(),
  customerConfirmed:z.literal(true)
}).strict();

async function handleWeb(req:Request,res:Response,checkout:boolean){
  // READ_ONLY_PICKUP_CONTEXT_BOOTSTRAP_V1:
  // The original static carta.html fetches pickup menu metadata BEFORE its
  // independently verified table QR context. A 503 here aborts init().
  // Allow ONLY read-only pickup context while web checkout remains off.
  // Never allow an order or a delivery quote through this exception.
  if(process.env.DELIBOCADOS_WEB_CHECKOUT_ENABLED!=="1" &&
     (checkout || req.body?.kind!=="pickup"))
    return jsonError(res,503,"WEB_CHECKOUT_NOT_ENABLED");
  if(limited(req,checkout?3:20))return jsonError(res,429,"WEB_RATE_LIMIT");
  if(!req.is("application/json"))return jsonError(res,415,"JSON_REQUIRED");
  const parsed=(checkout?webOrder:webContext).safeParse(req.body);
  if(!parsed.success)return jsonError(res,400,"INVALID_INPUT");
  try{
    if(!checkout){
      const v=parsed.data as z.infer<typeof webContext>;
      const docs=await supabaseRequest<MenuDoc[]>({
        table:"restaurant_menu_documents",
        query:"?company_id=eq.delibocados&select=revision,payload&limit=1"
      });
      const doc=docs[0];
      if(!doc)return jsonError(res,503,"MENU_NOT_AVAILABLE");
      const products=(doc.payload.products??[]).filter(p=>
        typeof p.id==="string"&&typeof p.name==="string"&&
        p.available!==false&&p.priceNeedsReview!==true&&
        Number.isSafeInteger(p.priceCOP)&&Number(p.priceCOP)>=0
      ).slice(0,600).map(p=>({
        id:p.id,name:p.name,category:p.category??"",priceCOP:p.priceCOP
      }));
      let quote:unknown=null;
      if(v.kind==="delivery"&&v.address&&v.address.length>=8)
        quote=await quoteVerifiedDeliveryAddress(v.address);
      res.setHeader("Cache-Control","no-store");
      return res.json({ok:true,revision:doc.revision,products,quote});
    }
    const v=parsed.data as z.infer<typeof webOrder>;
    let zoneId:string|null=null;
    if(v.kind==="delivery"){
      if(!v.address || v.address.length<8)
        return jsonError(res,422,"DELIVERY_ADDRESS_REQUIRED");
      const quote=await quoteVerifiedDeliveryAddress(v.address);
      if(!quote.covered||!quote.zone?.id)
        return jsonError(res,422,"DELIVERY_NOT_AVAILABLE");
      zoneId=quote.zone.id;
    }
    const order=await supabaseRpc<Row>("restaurant_ops_create_order",{
      p_company_id:"delibocados",p_source:"web",
      p_source_key:v.sourceKey,p_customer_phone:v.customerPhone,
      p_customer_name:v.customerName,p_fulfillment_mode:v.kind,
      p_items:v.items,p_zone_id:zoneId,p_address:v.kind==="delivery"?v.address:null,
      p_address_note:v.addressNote??null,p_customer_note:v.customerNote??null,
      p_pickup_due_at:null,p_actor_id:"web-checkout",p_actor_role:"system",
      p_customer_confirmed:true,p_expected_menu_revision:v.expectedMenuRevision,
      p_payment_method:v.paymentMethod,
      p_payment_status:v.paymentMethod==="cash"?"cash_on_delivery":"pending"
    });
    if(order.source!=="web"||order.fulfillment_mode!==v.kind)
      return jsonError(res,503,"WEB_ORDER_UNVERIFIED");
    res.setHeader("Cache-Control","no-store");
    return res.status(201).json({ok:true,
      order:{id:order.id,number:order.number,status:order.status,
        paymentStatus:order.payment_status,totalCOP:order.total_cop,
        fulfillmentMode:order.fulfillment_mode},
      note:"Pedido registrado en Neuromind. Cocina debe confirmar recepción; no implica impresión en SmartPOS."
    });
  }catch{
    // Never print customer info, payloads, RPC parameters or payment details.
    console.error("[DELIBOCADOS WEB CHECKOUT]",{error:"OPERATION_FAILED"});
    return jsonError(res,503,"WEB_OPERATION_UNAVAILABLE");
  }
}

restaurantQrPublicRoutes.post("/context",async(req,res)=>{
  if(req.body?.kind==="pickup"||req.body?.kind==="delivery")return void await handleWeb(req,res,false);
  await handler(req,res,false);
});
restaurantQrPublicRoutes.post("/order",async(req,res)=>{
  if(req.body?.kind==="pickup"||req.body?.kind==="delivery")return void await handleWeb(req,res,true);
  await handler(req,res,true);
});

/**
 * General QR: list ACTIVE tables only after verifying the opaque general token.
 * No customer identity or raw QR secrets are included in the response.
 */
restaurantQrPublicRoutes.post("/tables",async(req,res)=>{
 if(process.env.DELIBOCADOS_QR_CHECKOUT_ENABLED!=="1" &&
    process.env.DELIBOCADOS_QR_MENU_PREVIEW_ENABLED!=="1")
   return jsonError(res,503,"QR_CHECKOUT_NOT_ENABLED");
 if(limited(req,20))return jsonError(res,429,"QR_RATE_LIMIT");
 if(!req.is("application/json"))return jsonError(res,415,"JSON_REQUIRED");
 const parsed=z.object({kind:z.literal("general"),
   token:z.string().min(32).max(200).regex(/^[A-Za-z0-9_-]+$/)}).strict().safeParse(req.body);
 if(!parsed.success)return jsonError(res,400,"INVALID_INPUT");
 try{
   const hash=createHash("sha256").update(parsed.data.token).digest("hex");
   const generals=await supabaseRequest<General[]>({table:"restaurant_ops_qr_general",
     query:"?company_id=eq.delibocados&enabled=eq.true"+
       "&select=enabled,qr_token_sha256&limit=1"});
   if(generals[0]?.qr_token_sha256!==hash)
     return jsonError(res,404,"QR_NOT_AVAILABLE");
   const tables=await supabaseRequest<Array<{id:string;label:string}>>({
     table:"restaurant_ops_qr_tables",
     query:"?company_id=eq.delibocados&enabled=eq.true"+
       "&select=id,label&order=label.asc&limit=80"
   });
   res.setHeader("Cache-Control","no-store");
   const menuDocs=await supabaseRequest<MenuDoc[]>({table:"restaurant_menu_documents",
      query:"?company_id=eq.delibocados&select=revision,payload&limit=1"});
    const menu=menuDocs[0];
    if(!menu)return jsonError(res,503,"MENU_NOT_AVAILABLE");
    const rawProducts=(menu.payload.products??[])
      .filter(p=>typeof p.id==="string"&&typeof p.name==="string"&&p.available!==false&&
        p.priceNeedsReview!==true&&Number.isSafeInteger(p.priceCOP)&&Number(p.priceCOP)>=0)
      .slice(0,600)
      .map(p=>({id:String(p.id),name:String(p.name),category:String(p.category??""),priceCOP:Number(p.priceCOP)}));
    const generalProducts=enrichMenuProducts(menu,rawProducts);
    return res.json({ok:true,tables,revision:menu.revision,products:generalProducts});
 }catch{
   return jsonError(res,503,"QR_SERVICE_UNAVAILABLE");
 }
});
