import {
  getConversationByPhone, updateConversationMetadata
} from "../conversations/conversation.repository.js";
import { getContactByPhone, upsertContact } from "../crm/crm.repository.js";
import { supabaseRequest, supabaseRpc } from "../db/supabase-rest.client.js";
import { classifyRestaurantIntent } from "../agent/restaurant-ops-conversation.service.js";
import { transferInstructionsForOrder } from "./restaurant-payment-intake.service.js";
import {
  MENU_PAGE_SIZE, spanishNormalize, wantsCartSummary, isCoverageQuestion,
  coverageAnswer, isMenuRequest, isMoreMenuRequest, isPreviousMenuRequest,
  isAddRequest, isRemoveRequest, parseNumberedProduct, findMenuMentions,
  mergeCart, removeFromCart, formatDraftCart, isPlausibleCustomerName,
  type CartLine, type MenuProduct
} from "./restaurant-checkout-dialogue.service.js";

const COMPANY = "delibocados";
const MENU_FALLBACK = "https://delibocados.online/menu";
type Item = { id: string; name: string; priceCOP: number; available?: boolean; priceNeedsReview?: boolean };
type MenuDoc = { revision: number; payload: { products?: Item[] } };
type Zone = { id: string; name: string; fee_cop: number; eta_minutes: number; active: boolean };
export type CheckoutDraft = {
  id: string;
  stage: "items" | "name" | "mode" | "zone" | "address" | "pickup_time" | "notes" | "payment" | "confirm" | "human_review" | "completed" | "cancelled";
  menuRevision: number;
  items: { productId: string; quantity: number }[];
  customerName?: string;
  mode?: "pickup" | "delivery";
  zoneId?: string;
  address?: string;
  payment?: "cash" | "transfer";
  customerNote?: string;
  pickupDueAt?: string;
  createdAt: string;
  orderNumber?: number;
  menuPage?: number;
  pendingBulk?: CartLine[];
};
export type CheckoutReply = {
  handled: boolean;
  text: string;
  imageUrl?: string;
  humanHandoff?: boolean;
};
export function normalize(value: string) {
  return value.toLocaleLowerCase("es-CO").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}
