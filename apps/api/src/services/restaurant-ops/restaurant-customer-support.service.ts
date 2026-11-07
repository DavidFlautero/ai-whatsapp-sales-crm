import {getConversationByPhone,updateConversationMetadata} from "../conversations/conversation.repository.js";
import {supabaseRequest} from "../db/supabase-rest.client.js";
import {spanishNormalize,findMenuMentions,type MenuProduct} from "./restaurant-checkout-dialogue.service.js";

const COMPANY="delibocados";
const TWO_DAYS=48*60*60*1000;
type Order={
  id:string;number:number;customer_phone:string;customer_name:string;
  status:string;payment_status:string;payment_method:string|null;
  fulfillment_mode:"pickup"|"delivery";address:string|null;zone_id:string|null;
  courier_id:string|null;created_at:string;total_cop:number
};
type Line={order_id:string;product_id:string;product_name:string;quantity:number;unit_price_cop:number};
type Incident={
  id:string;order_id:string;category:string;status:string;
  description:string;reported_item_name:string|null;received_item_description:string|null;
};
type Profile={
  company_id:string;customer_phone:string;order_count:number;completed_orders:number;
  completed_spend_cop:number|null;last_order_at:string;
  confirmed_name:string;last_order_number:number;
  last_confirmed_delivery_address:string|null;last_payment_method:string|null;
};
type Claim={
  id:string;stage:"order"|"item";
  createdAt:string;category:"wrong_item"|"missing_item"|"late"|"other";
  receivedDescription?:string;
  orderId?:string;orderNumber?:number;
};
export type CustomerHistory={profile:Profile|null;orders:Order[];lines:Line[];incidents:Incident[]};
export type SupportReply={handled:boolean;text:string;humanHandoff?:boolean};

