import { supabaseRequest } from "../db/supabase-rest.client.js";

export const DAYS=["mon","tue","wed","thu","fri","sat","sun"] as const;
export type DayKey=typeof DAYS[number];
export type OpeningDay={enabled:boolean;open:string;close:string};
export type OpeningHours=Partial<Record<DayKey,OpeningDay>>;
export type BusinessProfile={
  company_id:string;
  business_name:string;
  description:string;
  location_address:string;
  public_phone:string;
  city:string;
  timezone:"America/Bogota";
  coverage_summary:string;
  opening_hours:OpeningHours;
  special_hours_note:string;
  tone:"natural"|"formal"|"friendly";
  extra_instructions:string;
  learning_enabled:boolean;
  origin_lat:number|null;
  origin_lng:number|null;
  origin_verified:boolean;
  updated_at:string;
};
export type Learning={
  id:string;category:"faq"|"service_rule"|"product_question";
  question:string;answer:string;evidence:string;source_type:string;
  status:"proposed"|"approved"|"rejected";created_at:string;
};
const company="delibocados";

export function validOpeningHours(hours:OpeningHours):boolean {
  for(const key of Object.keys(hours)){
    if(!DAYS.includes(key as DayKey))return false;
    const value=hours[key as DayKey];
    if(!value||typeof value.enabled!=="boolean"||
      typeof value.open!=="string"||typeof value.close!=="string")return false;
    if(value.enabled){
      const valid=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
      if(!valid.test(value.open)||!valid.test(value.close)||value.open===value.close)return false;
    }
  }
  return true;
}

const labels:{[key in DayKey]:string}={
  mon:"Lunes",tue:"Martes",wed:"Miércoles",thu:"Jueves",
  fri:"Viernes",sat:"Sábado",sun:"Domingo"
};
export function hoursForAgent(profile:BusinessProfile):string {
  const h=profile.opening_hours||{};
  if(!DAYS.some(day=>h[day]?.enabled))return "HORARIOS: No confirmados. No afirmar que el local está abierto ni indicar un horario.";
  const lines=DAYS.map(day=>{
    const value=h[day];
    return labels[day]+": "+(value?.enabled ? value.open+"–"+value.close : "sin atención confirmada");
  });
  return "Zona horaria America/Bogota.\n"+lines.join("\n")+
    (profile.special_hours_note?"\nAviso especial: "+profile.special_hours_note:"");
}

export async function getBusinessProfile():Promise<BusinessProfile|null>{
  const rows=await supabaseRequest<BusinessProfile[]>({
    table:"restaurant_agent_business_profiles",
    query:"?company_id=eq.delibocados&select=*&limit=1"
  });
  return rows[0]??null;
}
export async function getApprovedLearning():Promise<Learning[]> {
  return supabaseRequest<Learning[]>({
    table:"restaurant_agent_learnings",
    query:"?company_id=eq.delibocados&status=eq.approved&select=id,category,question,answer,evidence,source_type,status,created_at&order=created_at.desc&limit=30"
  });
}
export async function getRestaurantAgentContext():Promise<string>{
  const [profile,learned]=await Promise.all([getBusinessProfile(),getApprovedLearning()]);
  if(!profile)return "El horario, dirección y atención del negocio aún no están configurados. No inventarlos.";
  const parts=[
    "PERFIL DEL NEGOCIO (CONFIGURADO POR SU ADMINISTRADOR):",
    "Nombre: "+profile.business_name,
    "Ciudad: "+profile.city,
    "Descripción: "+profile.description,
    "Dirección: "+(profile.location_address||"No verificada"),
    "Teléfono público: "+(profile.public_phone||"No verificado"),
    "Cobertura declarada: "+profile.coverage_summary,
    hoursForAgent(profile),
    "Tono: "+profile.tone,
    "Instrucciones adicionales (subordinadas a precios/seguridad): "+profile.extra_instructions,
    "CONOCIMIENTO APROBADO POR RESPONSABLE:",
    ...learned.map(x=>x.question+" => "+x.answer)
  ];
  return parts.join("\n").slice(0,10000);
}
export type PopularProduct={name:string;quantity:number;orders:number};
export async function getRestaurantOrderInsights():Promise<{sampleOrders:number;popular:PopularProduct[]}> {
  const orders=await supabaseRequest<Array<{id:string;status:string}>>({
    table:"restaurant_ops_orders",
    query:"?company_id=eq.delibocados&status=eq.completed&select=id,status&order=created_at.desc&limit=200"
  });
  if(!orders.length)return {sampleOrders:0,popular:[]};
  const ids=orders.map(o=>o.id);
  const lines=await supabaseRequest<Array<{order_id:string;product_name:string;quantity:number}>>({
    table:"restaurant_ops_order_items",
    query:"?company_id=eq.delibocados&order_id=in.("+ids.map(encodeURIComponent).join(",")+")&select=order_id,product_name,quantity&limit=1000"
  });
  const map=new Map<string,{quantity:number;orders:Set<string>}>();
  for(const item of lines){
    if(!Number.isInteger(item.quantity)||item.quantity<=0)continue;
    const current=map.get(item.product_name)??{quantity:0,orders:new Set<string>()};
    current.quantity+=item.quantity;current.orders.add(item.order_id);
    map.set(item.product_name,current);
  }
  return {sampleOrders:orders.length,popular:[...map].map(([name,item])=>({
    name,quantity:item.quantity,orders:item.orders.size
  })).sort((a,b)=>b.quantity-a.quantity).slice(0,12)};
}

/** Past completed orders only; no guessing preferences from casual chat. */
export async function getCustomerVerifiedHistory(phone:string):Promise<{
  completedOrders:number;topProducts:Array<{name:string;quantity:number}>
}> {
  if(!/^[0-9]{8,15}$/.test(phone))return {completedOrders:0,topProducts:[]};
  const orders=await supabaseRequest<Array<{id:string}>>({
    table:"restaurant_ops_orders",
    query:"?company_id=eq.delibocados&customer_phone=eq."+encodeURIComponent(phone)+
      "&status=eq.completed&select=id&order=created_at.desc&limit=20"
  });
  if(!orders.length)return {completedOrders:0,topProducts:[]};
  const items=await supabaseRequest<Array<{product_name:string;quantity:number}>>({
    table:"restaurant_ops_order_items",
    query:"?company_id=eq.delibocados&order_id=in.("+
      orders.map(o=>encodeURIComponent(o.id)).join(",")+")"+
      "&select=product_name,quantity&limit=300"
  });
  const map=new Map<string,number>();
  for(const item of items){
    if(Number.isInteger(item.quantity)&&item.quantity>0)
      map.set(item.product_name,(map.get(item.product_name)??0)+item.quantity);
  }
  return {completedOrders:orders.length,
    topProducts:[...map].map(([name,quantity])=>({name,quantity}))
      .sort((a,b)=>b.quantity-a.quantity).slice(0,6)};
}
