import {listMessages} from "../conversations/conversation.repository.js";
import {supabaseRequest} from "../db/supabase-rest.client.js";

export type CandidateQuestion={question:string;count:number};
export function safeQuestion(input:string):string|null {
  let text=input.replace(/\s+/g," ").trim().slice(0,300);
  if(text.length<10||text.length>280)return null;
  const normalized=text.toLocaleLowerCase("es-CO").normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"");
  // Exclude personal, financial, location-specific, medical or access information.
  if(/@|https?:\/\/|\d{6,}|(?:^|\s)(?:calle|carrera|cra|cll|apartamento|direccion|cedula|documento|cuenta|tarjeta|clave|contrasena|pin|transferencia|comprobante|mi numero|nequi|daviplata|alergia|alergico|intolerancia)\b/.test(normalized))
    return null;
  if(!/^(?:cuanto|como|cual|cuando|donde|que|hacen|venden|tienen|abren|cierran|envian|llevan|hay|puedo|podria|es posible|a que hora|hasta donde)\b/.test(normalized)
     && !text.includes("?"))return null;
  if(!/\b(menu|carta|horario|abren|cierran|pedido|domicilio|envio|llevar|recoger|funza|mosquera|bogota|precio|producto|almuerzo|hamburguesa|arepa|perro|restaurante|pagar|efectivo|atienden|abierto|cerrado)\b/.test(normalized))
    return null;
  text=text.replace(/\s*[\u00bf?]+\s*/g," ").trim();
  // Do not keep customer names, phone numbers or order numbers; a reviewer only sees generic FAQs.
  return (text[0].toUpperCase()+text.slice(1)).slice(0,280)+"?";
}
export function recurringQuestions(messages:Array<{body?:string;direction?:string}>):CandidateQuestion[]{
  const questions=new Map<string,{question:string;count:number}>();
  for(const m of messages){
    if(m.direction!=="inbound")continue;
    const q=safeQuestion(m.body??"");
    if(!q)continue;
    const k=q.toLocaleLowerCase("es-CO");
    const a=questions.get(k)??{question:q,count:0};
    a.count++;
    questions.set(k,a);
  }
  return [...questions.values()].sort((a,b)=>b.count-a.count)
    .slice(0,25);
}
export async function analyzeRecentRestaurantQuestions():Promise<{
  scanned:number; proposed:number; candidates:CandidateQuestion[]
}> {
  const messages=await listMessages(undefined,"delibocados");
  const candidates=recurringQuestions(messages);
  const proposed=await supabaseRequest<Array<{question:string}>>({
    table:"restaurant_agent_learnings",
    query:"?company_id=eq.delibocados&select=question&limit=300"
  });
  const already=new Set(proposed.map(x=>x.question.toLocaleLowerCase("es-CO")));
  const newItems=candidates.filter(x=>!already.has(x.question.toLocaleLowerCase("es-CO")))
    .slice(0,12);
  if(newItems.length){
    await supabaseRequest<unknown[]>({
      table:"restaurant_agent_learnings",method:"POST",
      query:"?on_conflict=company_id,category,question",
      prefer:"resolution=ignore-duplicates,return=minimal",
      body:newItems.map(x=>({
        company_id:"delibocados",category:"faq",
        question:x.question,
        answer:"Pendiente de verificar y responder por el encargado.",
        evidence:"Pregunta observada en conversaciones recientes ("+x.count+" vez/veces).",
        source_type:"conversation",status:"proposed"
      }))
    });
  }
  return {scanned:messages.length,proposed:newItems.length,candidates};
}
