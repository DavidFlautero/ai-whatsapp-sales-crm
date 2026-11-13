/**
 * Delibocados public QR checkout. DISABLED unless the API process explicitly
 * has DELIBOCADOS_QR_CHECKOUT_ENABLED=1. No POS transport / printing here.
 * QR token is sent only inside POST JSON, never as a query parameter or log.
 */
import { createHash } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z, ZodError } from "zod";
import { supabaseRequest, supabaseRpc } from "../services/db/supabase-rest.client.js";

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
  customerPhone:z.string().regex(/^[0-9]{8,15}$/),
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
type MenuProduct={id?:string;name?:string;category?:string;description?:string;
  imageId?:string|number|null;available?:boolean;priceNeedsReview?:boolean;priceCOP?:number};
type MenuDoc={revision:number;payload:{
  products?:MenuProduct[];
  categories?:Array<{name?:string;label?:string}>;
  images?:Record<string,string>;
}};
const PUBLIC_MEDIA_ORIGIN="https://delibocados.online";
function publicImage(source:unknown):string|null{
  if(typeof source!=="string")return null;
  if(/^\/restaurant-menu-media\/[a-f0-9]{32}\.(?:png|jpe?g|webp)$/.test(source))
    return PUBLIC_MEDIA_ORIGIN+source;
  // Public data-image is present in some historical catalogs. Cap it to
  // avoid amplifying huge originals across hundreds of menu cards.
  if(/^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(source)
      && source.length<200000)return source;
  return null;
}
type Row=Record<string,unknown>;
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
function inputTablePilotMissing(input:unknown,pilot:string):boolean{
  if(!/^[0-9a-f-]{36}$/i.test(pilot))return true;
  if(!input||typeof input!=="object")return true;
  const id=(input as Record<string,unknown>).tableId;
  return typeof id!=="string"||id.toLowerCase()!==pilot.toLowerCase();
}

async function handler(req:Request,res:Response,checkout:boolean){
  const ordersEnabled=process.env.DELIBOCADOS_QR_CHECKOUT_ENABLED==="1";
  const previewEnabled=process.env.DELIBOCADOS_QR_MENU_PREVIEW_ENABLED==="1";
  // Read-only preview can load verified products but cannot place an order.
  if(!ordersEnabled && (checkout || !previewEnabled))
    return jsonError(res,503,"QR_CHECKOUT_NOT_ENABLED");
  // The pilot restricts WRITES, not browsing the real catalogue.
  // A valid signed QR for any enabled table may see a read-only menu.
  // Only the one nominated UUID may create orders.
  const pilot=process.env.DELIBOCADOS_QR_PILOT_TABLE_ID?.trim();
  if(checkout && pilot && inputTablePilotMissing(req.body,pilot))
    return jsonError(res,503,"QR_NOT_ENABLED_FOR_TABLE");
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
    if(!checkout){
      const menus=await supabaseRequest<MenuDoc[]>({
        table:"restaurant_menu_documents",
        query:"?company_id=eq.delibocados&select=revision,payload&limit=1"
      });
      const menu=menus[0];
      if(!menu)return jsonError(res,503,"MENU_NOT_AVAILABLE");
      const media=menu.payload.images??{};
      const products=(menu.payload.products??[]).filter(p=>
        typeof p.id==="string"&&typeof p.name==="string"&&
        p.available!==false&&p.priceNeedsReview!==true&&
        Number.isSafeInteger(p.priceCOP)&&Number(p.priceCOP)>=0
      ).slice(0,600).map(p=>({
        id:p.id,name:p.name,category:p.category??"",priceCOP:p.priceCOP,
        description:typeof p.description==="string"?p.description.slice(0,600):"",
        imageUrl:publicImage(p.imageId==null?null:media[String(p.imageId)])
      }));
      const categories=(menu.payload.categories??[])
        .filter(x=>typeof x.name==="string"&&x.name.length>0)
        .map(x=>({name:x.name??"",label:x.label??x.name??""}));
      res.setHeader("Cache-Control","no-store");
      return res.json({ok:true,table,revision:menu.revision,products,categories,
        ordersEnabled:ordersEnabled&&(!pilot||table.id.toLowerCase()===pilot.toLowerCase())});
    }
    const payload=input as z.infer<typeof orderInput>;
    const order=await supabaseRpc<Row>("restaurant_ops_create_qr_order",{
      p_company_id:"delibocados",
      p_source_key:payload.sourceKey,
      p_qr_kind:payload.kind,
      p_qr_token:payload.token,
      p_table_id:payload.tableId,
      p_customer_phone:payload.customerPhone,
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
    res.setHeader("Cache-Control","no-store");
    return res.status(201).json({
      ok:true,order:{id:order.id,number:order.number,
        status:order.status,paymentStatus:order.payment_status,
        totalCOP:order.total_cop,table:table.label},
      note:"Pedido registrado internamente. Confirmar recepción en cocina."
    });
  }catch(e){
    // Never print tokens, SQL arguments, raw errors or client identities.
    console.error("[DELI QR CHECKOUT]",{error:"DATABASE_OR_VALIDATION_FAILURE"});
    return jsonError(res,503,"QR_OPERATION_UNAVAILABLE");
  }
}
restaurantQrPublicRoutes.post("/context",async(req,res)=>{await handler(req,res,false);});
restaurantQrPublicRoutes.post("/order",async(req,res)=>{await handler(req,res,true);});

/**
 * General QR: list ACTIVE tables only after verifying the opaque general token.
 * No customer identity or raw QR secrets are included in the response.
 */
restaurantQrPublicRoutes.post("/tables",async(req,res)=>{
 if(process.env.DELIBOCADOS_QR_CHECKOUT_ENABLED!=="1")
   return jsonError(res,503,"QR_CHECKOUT_NOT_ENABLED");
 if(process.env.DELIBOCADOS_QR_PILOT_TABLE_ID?.trim())
   return jsonError(res,503,"QR_GENERAL_DISABLED_DURING_PILOT");
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
   return res.json({ok:true,tables});
 }catch{
   return jsonError(res,503,"QR_SERVICE_UNAVAILABLE");
 }
});