export function normalizeSupport(input:string):string {
  return spanishNormalize(input).replace(/[¿?¡!]/g,"").trim();
}
export function complaintIntent(message:string):boolean {
  const v=normalizeSupport(message);
  return /\b(?:reclamo|reclamacion|queja|problema con (?:el|mi) pedido|me dieron|me llego|recibi algo|me entregaron|llego mal|vino mal|pedido equivocado|no era lo que pedi|no recibi|me falta|me faltaron|producto incorrecto|salchipapas que no pedi)\b/.test(v);
}
export function orderHistoryIntent(message:string):boolean {
  const v=normalizeSupport(message);
  return /\b(?:revisa el historial|revisa mi historial|ver mi historial|historial de pedidos|que pedi antes|que pedi ayer|mis pedidos|mi ultimo pedido|pedido anterior|que fue lo que pedi)\b/.test(v);
}
export function extractOrderNumber(message:string):number|null {
  const v=normalizeSupport(message);
  const match=v.match(/(?:pedido|orden|numero|nro|#)\s*(?:n(?:u|umero)?\.?\s*)?#?\s*(\d{1,9})\b/) ??
    v.match(/^#?\s*(\d{1,9})\s*$/);
  return match?Number(match[1]):null;
}
export function complaintType(message:string):Claim["category"] {
  const v=normalizeSupport(message);
  if(/\b(?:no me llego|me falta|me faltaron|faltante|faltaron|falt[oó])\b/.test(v))return "missing_item";
  if(/\b(?:tarde|demora|demorado|no llego el pedido)\b/.test(v))return "late";
  if(/\b(?:me dieron|me llego|diferente|incorrecto|equivocado|no pedi|otra cosa|salchipapas)\b/.test(v))return "wrong_item";
  return "other";
}
export async function loadCustomerHistory(phone:string,limit=12):Promise<CustomerHistory> {
  if(!/^[0-9]{8,15}$/.test(phone))throw new Error("INVALID_CUSTOMER_PHONE");
  const n=Math.min(Math.max(limit,1),30);
  const [profiles,orders]=await Promise.all([
    supabaseRequest<Profile[]>({
      table:"restaurant_ops_customer_order_profiles",
      query:"?company_id=eq.delibocados&customer_phone=eq."+encodeURIComponent(phone)+"&select=*&limit=1"
    }),
    supabaseRequest<Order[]>({
      table:"restaurant_ops_orders",
      query:"?company_id=eq.delibocados&customer_phone=eq."+encodeURIComponent(phone)+
        "&select=id,number,customer_phone,customer_name,status,payment_status,payment_method,fulfillment_mode,address,zone_id,courier_id,created_at,total_cop"+
        "&order=created_at.desc&limit="+n
    })
  ]);
  if(!orders.length)return {profile:profiles[0]??null,orders:[],lines:[],incidents:[]};
  const ids=orders.map(o=>encodeURIComponent(o.id)).join(",");
  const [lines,incidents]=await Promise.all([
    supabaseRequest<Line[]>({
      table:"restaurant_ops_order_items",
      query:"?company_id=eq.delibocados&order_id=in.("+ids+")&select=order_id,product_id,product_name,quantity,unit_price_cop&limit=400"
    }),
    supabaseRequest<Incident[]>({
      table:"restaurant_ops_incidents",
      query:"?company_id=eq.delibocados&order_id=in.("+ids+")&select=id,order_id,category,status,description,reported_item_name,received_item_description&order=created_at.desc&limit=50"
    })
  ]);
  return {profile:profiles[0]??null,orders,lines,incidents};
}
function statusLabel(status:string):string{
  const map:Record<string,string>={
    confirmed:"confirmado",preparing:"en preparación",ready:"listo",
    out_for_delivery:"en reparto",completed:"finalizado",cancelled:"cancelado"
  };
  return map[status]??"pendiente de verificar";
}
function orderLineText(order:Order,lines:Line[]):string {
  const names=lines.filter(x=>x.order_id===order.id)
    .map(x=>x.quantity+" × "+x.product_name).join(", ");
  return "Pedido #"+order.number+" ("+statusLabel(order.status)+"): "+
    (names||"detalle no recuperado")+". Total $"+order.total_cop.toLocaleString("es-CO")+" COP.";
}
export function customerOrderSummary(history:CustomerHistory,limit=4):string{
  if(!history.orders.length)return "No encuentro pedidos registrados para este WhatsApp en nuestro sistema. Si lo hiciste por otro canal, un encargado puede buscar el comprobante.";
  return "*Estos son tus pedidos registrados:*\n"+
    history.orders.slice(0,limit).map(o=>orderLineText(o,history.lines)).join("\n")+
    "\nSi alguno tiene un inconveniente, decime el número de pedido y qué producto estuvo mal.";
}
function savedClaim(raw:unknown):Claim|null{
  if(!raw||typeof raw!=="object")return null;
  const p=raw as Partial<Claim>;
  if(!p.id||!p.createdAt||!(p.stage==="order"||p.stage==="item"))return null;
  if(!Number.isFinite(Date.parse(p.createdAt))||
    Date.now()-Date.parse(p.createdAt)>TWO_DAYS)return null;
  return p as Claim;
}
async function saveClaim(phone:string,value:Claim|null){
  await updateConversationMetadata(phone,{restaurant_claim_v1:value},COMPANY);
}
function problemReceivedDescription(message:string):string|undefined{
  const v=normalizeSupport(message);
  if(!/\b(?:me dieron|me entregaron|me llego|recibi)\b/.test(v))return undefined;
  const value=message.replace(/[\r\n]+/g," ").trim().slice(0,250);
  return value.length>7?value:undefined;
}
function findOrderedLine(message:string,lines:Line[]):Line|null{
  const v=normalizeSupport(message);
  const ordered=lines.slice().sort((a,b)=>b.product_name.length-a.product_name.length);
  return ordered.find(line=>{
    const product=normalizeSupport(line.product_name);
    return product.length>=4 && (v.includes(product) ||
      // Customer may skip "Hamburguesa" and say "doble mixta".
      product.split(/\s+/).slice(-2).join(" ").length>=7 &&
      v.includes(product.split(/\s+/).slice(-2).join(" ")));
  })??null;
}
export function isComplaintFollowup(message:string):boolean {
  const v=normalizeSupport(message);
  return !/^(?:cancelar reclamo|salir del reclamo)$/.test(v);
}
export async function handleRestaurantCustomerSupport(input:{
  phone:string;message:string;currentMessageId?:string;
}):Promise<SupportReply>{
  if(!/^[0-9]{8,15}$/.test(input.phone))return {handled:false,text:""};
  const conversation=await getConversationByPhone(input.phone,COMPANY);
  let claim=savedClaim(conversation?.metadata?.restaurant_claim_v1);
  const v=normalizeSupport(input.message);
  if(claim&&/^(?:cancelar reclamo|salir del reclamo)$/.test(v)){
    await saveClaim(input.phone,null);
    return {handled:true,text:"Cancelé la solicitud de reclamo. Tus pedidos y comprobantes permanecen sin cambios."};
  }
  const wantsHistory=orderHistoryIntent(input.message);
  const newComplaint=complaintIntent(input.message);
  if(!claim&&!wantsHistory&&!newComplaint)return {handled:false,text:""};

  const history=await loadCustomerHistory(input.phone,12);
  if(wantsHistory){
    const message=customerOrderSummary(history,5);
    return {handled:true,text:claim?
      message+"\n¿Sobre cuál número de pedido querés registrar el reclamo?":message};
  }
  if(!claim){
    claim={id:crypto.randomUUID(),stage:"order",
      createdAt:new Date().toISOString(),category:complaintType(input.message),
      receivedDescription:problemReceivedDescription(input.message)};
    await saveClaim(input.phone,claim);
    if(!history.orders.length)return {handled:true,humanHandoff:true,
      text:"Lamento lo ocurrido. No encuentro un pedido vinculado a este WhatsApp. Voy a dejarlo para atención humana; decime el número del comprobante o por qué canal lo hiciste."};
    return {handled:true,text:"Lamento lo que pasó. Revisé los pedidos asociados a tu WhatsApp:\n"+
      history.orders.slice(0,4).map(o=>orderLineText(o,history.lines)).join("\n")+
      "\nDecime *el número de pedido* que tuvo el problema. No voy a inventar qué producto recibiste."};
  }

  // Capture the wrong item if the customer explains it before giving the order number.
  if(!claim.receivedDescription && problemReceivedDescription(input.message)){
    claim.receivedDescription=problemReceivedDescription(input.message);
    claim.category=complaintType(input.message);
    await saveClaim(input.phone,claim);
  }

  if(claim.stage==="order"){
    const number=extractOrderNumber(input.message);
    if(number===null){
      return {handled:true,text:"Estoy revisando tu reclamo. Necesito que me confirmes el *número de pedido* (por ejemplo, #12). "+
        (history.orders.length? "Tenés registrados: "+
          history.orders.slice(0,5).map(x=>"#"+x.number).join(", ")+".":"No veo pedidos vinculados a este número.")};
    }
    const order=history.orders.find(o=>o.number===number);
    if(!order)return {handled:true,text:"No encuentro el pedido #"+number+
      " asociado a tu WhatsApp. Revisá el número o pedí ayuda al encargado; no puedo acceder a pedidos de otra persona."};
    claim={...claim,stage:"item",orderId:order.id,orderNumber:order.number};
    await saveClaim(input.phone,claim);
    const names=history.lines.filter(x=>x.order_id===order.id)
      .map(x=>x.quantity+" × "+x.product_name);
    return {handled:true,text:"Encontré el pedido #"+order.number+
      ". Figuraba: "+(names.length?names.join(", "):"sin detalle de productos recuperable")+
      ". ¿Cuál de estos productos llegó mal, no llegó o fue reemplazado por otro? "+
      (claim.receivedDescription?"Anoté lo que me contaste: "+claim.receivedDescription+". ":"")+
      "Con ese dato dejo el reclamo abierto para el encargado."};
  }

  if(claim.stage==="item" && claim.orderId && claim.orderNumber){
    const order=history.orders.find(o=>o.id===claim.orderId);
    if(!order){
      await saveClaim(input.phone,null);
      return {handled:true,humanHandoff:true,text:"No puedo verificar el pedido de este reclamo. Lo debe revisar un encargado."};
    }
    const orderLines=history.lines.filter(x=>x.order_id===order.id);
    const product=findOrderedLine(input.message,orderLines);
    if(!product)return {handled:true,text:"Para registrar el reclamo sobre el pedido #"+order.number+
      ", ¿cuál producto de tu pedido fue el afectado? Tengo: "+
      orderLines.map(x=>x.product_name).join(", ")+
      ". Si todo el pedido vino mal, escribí *TODO EL PEDIDO*."};
    const description=[
      "Reclamo recibido por WhatsApp del cliente del pedido #"+order.number+".",
      "Producto afectado: "+product.product_name+".",
      claim.receivedDescription?"Descripción original: "+claim.receivedDescription+".":"",
      "Último mensaje: "+input.message.trim().slice(0,350)+"."
    ].filter(Boolean).join(" ").slice(0,1950);
    const existing=history.incidents.find(x=>x.order_id===order.id&&x.status==="open"&&
      x.reported_item_name===product.product_name);
    if(existing){
      await saveClaim(input.phone,null);
      return {handled:true,humanHandoff:true,
        text:"Ya hay un reclamo abierto para "+product.product_name+" en el pedido #"+
          order.number+". No voy a duplicarlo; el encargado debe revisarlo."};
    }
    const inserted=await supabaseRequest<Array<{id:string}>>({
      table:"restaurant_ops_incidents",method:"POST",
      query:"?on_conflict=company_id,source_message_id",
      prefer:"resolution=ignore-duplicates,return=representation",
      body:[{
        company_id:COMPANY,order_id:order.id,
        customer_phone:input.phone,category:claim.category,
        severity:claim.category==="wrong_item"?"high":"normal",
        description,reported_item_id:product.product_id,
        reported_item_name:product.product_name,
        received_item_description:claim.receivedDescription??null,
        source_message_id:input.currentMessageId??claim.id,
        source:"whatsapp",
        actor_id:"restaurant-ai"
      }]
    });
    await saveClaim(input.phone,null);
    return {handled:true,humanHandoff:true,
      text:"Registré tu reclamo del pedido #"+order.number+
        " por *"+product.product_name+"*. "+
        (inserted[0]?.id?"Caso #"+inserted[0].id.slice(0,8)+". ":"")+
        "Un encargado debe revisarlo y decirte cómo se soluciona; no voy a prometer un reembolso o reemplazo sin autorización."};
  }
  return {handled:false,text:""};
}
