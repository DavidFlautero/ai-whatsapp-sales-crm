import {getConversationByPhone,updateConversationMetadata} from "../conversations/conversation.repository.js";
import {supabaseRequest} from "../db/supabase-rest.client.js";
import {
  handleRestaurantCheckoutMessage,type CheckoutReply
} from "./restaurant-whatsapp-checkout.service.js";
import {spanishNormalize} from "./restaurant-checkout-dialogue.service.js";

type Product={id:string;name:string;priceCOP:number;available?:boolean;priceNeedsReview?:boolean};
type PendingChoice={
  quantity:number;candidateIds:string[];createdAt:string;
  description:string;
};
const COMPANY="delibocados";
const EXPIRES_MS=48*3600*1000;
const words:{[key:string]:number}={un:1,una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5};
export function ambiguousDoubleBurger(input:string):number|null{
  const m=spanishNormalize(input);
  if(!/\b(?:hamburguesas?|hamburguer)\s+dobles?\b/.test(m) ||
      /\b(?:mixta|mixto|carne)\b/.test(m))return null;
  if(!/\b(?:quiero|quisiera|dame|pedir|podria|puedo|agregar|nuevamente)\b/.test(m))return null;
  const qty=m.match(/\b(\d{1,2}|un|una|uno|dos|tres|cuatro|cinco)\s+hamburguesas?\b/);
  if(!qty)return 1;
  const n=/^\d/.test(qty[1])?Number(qty[1]):words[qty[1]];
  return n>=1&&n<=25?n:null;
}
export function pickVariant(input:string,candidates:Product[]):Product|null{
  const m=spanishNormalize(input);
  const matches=candidates.filter(x=>{
    const name=spanishNormalize(x.name);
    if(m.includes(name))return true;
    const short=name.split(" ").slice(-2).join(" ");
    return short.length>=7 && m.includes(short);
  });
  if(matches.length===1)return matches[0];
  const shorthand=candidates.filter(x=>{
    const last=spanishNormalize(x.name).split(/\s+/).at(-1)??"";
    return last.length>=4 && new RegExp("(?:^|\\s)"+last+"(?:$|\\s)").test(m);
  });
  return shorthand.length===1?shorthand[0]:null;
}
export async function handleRestaurantProductFollowup(input:{
  phone:string;message:string;
}):Promise<CheckoutReply>{
  const conversation=await getConversationByPhone(input.phone,COMPANY);
  const meta=conversation?.metadata?.restaurant_selection_v1 as PendingChoice|undefined;
  const active=meta&&meta.createdAt&&Date.now()-Date.parse(meta.createdAt)<EXPIRES_MS?meta:null;
  const incomingQuantity=ambiguousDoubleBurger(input.message);
  if(!active&&incomingQuantity===null)return {handled:false,text:""};
  const documents=await supabaseRequest<Array<{payload:{products?:Product[]}}>>({
    table:"restaurant_menu_documents",
    query:"?company_id=eq.delibocados&select=payload&limit=1"
  });
  const menu=(documents[0]?.payload?.products??[])
    .filter(x=>x.id&&x.name&&x.available!==false&&!x.priceNeedsReview&&
      Number.isInteger(Number(x.priceCOP))&&Number(x.priceCOP)>=0);
  const candidates=menu.filter(x=>spanishNormalize(x.name).includes("hamburguesa doble"));
  if(incomingQuantity!==null){
    if(candidates.length<2)return {handled:false,text:""};
    await updateConversationMetadata(input.phone,{
      restaurant_selection_v1:{
        quantity:incomingQuantity,candidateIds:candidates.map(x=>x.id),
        description:input.message.slice(0,250),createdAt:new Date().toISOString()
      } satisfies PendingChoice
    },COMPANY);
    return {handled:true,text:"Claro, te anoto "+incomingQuantity+
      (incomingQuantity===1?" hamburguesa doble. ":" hamburguesas dobles. ")+
      "¿Cuál preferís?\n"+candidates.map(x=>"• "+x.name+" — $"+
        x.priceCOP.toLocaleString("es-CO")).join("\n")+
      "\nDecime *Doble Mixta* o *Doble Carne* y la sumo al pedido."};
  }
  const available=menu.filter(x=>active!.candidateIds.includes(x.id));
  const selected=pickVariant(input.message,available);
  if(!selected){
    return {handled:true,text:"Para las "+active!.quantity+
      " hamburguesas dobles, decime si preferís "+
      available.map(x=>x.name).join(" o ")+
      ". Todavía no agregué ninguna para evitar equivocarme."};
  }
  const command="quiero "+active!.quantity+" "+selected.name;
  const checkout=await handleRestaurantCheckoutMessage({
    companyId:COMPANY,phone:input.phone,message:command
  });
  if(checkout.handled){
    await updateConversationMetadata(input.phone,{restaurant_selection_v1:null},COMPANY);
    return {handled:true,text:"Listo, seleccionaste "+active!.quantity+" × "+
      selected.name+".\n"+checkout.text,
      ...(checkout.humanHandoff?{humanHandoff:true}:{})};
  }
  return {handled:true,text:"Identifiqué "+selected.name+
    ", pero no pude incorporarla al carrito de forma segura. ¿Querés que un encargado lo revise?"};
}