export function parseItemSelection(input: string, menu: Item[]) {
  const pattern = /(?:^|[,;\n])\s*(\d{1,2})\s*[x×]\s*(\d{1,2})\s*(?=$|[,;\n])/g;
  const text = input.trim();
  const matches = [...text.matchAll(pattern)];
  if (!matches.length || matches.length > 20) return null;
  const cleaned = text.replace(pattern, "").replace(/[,;\n\s]/g, "");
  if (cleaned) return null;
  const quantities = new Map<string, number>();
  for (const m of matches) {
    const qty = Number(m[1]); const index = Number(m[2]) - 1;
    const p = menu[index];
    if (!p || qty < 1 || qty > 25) return null;
    const total = (quantities.get(p.id) ?? 0) + qty;
    if (total > 25) return null;
    quantities.set(p.id, total);
  }
  return [...quantities].map(([productId,quantity]) => ({ productId,quantity }));
}
/** Conservative natural-language product matcher: exact published names only. */
export function parseNaturalItemSelection(
  input: string,
  menu: Item[]
): {productId:string;quantity:number}[] | null {
  const source=spanishNormalize(input);
  const words:Record<string,number>={
    un:1,una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,
    siete:7,ocho:8,nueve:9,diez:10
  };
  const mentions=findMenuMentions(input,menu);
  if(!mentions.length || mentions.length>20)return null;
  const found=new Map<string,number>();
  for(const mention of mentions) {
    const prefix=source.slice(Math.max(0,mention.start-45),mention.start).trim();
    const q=prefix.match(/(?:^|[^a-z0-9])(\d{1,2}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(?:de\s*)?$/);
    if(!q)return null;
    const quantity=/^\d/.test(q[1])?Number(q[1]):words[q[1]];
    if(!quantity||quantity>25)return null;
    const total=(found.get(mention.product.id)??0)+quantity;
    if(total>25)return null;
    found.set(mention.product.id,total);
  }
  return [...found].map(([productId,quantity])=>({productId,quantity}));
}

function menuPageText(menu:Item[],page:number):string {
  const start=Math.max(0,page)*MENU_PAGE_SIZE;
  const slice=menu.slice(start,start+MENU_PAGE_SIZE);
  if(!slice.length)return "Llegamos al final del menú. Escribí *MENÚ* para volver a empezar.";
  return "Productos "+(start+1)+"–"+(start+slice.length)+" de "+menu.length+":\n"+
    slice.map((p,i)=>(start+i+1)+". "+p.name+" — $"+
      Number(p.priceCOP).toLocaleString("es-CO")).join("\n")+
    (start+slice.length<menu.length?"\n\nEscribí *VER MÁS* para ver otros productos.":"")+
    "\n\nPodés pedir por nombre o por número, por ejemplo *11* (una unidad) o *2x7* (dos unidades del número 7).";
}

function stagePrompt(stage:CheckoutDraft["stage"]):string {
  switch(stage) {
    case "name": return "¿A nombre de quién registramos el pedido?";
    case "mode": return "¿Preferís *RETIRO* o *DOMICILIO*?";
    case "zone": return "Decime la zona para el domicilio.";
    case "address": return "Pasame la dirección completa del domicilio.";
    case "pickup_time":return "¿En cuántos minutos pasás a buscarlo? *AHORA* o 10–180.";
    case "notes":return "¿Tenés indicaciones o alergias? Respondé *NO* si ninguna.";
    case "payment":return "¿Pagás *EFECTIVO* o *TRANSFERENCIA*?";
    case "confirm":return "Por los cambios, necesitamos revisar el total otra vez. Respondé *EFECTIVO* o *TRANSFERENCIA*.";
    default:return "Decime qué más querés pedir.";
  }
}

export function buildOrderSummary(draft: CheckoutDraft, menu: Item[], zones: Zone[]) {
  const lines = draft.items.map(line => {
    const product = menu.find(p => p.id === line.productId);
    if (!product || product.available === false || product.priceNeedsReview ||
        !Number.isSafeInteger(Number(product.priceCOP)) || Number(product.priceCOP) < 0) {
      throw new Error("PRODUCT_UNAVAILABLE_OR_PRICE_UNVERIFIED");
    }
    return { ...line, productName: product.name, unitPrice: Number(product.priceCOP) };
  });
  if (lines.length === 0) throw new Error("EMPTY_CART");
  const subtotal = lines.reduce((n,x) => n+x.quantity*x.unitPrice,0);
  if (!Number.isSafeInteger(subtotal) || subtotal > 999999999) throw new Error("INVALID_SUBTOTAL");
  const zone = zones.find(z => z.id === draft.zoneId && z.active);
  if (draft.mode === "delivery" && (!zone || !draft.address)) {
    throw new Error("DELIVERY_NOT_READY");
  }
  const fee = draft.mode === "delivery" ? zone!.fee_cop : 0;
  return {
    lines, subtotal, fee, total: subtotal + fee,
    text: [
      "*Resumen de tu pedido en Delibocados*",
      ...lines.map(x => "• " + x.quantity + " × " + x.productName + " — $" +
        (x.unitPrice*x.quantity).toLocaleString("es-CO")),
      "Cliente: " + draft.customerName,
      ...(draft.pickupDueAt ? ["Retiro solicitado: " + new Date(draft.pickupDueAt).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit",timeZone:"America/Bogota"})+" (sujeto a confirmación de cocina)"] : []),
      ...(draft.customerNote ? ["Indicaciones: " + draft.customerNote] : []),
      "Modalidad: " + (draft.mode === "pickup" ? "Retiro en local" : "Domicilio"),
      ...(draft.mode === "delivery" ? [
        "Zona: " + zone!.name,
        "Dirección: " + draft.address,
        "Domicilio: $" + fee.toLocaleString("es-CO")
      ] : []),
      "Forma de pago: " + (draft.payment === "cash" ? "Efectivo al recibir" : "Transferencia (pendiente de verificar)"),
      "*Total: $" + (subtotal+fee).toLocaleString("es-CO") + "*",
      "Respondé *CONFIRMAR PEDIDO* para registrarlo o *CANCELAR PEDIDO* para descartarlo."
    ].join("\n")
  };
}
export function menuList(menu: Item[]) {
  return menu.map((p,i) => (i+1) + ". " + p.name + " — $" +
    Number(p.priceCOP).toLocaleString("es-CO")).join("\n");
}
export function shouldStartCheckout(message: string) {
  const m = normalize(message);
  if (["complaint","order_status","payment"].includes(classifyRestaurantIntent(message)))
    return false;
  return /\b(menu|carta|catalogo|hacer un pedido|quiero pedir|quisiera pedir|voy a pedir|pedir comida|quiero una|quiero dos|quiero tres|me regalas|me vendes)\b/.test(m)
    || /^(hola|holaa|buenas|buenos dias|buenas tardes|buenas noches)[.!?\s]*$/.test(m)
    || /\b(quiero|quisiera|deme|me das|me vendes)\s+\d+\b/.test(m)
    || classifyRestaurantIntent(message) === "pickup" || classifyRestaurantIntent(message) === "delivery";
}
function safeMenuUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      ["delibocados.online", "delibocadosfunza.com"].includes(url.hostname) &&
      url.pathname === "/menu" && !url.username && !url.password
      ? url.toString() : "";
  } catch { return ""; }
}
function safeImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      ["delibocados.online", "delibocadosfunza.com"].includes(url.hostname) &&
      /\.(png|jpg|jpeg|webp)$/i.test(url.pathname) &&
      !url.username && !url.password ? url.toString() : "";
  } catch { return ""; }
}
export async function preferredMenuShare(): Promise<{ url?: string; imageUrl?: string }> {
  const url = safeMenuUrl(process.env.DELIBOCADOS_MENU_URL || MENU_FALLBACK);
  if (url) {
    try {
      const response = await fetch(url, {
        method: "HEAD", redirect: "error",
        signal: AbortSignal.timeout(4500)
      });
      if (response.ok && (response.headers.get("content-type") || "").includes("text/html"))
        return { url };
    } catch { /* Never announce a broken menu link */ }
  }
  const imageUrl = safeImageUrl(process.env.DELIBOCADOS_MENU_IMAGE_URL || "");
  return imageUrl ? { imageUrl } : {};
}
async function persist(phone: string, draft: CheckoutDraft) {
  await updateConversationMetadata(phone, { restaurant_checkout_v1: draft }, COMPANY);
}
function existingDraft(value: unknown): CheckoutDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<CheckoutDraft>;
  if (!draft.id || !draft.stage || !draft.createdAt || !draft.menuRevision) return null;
  if (Date.now()-Date.parse(draft.createdAt) > 2*60*60*1000) return null;
  return draft as CheckoutDraft;
}
export async function handleRestaurantCheckoutMessage(input: {
  companyId: string; phone: string; message: string;
}): Promise<CheckoutReply> {
  if (input.companyId !== COMPANY || !/^[0-9]{8,15}$/.test(input.phone)) return { handled:false,text:"" };
  const conversation = await getConversationByPhone(input.phone,COMPANY);
  const previous = existingDraft(conversation?.metadata?.restaurant_checkout_v1);
  const normalized = normalize(input.message);
  // Coverage questions never change the checkout draft or invent geofences.
  if(isCoverageQuestion(input.message)) {
    return {handled:true,text:coverageAnswer(input.message)};
  }
  if (previous?.stage === "completed" && normalized === "confirmar pedido") {
    return { handled:true,text:"Tu pedido #"+(previous.orderNumber ?? "registrado")+" ya está guardado. No se creó uno nuevo." };
  }
  if (!previous && !shouldStartCheckout(input.message)) return { handled:false,text:"" };
  if (/^(cancelar pedido|cancelar|salir)$/.test(normalized)) {
    if (previous && previous.stage !== "completed") {
      await persist(input.phone, { ...previous,stage:"cancelled" });
      return { handled:true,text:"Cancelé el borrador. No se registró ningún pedido." };
    }
    return { handled:false,text:"" };
  }
  const documents = await supabaseRequest<MenuDoc[]>({
    table:"restaurant_menu_documents",
    query:"?company_id=eq.delibocados&select=revision,payload&limit=1"
  });
  const doc = documents[0];
  const available = (doc?.payload?.products || []).filter(p => p.id && p.name &&
    p.available !== false && p.priceNeedsReview !== true &&
    Number.isSafeInteger(Number(p.priceCOP)) && Number(p.priceCOP) >= 0).slice(0,250);
  if (!doc || !available.length) {
    return { handled:true,text:"Ahora mismo no puedo mostrar un menú con precios verificados. Te atenderá una persona del local." };
  }
  const zoneRows = await supabaseRequest<Zone[]>({
    table:"restaurant_ops_zones",
    query:"?company_id=eq.delibocados&active=eq.true&select=id,name,fee_cop,eta_minutes,active&order=priority.asc&limit=30"
  });
  const draft: CheckoutDraft = previous && previous.stage !== "cancelled" && previous.stage !== "completed"
    ? { ...previous } : {
        id: crypto.randomUUID(),stage:"items",items:[],menuRevision:doc.revision,
        createdAt:new Date().toISOString(),
        ...(classifyRestaurantIntent(input.message)==="pickup" ? {mode:"pickup" as const} :
           classifyRestaurantIntent(input.message)==="delivery" ? {mode:"delivery" as const} : {})
      };
  const activeDraft = previous && !["cancelled","completed"].includes(previous.stage);
  if(activeDraft && draft.customerName && !isPlausibleCustomerName(draft.customerName)) {
    // Recover drafts polluted by the former "anything is a name" bug.
    draft.customerName=undefined;
    if(draft.stage!=="items" && draft.stage!=="human_review") draft.stage="name";
    await persist(input.phone,draft);
  }
  if(activeDraft && wantsCartSummary(input.message)) {
    return {handled:true,text:formatDraftCart(draft.items,available)};
  }
  if(activeDraft && (isMenuRequest(input.message) || isMoreMenuRequest(input.message) ||
      isPreviousMenuRequest(input.message))) {
    const maxPage=Math.max(0,Math.ceil(available.length/MENU_PAGE_SIZE)-1);
    const newPage=isMenuRequest(input.message)?0:isMoreMenuRequest(input.message)?
      Math.min(maxPage,(draft.menuPage??0)+1):Math.max(0,(draft.menuPage??0)-1);
    draft.menuPage=newPage;
    await persist(input.phone,draft);
    return {handled:true,text:menuPageText(available,newPage)};
  }
  if(activeDraft && /^vaciar (?:carrito|pedido)$/.test(normalized)) {
    draft.items=[];draft.pendingBulk=undefined;draft.stage="items";
    await persist(input.phone,draft);
    return {handled:true,text:"Vacié el carrito. No se ha registrado ningún pedido. Decime qué querés pedir."};
  }
  const addLines = (value:string) => {
    const stripped=value.replace(/^(?:agrega(?:me)?|agregar|anade(?:me)?|anadir|suma(?:me)?|sumar|pon(?:me)?|incluye|inclui|quiero agregar|quiero anadir|quiero sumar)\s+/i,"");
    return parseNumberedProduct(stripped,available) ??
      parseItemSelection(stripped,available) ?? parseNaturalItemSelection(value,available);
  };
  const addProduct = async (lines:CartLine[],confirmedQuantity=false):Promise<CheckoutReply> => {
    if(!confirmedQuantity && lines.some(x=>x.quantity>5)) {
      draft.pendingBulk=lines;
      await persist(input.phone,draft);
      return {handled:true,text:"Esa cantidad es alta: "+
        formatDraftCart(lines,available)+
        "\nSi realmente querés esas unidades, respondé *CONFIRMAR CANTIDAD*. Todavía no se añadieron."};
    }
    const combined=mergeCart(draft.items,lines);
    if(!combined)return {handled:true,text:"La cantidad supera el máximo permitido por producto (25). Decime cuántas unidades querés."};
    draft.pendingBulk=undefined;draft.items=combined;draft.menuRevision=doc.revision;
    if(draft.stage==="items")draft.stage="name";
    if(draft.stage==="confirm")draft.stage="payment";
    await persist(input.phone,draft);
    return {handled:true,text:formatDraftCart(draft.items,available)+"\n\n"+stagePrompt(draft.stage)};
  };
  if(activeDraft && normalized==="confirmar cantidad" && draft.pendingBulk?.length) {
    return addProduct(draft.pendingBulk,true);
  }
  if(activeDraft && isRemoveRequest(input.message)) {
    const matches=findMenuMentions(input.message,available);
    if(!matches.length)return {handled:true,text:"No identifiqué qué producto querés quitar. Escribí *QUITA* seguido del nombre exacto del menú."};
    const ids=matches.map(x=>x.product.id);
    if(!draft.items.some(x=>ids.includes(x.productId)))
      return {handled:true,text:"Ese producto no aparece en el carrito. "+formatDraftCart(draft.items,available)};
    draft.items=removeFromCart(draft.items,ids);
    draft.pendingBulk=undefined;draft.menuRevision=doc.revision;
    if(!draft.items.length)draft.stage="items";
    else if(draft.stage==="confirm")draft.stage="payment";
    await persist(input.phone,draft);
    return {handled:true,text:formatDraftCart(draft.items,available)+"\n\n"+stagePrompt(draft.stage)};
  }
  if(activeDraft && isAddRequest(input.message)) {
    const found=addLines(input.message);
    if(!found)return {handled:true,text:"No pude identificar ese producto con seguridad. Pasame el nombre exacto o el número del menú. Escribí *MENÚ* para consultarlo."};
    return addProduct(found);
  }

  if (!previous || ["cancelled","completed"].includes(previous.stage)) {
    if (previous && !shouldStartCheckout(input.message)) {
      return { handled:false,text:"" };
    }
    const direct = parseNumberedProduct(input.message,available) ?? parseNaturalItemSelection(input.message,available);
    if (direct) {
      draft.items=direct;
      draft.stage="name";
      await persist(input.phone,draft);
      return {handled:true,text:"Anoté "+
        direct.map(line=>{
          const product=available.find(p=>p.id===line.productId);
          return line.quantity+" × "+(product?.name??"producto");
        }).join(", ")+
        ". ¿A nombre de quién registramos el pedido? Después confirmaremos el total."};
    }
    await persist(input.phone,draft);
    const share = await preferredMenuShare();
    const how = "Pedime productos por nombre o número. Escribí *VER MÁS* para los demás platos.";
    return {
      handled:true,
      text:(share.url ? "Este es nuestro menú: " + share.url + "\n\n" :
            share.imageUrl ? "Te comparto la foto del menú.\n\n" : "") +
        menuPageText(available,0) + "\n\n" + how,
      ...(share.imageUrl ? {imageUrl:share.imageUrl}: {})
    };
  }
  if (draft.stage === "items") {
    const lines = parseNumberedProduct(input.message,available) ?? parseItemSelection(input.message,available) ?? parseNaturalItemSelection(input.message,available);
    if (!lines) return {handled:true,text:"Pasame los números y cantidades del menú, por ejemplo *2x1, 1x3*. Si querés ver la carta otra vez, escribí *CANCELAR PEDIDO* y luego *MENÚ*."};
    return addProduct(lines);
  }
  if (draft.stage === "name") {
    const value=input.message.trim().replace(/\s+/g," ");
    if (!isPlausibleCustomerName(value))
      return {handled:true,text:"Decime tu nombre para identificar el pedido, por favor."};
    draft.customerName=value;
    draft.stage=draft.mode==="pickup" ? "pickup_time" : draft.mode==="delivery" ? "zone" : "mode";
    await persist(input.phone,draft);
    return {handled:true,text:draft.stage==="pickup_time" ?
      "¿En cuántos minutos pensás pasar a buscarlo? Respondé *AHORA* o un número entre 10 y 180. La hora queda sujeta a confirmación de cocina." :
      draft.stage==="zone" ? (zoneRows.length ?
        "¿En cuál zona estás? " + zoneRows.map((z,i)=> (i+1)+". "+z.name+" ($"+z.fee_cop.toLocaleString("es-CO")+")").join(" · ") :
        "Todavía no tenemos zonas verificadas. Para domicilio debe confirmar un encargado; si preferís retirar, respondé *RETIRO*.") :
      "¿Pasás a buscarlo al local o querés domicilio? Respondé *RETIRO* o *DOMICILIO*."};
  }
  if (draft.stage==="mode") {
    if (/^(retiro|recoger|paso a buscar|local)$/.test(normalized)) {
      draft.mode="pickup";draft.stage="pickup_time";
      await persist(input.phone,draft);
      return {handled:true,text:"Perfecto, sin domicilio. ¿En cuántos minutos pasarás a buscarlo? Respondé *AHORA* o un número entre 10 y 180."};
    }
    if (/^(domicilio|delivery|envio)$/.test(normalized)) {
      draft.mode="delivery";draft.stage="zone";
      await persist(input.phone,draft);
      return {handled:true,text:zoneRows.length ?
        "Elegí la zona de domicilio:\n"+zoneRows.map((z,i)=>(i+1)+". "+z.name+" — $"+z.fee_cop.toLocaleString("es-CO")).join("\n") :
        "No tenemos zonas activas verificadas. Un encargado debe confirmar el domicilio."};
    }
    return {handled:true,text:"Respondé *RETIRO* o *DOMICILIO*."};
  }
  if (draft.stage==="zone") {
    if (/^(retiro|local)$/.test(normalized)) {
      draft.mode="pickup";draft.zoneId=undefined;draft.address=undefined;draft.stage="pickup_time";
      await persist(input.phone,draft);
      return {handled:true,text:"Listo, retiro en local. ¿En cuántos minutos pasarás a buscarlo? *AHORA* o un número entre 10 y 180."};
    }
    const index=Number(normalized)-1;
    const zone=Number.isInteger(index)?zoneRows[index]:null;
    if (!zone)return {handled:true,text:"Seleccioná el número de una zona activa. Si no aparece tu barrio, te debe ayudar un encargado."};
    draft.zoneId=zone.id;draft.stage="address";await persist(input.phone,draft);
    return {handled:true,text:"Pasame la dirección completa, barrio y alguna referencia para el repartidor."};
  }
  if (draft.stage==="address") {
    const value=input.message.trim();
    if (value.length < 8 || value.length > 500)
      return {handled:true,text:"Necesito una dirección más completa para poder gestionar el domicilio."};
    draft.address=value;draft.stage="notes";await persist(input.phone,draft);
    return {handled:true,text:"¿Tenés indicaciones especiales o alergias alimentarias? Respondé *NO* si ninguna."};
  }
  if (draft.stage==="pickup_time") {
    const value = normalized;
    const minutes = value === "ahora" ? 10 : Number(value);
    if (!Number.isInteger(minutes) || minutes < 10 || minutes > 180) {
      return {handled:true,text:"Indicame *AHORA* o un número de minutos entre 10 y 180. Cocina debe confirmar la hora."};
    }
    draft.pickupDueAt = new Date(Date.now()+minutes*60000).toISOString();
    draft.stage="notes"; await persist(input.phone,draft);
    return {handled:true,text:"¿Tenés indicaciones especiales o alergias alimentarias? Respondé *NO* si ninguna."};
  }
  if (draft.stage==="notes") {
    const comment=input.message.trim();
    if (comment.length > 500 || comment.length < 2) {
      return {handled:true,text:"Indicame *NO* si no hay observaciones, o escribí una indicación de hasta 500 caracteres."};
    }
    if (/\b(alergia|alergico|alergica|celiaco|celiaca|anafilaxia|intolerancia)\b/.test(normalized)) {
      draft.customerNote=comment;draft.stage="human_review";
      await persist(input.phone,draft);
      return {handled:true,humanHandoff:true,text:"Gracias por avisarnos. Por seguridad, un encargado debe revisar los ingredientes y confirmar el pedido. No se registró automáticamente."};
    }
    draft.customerNote = normalized==="no" ? "" : comment;
    draft.stage="payment"; await persist(input.phone,draft);
    return {handled:true,text:"¿Pagás *EFECTIVO* al recibir o *TRANSFERENCIA*? El comprobante se verifica por separado."};
  }
  if (draft.stage==="human_review") {
    return {handled:true,text:"Tu solicitud requiere la atención de una persona. Todavía no se registró un pedido."};
  }
  if (draft.stage==="payment") {
    if (!/^(efectivo|transferencia)$/.test(normalized))
      return {handled:true,text:"Elegí una forma de pago: *EFECTIVO* o *TRANSFERENCIA*."};
    draft.payment=normalized==="efectivo"?"cash":"transfer";
    const summary=buildOrderSummary(draft,available,zoneRows);
    draft.stage="confirm";draft.menuRevision=doc.revision;await persist(input.phone,draft);
    return {handled:true,text:summary.text};
  }
  if (draft.stage==="confirm") {
    if (normalized!=="confirmar pedido")
      return {handled:true,text:"Para registrarlo respondé exactamente *CONFIRMAR PEDIDO*. Para descartarlo, *CANCELAR PEDIDO*."};
    if (doc.revision!==draft.menuRevision) {
      draft.stage="payment";await persist(input.phone,draft);
      return {handled:true,text:"El menú cambió desde que cotizamos. Necesito confirmar otra vez el total antes de guardar el pedido. Escribí *EFECTIVO* o *TRANSFERENCIA*."};
    }
    const quote=buildOrderSummary(draft,available,zoneRows);
    const order=await supabaseRpc<{id:string;number:number;version:number;total_cop:number}>("restaurant_ops_create_order",{
      p_company_id:COMPANY,p_source:"whatsapp",p_source_key:"wa-"+draft.id,
      p_customer_phone:input.phone,p_customer_name:draft.customerName!,
      p_fulfillment_mode:draft.mode!,p_items:draft.items,
      p_zone_id:draft.mode==="delivery"?draft.zoneId:null,
      p_address:draft.mode==="delivery"?draft.address:null,
      p_customer_note:draft.customerNote??null,
      p_pickup_due_at:draft.mode==="pickup"?draft.pickupDueAt:null,
      p_actor_id:"whatsapp_checkout",p_actor_role:"system",
      p_customer_confirmed:true,p_expected_menu_revision:draft.menuRevision,
      p_payment_method:draft.payment==="cash"?"cash":"transfer",
      p_payment_status:draft.payment==="cash"?"cash_on_delivery":"pending"
    });
    draft.stage="completed";draft.orderNumber=order.number;
    await persist(input.phone,draft);
    try {
      const old=await getContactByPhone(input.phone,COMPANY);
      await upsertContact({
        phone:input.phone,
        name:old?.metadata?.name_confirmed===true ? old.name : draft.customerName,
        status:"customer",
        metadata:{ name_source:"customer",name_confirmed:true,last_restaurant_order_id:order.id }
      },COMPANY);
    } catch { console.warn("[DELI CHECKOUT] CRM enrichment pending", {orderId:order.id}); }
    const instructions = draft.payment === "transfer"
      ? await transferInstructionsForOrder({
          number: order.number,
          totalCOP: Number(order.total_cop ?? quote.total)
        }).catch(() => ({
          text: "La cuenta bancaria no está disponible en este momento. " +
            "Un encargado te indicará cómo completar el pago; no hagas transferencias a cuentas no verificadas.",
          humanHandoff: true
        }))
      : null;
    return {handled:true,humanHandoff:instructions?.humanHandoff===true,
      text:"*Pedido #"+order.number+" registrado*.\n"+
        quote.lines.map(x=>x.quantity+" × "+x.productName).join("\n")+
        "\nTotal: $"+quote.total.toLocaleString("es-CO")+
        (draft.mode==="pickup"?"\nRetiro en local. Te avisamos cuando esté listo.":
          "\nDomicilio registrado. Te avisamos cuando salga a reparto.")+
        (instructions?"\n\n"+instructions.text:"\nPago en efectivo al recibir. Pasamos el pedido a cocina.")};
  }
  return {handled:false,text:""};
}
