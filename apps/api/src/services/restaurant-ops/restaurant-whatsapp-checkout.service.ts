import {
  getConversationByPhone, updateConversationMetadata
} from "../conversations/conversation.repository.js";
import { getContactByPhone, upsertContact } from "../crm/crm.repository.js";
import { supabaseRequest, supabaseRpc } from "../db/supabase-rest.client.js";
import { classifyRestaurantIntent } from "../agent/restaurant-ops-conversation.service.js";
import { transferInstructionsForOrder } from "./restaurant-payment-intake.service.js";
import {quoteVerifiedDeliveryAddress,quoteVerifiedDeliveryPoint} from "./restaurant-delivery-routing.service.js";
import {freshVerifiedPin} from "./restaurant-whatsapp-location.service.js";
import {explicitFulfillment,explicitPurchaseStatement,extractCustomerName} from "./restaurant-natural-checkout-routing.service.js";
import {interpretNaturalPreparation,isFoodSafetyMessage} from "./restaurant-cart-intake.service.js";
import {isSplitPaymentRequest,parseExactTransferCOP,splitPaymentQuote,splitQuoteMessage} from "./restaurant-split-payment.service.js";
import {
  MENU_PAGE_SIZE, spanishNormalize, wantsCartSummary, isCoverageQuestion,
  coverageAnswer, isMenuRequest, isMenuLinkRequest, isMoreMenuRequest, isPreviousMenuRequest,
  isAddRequest, isRemoveRequest, isStandaloneMenuSelection, parseNumberedProduct, findMenuMentions,
  mergeCart, removeFromCart, formatDraftCart, isPlausibleCustomerName,
  type CartLine
} from "./restaurant-checkout-dialogue.service.js";

const COMPANY = "delibocados";
const MENU_FALLBACK = "https://delibocados.online/menu";
const MENU_OFFICIAL_CANDIDATE = "https://delibocadosfunza.com/menu";
type Item = { id: string; name: string; priceCOP: number; available?: boolean; priceNeedsReview?: boolean };
type MenuDoc = { revision: number; payload: { products?: Item[] } };
type Zone = { id: string; name: string; fee_cop: number; eta_minutes: number; active: boolean };
export type CheckoutDraft = {
  id: string;
  stage: "items" | "name" | "mode" | "zone" | "address" | "pickup_time" | "notes" | "payment" | "split_amount" | "split_confirm" | "confirm" | "human_review" | "completed" | "cancelled";
  menuRevision: number;
  items: CartLine[];
  customerName?: string;
  mode?: "pickup" | "delivery";
  zoneId?: string;
  address?: string;
  payment?: "cash" | "transfer" | "mixed";
  splitTransferCOP?: number;
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
  handoffReason?: string;
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
    case "payment":return "¿Pagás *EFECTIVO*, *TRANSFERENCIA* o *MIXTO* (parte por transferencia y resto en efectivo)?";
    case "split_amount":return "¿Cuántos pesos COP exactos transferís? Por ejemplo *40000 COP*.";
    case "split_confirm":return "Confirmá el reparto con *CONFIRMAR DIVISIÓN*.";
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
      ...lines.map(x => "• " + x.quantity + " × " + x.productName +
        (x.instructions?" ("+x.instructions+")":"")+" — $" +
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
      "Forma de pago: " + (draft.payment === "cash" ? "Efectivo al recibir" :
        draft.payment==="mixed" && splitPaymentQuote(subtotal+fee,Number(draft.splitTransferCOP)) ?
          ("Mixto: $"+Number(draft.splitTransferCOP).toLocaleString("es-CO")+
          " por transferencia PENDIENTE DE VERIFICAR + $"+
          (subtotal+fee-Number(draft.splitTransferCOP)).toLocaleString("es-CO")+
          " en efectivo al recibir") :
          "Transferencia (pendiente de verificar)"),
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
  return isAddRequest(message) || isStandaloneMenuSelection(message) ||
    /\b(menu|carta|catalogo|hacer un pedido|quiero pedir|quisiera pedir|voy a pedir|pedir comida|quiero un|quiero una|quiero dos|quiero tres|quisiera un|quisiera una|dame un|dame una|me regalas|me vendes)\b/.test(m)
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
  // Never disclose an unverified URL: only configured/official HTTPS hosts.
  const candidates = [...new Set([
    process.env.DELIBOCADOS_MENU_URL || "",
    MENU_OFFICIAL_CANDIDATE,
    MENU_FALLBACK
  ].map(safeMenuUrl).filter(Boolean))];
  for (const url of candidates) {
    try {
      let response = await fetch(url, {
        method:"HEAD", redirect:"error",signal:AbortSignal.timeout(3500)
      });
      if (!response.ok && [403,405,501].includes(response.status)) {
        response = await fetch(url, {
          method:"GET",redirect:"error",signal:AbortSignal.timeout(3500)
        });
        await response.body?.cancel();
      }
      if (response.ok &&
          (response.headers.get("content-type") || "").toLowerCase().includes("text/html"))
        return { url };
    } catch { /* Never announce a broken or unreachable menu link. */ }
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
  if(isFoodSafetyMessage(input.message))
    return {handled:true,humanHandoff:true,handoffReason:"food_safety_review",
      text:"Por seguridad alimentaria, una persona del restaurante debe confirmar ingredientes y alérgenos. No se registró ni modificó un pedido automáticamente."};
  const conversation = await getConversationByPhone(input.phone,COMPANY);
  const previous = existingDraft(conversation?.metadata?.restaurant_checkout_v1);
  const normalized = normalize(input.message);
  const requestedMode = explicitFulfillment(input.message);
  // Coverage questions never change the checkout draft or invent geofences.
  if(isCoverageQuestion(input.message) && !explicitPurchaseStatement(input.message)) {
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
        ...(requestedMode==="pickup" || requestedMode==="delivery"
          ? {mode:requestedMode} :
          classifyRestaurantIntent(input.message)==="pickup" ? {mode:"pickup" as const} :
          classifyRestaurantIntent(input.message)==="delivery" ? {mode:"delivery" as const} : {})
      };
  const activeDraft = previous && !["cancelled","completed"].includes(previous.stage);
  if(activeDraft && explicitPurchaseStatement(input.message) &&
      (requestedMode==="pickup" || requestedMode==="delivery") &&
      draft.mode && requestedMode!==draft.mode){
    return {handled:true,text:"Este carrito ya está configurado para "+
      (draft.mode==="pickup"?"retiro":"domicilio")+
      ". Para cambiar la modalidad, confirmala por separado antes de añadir productos. No cambié el carrito."};
  }
  if(activeDraft && draft.customerName && !isPlausibleCustomerName(draft.customerName)) {
    // Recover drafts polluted by the former "anything is a name" bug.
    draft.customerName=undefined;
    if(draft.stage!=="items" && draft.stage!=="human_review") draft.stage="name";
    await persist(input.phone,draft);
  }
  if(activeDraft && draft.stage==="human_review") {
    return {handled:true,humanHandoff:true,
      text:"Tu solicitud requiere revisión de una persona por seguridad alimentaria. El bot no puede modificar ni confirmar ese pedido."};
  }
  // Menu links are first-class actions: do not let the LLM paraphrase the menu
  // or force a customer to repeat their request. Preserve the existing cart.
  if (isMenuRequest(input.message) || isMenuLinkRequest(input.message)) {
    draft.menuPage = 0;
    await persist(input.phone,draft);
    const share = await preferredMenuShare();
    if (share.url) return {handled:true,
      text:"Acá tenés el menú de Delibocados: " + share.url +
        "\nPodés pedirme cualquier producto del menú por nombre o número."};
    if (share.imageUrl) return {handled:true,imageUrl:share.imageUrl,
      text:"Te comparto la imagen disponible del menú. " +
        "Podés pedirme cualquier producto por nombre."};
    return {handled:true,
      text:"No tengo una URL del menú verificada ahora mismo. " +
        "Te lo muestro acá para que puedas elegir:\n" + menuPageText(available,0)};
  }
  if(activeDraft && wantsCartSummary(input.message)) {
    return {handled:true,text:formatDraftCart(draft.items,available)};
  }
  if(activeDraft && (isMoreMenuRequest(input.message) || isPreviousMenuRequest(input.message))) {
    const maxPage=Math.max(0,Math.ceil(available.length/MENU_PAGE_SIZE)-1);
    const newPage=isMoreMenuRequest(input.message)?
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
    const preparation=interpretNaturalPreparation(input.message,lines);
    if(preparation.kind!=="safe")
      return {handled:true,
        ...(preparation.kind==="human"?{humanHandoff:true,handoffReason:preparation.code}:{}),
        text:preparation.prompt};
    const prepared=preparation.lines;
    const requestedTotals=new Map<string,number>();
    for(const line of prepared)
      requestedTotals.set(line.productId,(requestedTotals.get(line.productId)??0)+line.quantity);
    if(!confirmedQuantity && [...requestedTotals.values()].some(qty=>qty>5)) {
      draft.pendingBulk=prepared;
      await persist(input.phone,draft);
      return {handled:true,text:"Esa cantidad es alta: "+
        formatDraftCart(prepared,available)+
        "\nSi realmente querés esas unidades, respondé *CONFIRMAR CANTIDAD*. Todavía no se añadieron."};
    }
    const combined=mergeCart(draft.items,prepared);
    if(!combined)return {handled:true,text:"La cantidad supera el máximo permitido por producto (25). Decime cuántas unidades querés."};
    draft.pendingBulk=undefined;draft.items=combined;draft.menuRevision=doc.revision;
    if(draft.stage==="items")draft.stage="name";
    if(["confirm","split_amount","split_confirm"].includes(draft.stage)){
      draft.stage="payment";draft.payment=undefined;draft.splitTransferCOP=undefined;
    }
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
    else if(["confirm","split_amount","split_confirm"].includes(draft.stage)){
      draft.stage="payment";draft.payment=undefined;draft.splitTransferCOP=undefined;
    }
    await persist(input.phone,draft);
    return {handled:true,text:formatDraftCart(draft.items,available)+"\n\n"+stagePrompt(draft.stage)};
  }
  // A customer can send another item number while we are asking for their name
  // or another checkout detail. Never capture it as the person's name.
  // Numeric replies in zone and pickup-time stages retain their special meaning.
  if(activeDraft && ["name","mode","notes","payment","confirm"].includes(draft.stage)
      && isStandaloneMenuSelection(input.message)) {
    const additional=parseNumberedProduct(input.message,available) ??
      parseItemSelection(input.message,available);
    if(!additional)return {handled:true,text:"Ese número no está disponible en el menú. Escribí *MENÚ* o *VER MÁS* para elegir un producto."};
    return addProduct(additional);
  }
  if(activeDraft && (isAddRequest(input.message) || explicitPurchaseStatement(input.message))) {
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
      return addProduct(direct);
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
    const value=extractCustomerName(input.message);
    if (!value)
      return {handled:true,text:"Decime tu nombre para identificar el pedido, por favor."};
    draft.customerName=value;
    draft.stage=draft.mode==="pickup" ? "pickup_time" : draft.mode==="delivery" ? "zone" : "mode";
    const savedPin=freshVerifiedPin(conversation?.metadata?.restaurant_delivery_pin_v1);
    if(draft.stage==="zone" && savedPin &&
       zoneRows.some(z=>z.id===savedPin.zoneId)){
      draft.zoneId=savedPin.zoneId;
      draft.stage="address";
    }
    await persist(input.phone,draft);
    return {handled:true,text:draft.stage==="pickup_time" ?
      "¿En cuántos minutos pensás pasar a buscarlo? Respondé *AHORA* o un número entre 10 y 180. La hora queda sujeta a confirmación de cocina." :
      draft.stage==="address" ?
        "Ya tengo tu ubicación verificada. ¿Cuál es la calle/número y la referencia para encontrar la puerta?" :
      draft.stage==="zone" ? (zoneRows.length ?
        "¿En cuál zona estás? " + zoneRows.map((z,i)=> (i+1)+". "+z.name+" ($"+z.fee_cop.toLocaleString("es-CO")+")").join(" · ") :
        "Todavía no tenemos zonas verificadas. Para domicilio debe confirmar un encargado; si preferís retirar, respondé *RETIRO*.") :
      "¿Pasás a buscarlo al local o querés domicilio? Respondé *RETIRO* o *DOMICILIO*."};
  }
  if (draft.stage==="mode") {
    if (/^(retiro|recoger|paso a buscar|local|para retirar|para recoger|retiro en el local)$/.test(normalized)) {
      draft.mode="pickup";draft.stage="pickup_time";
      await persist(input.phone,draft);
      return {handled:true,text:"Perfecto, sin domicilio. ¿En cuántos minutos pasarás a buscarlo? Respondé *AHORA* o un número entre 10 y 180."};
    }
    if (/^(domicilio|delivery|envio|a domicilio|para domicilio)$/.test(normalized)) {
      draft.mode="delivery";draft.stage="zone";
      const savedPin=freshVerifiedPin(conversation?.metadata?.restaurant_delivery_pin_v1);
      if(savedPin&&zoneRows.some(z=>z.id===savedPin.zoneId)){
        draft.zoneId=savedPin.zoneId;
        draft.stage="address";
      }
      await persist(input.phone,draft);
      if(draft.stage==="address")
        return {handled:true,text:"Ya verifiqué tu ubicación compartida. "+
          "Pasame la calle/número y una referencia para encontrar la puerta."};
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
    const pin=freshVerifiedPin(conversation?.metadata?.restaurant_delivery_pin_v1);
    if(pin){
      // The WhatsApp coordinate is the delivery destination; the following text
      // is a door/house reference, NOT an independently geocoded address.
      if(value.length<8||value.length>250 || /^(?:si|sí|ok|dale|listo)$/i.test(value))
        return {handled:true,text:"Ya verifiqué tu pin. Para encontrar la puerta, "+
          "decime la calle/número o una referencia clara de la casa, edificio o apartamento."};
      if(/\bbogot[aá]\b/i.test(value))
        return {handled:true,text:"El pin compartido es el destino del domicilio. "+
          "La referencia menciona Bogotá, fuera de nuestra cobertura. "+
          "Por favor verificá la ubicación o consultá con el encargado."};
      const quotation=await quoteVerifiedDeliveryPoint({lat:pin.lat,lng:pin.lng})
        .catch(()=>null);
      if(!quotation?.covered || !quotation.zone ||
         quotation.zone.id!==pin.zoneId)
        return {handled:true,text:"La zona del pin no pudo volver a verificarse. "+
          "Compartí una nueva ubicación o pedí que un encargado confirme el domicilio."};
      const gpsUrl="https://maps.google.com/?q="+pin.lat.toFixed(7)+","+pin.lng.toFixed(7);
      draft.zoneId=quotation.zone.id;
      draft.address="Destino por ubicación WhatsApp: "+gpsUrl+
        " | Referencia de entrega: "+value;
      draft.stage="notes";
      await persist(input.phone,draft);
      return {handled:true,text:"Tomaremos el pin compartido como punto de entrega y "+
        "esta referencia para encontrar la puerta: "+value+". "+
        "Zona *"+quotation.zone.name+"*, domicilio *$"+
        quotation.zone.feeCOP.toLocaleString("es-CO")+" COP*. "+
        "La ruta desde el restaurante es de "+
        ((quotation.drivingDistanceMeters??0)/1000).toFixed(2)+
        " km. ¿Tenés alguna indicación o alergia alimentaria? Respondé *NO* si ninguna."};
    }
    if (value.length < 12 || value.length > 300)
      return {handled:true,text:"Decime calle, número, barrio y ciudad (Funza o Mosquera) para comprobar el domicilio."};
    let quotation;
    try { quotation=await quoteVerifiedDeliveryAddress(value); }
    catch {
      return {handled:true,humanHandoff:true,text:"No pude verificar la ruta de domicilio. Un encargado debe confirmar cobertura y tarifa; todavía no registramos el pedido."};
    }
    if(!quotation.covered || !quotation.zone){
      if(quotation.reason==="DIRECCION_INCOMPLETA_O_SIN_CIUDAD" ||
         quotation.reason==="DIRECCION_NO_GEOCODIFICADA_CON_PRECISION")
        return {handled:true,text:"No logré ubicar la dirección con seguridad. ¿Podés indicarme calle, número, barrio y si es en Funza o Mosquera? Si no aparece, debe ayudar un encargado."};
      return {handled:true,humanHandoff:true,
        text:"No puedo confirmar cobertura de esa dirección: "+
          (quotation.reason??"zona sin verificar")+
          ". Un encargado debe comprobarla antes de aceptar el domicilio."};
    }
    draft.zoneId=quotation.zone.id;
    draft.address=quotation.formattedAddress??value;
    draft.stage="notes";await persist(input.phone,draft);
    return {handled:true,text:"Verifiqué la dirección en "+quotation.zone.name+
      ". Tarifa domicilio: $"+quotation.zone.feeCOP.toLocaleString("es-CO")+
      ". Distancia vial desde el local: "+
      ((quotation.drivingDistanceMeters??0)/1000).toFixed(2)+
      " km (estimación en auto, no seguimiento del repartidor). "+
      "¿Tenés indicaciones especiales o alergias alimentarias? Respondé *NO* si ninguna."};
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
    draft.customerNote = /^(?:no|ninguna|ninguno|sin observaciones)$/.test(normalized) ? "" : comment;
    draft.stage="payment"; await persist(input.phone,draft);
    return {handled:true,text:"¿Pagás *EFECTIVO*, *TRANSFERENCIA* o *MIXTO* (una parte transferida y el resto en efectivo)? El comprobante siempre se verifica."};
  }
  if (draft.stage==="human_review") {
    return {handled:true,text:"Tu solicitud requiere la atención de una persona. Todavía no se registró un pedido."};
  }
  if (draft.stage==="payment") {
    if(isSplitPaymentRequest(input.message)){
      const total=buildOrderSummary(draft,available,zoneRows).total;
      const amount=parseExactTransferCOP(input.message);
      const split=amount===null?null:splitPaymentQuote(total,amount);
      if(split){
        draft.payment="mixed";draft.splitTransferCOP=amount!;
        draft.stage="split_confirm";
        await persist(input.phone,draft);
        return {handled:true,text:splitQuoteMessage(total,amount!)};
      }
      draft.stage="split_amount";draft.payment="mixed";draft.splitTransferCOP=undefined;
      await persist(input.phone,draft);
      return {handled:true,text:"Claro, podés dividir el pago. "+
        "Decime cuántos *pesos colombianos exactos* vas a transferir. "+
        "Por ejemplo *40000 COP* (no solo '40', para no confundir $40 con $40.000)."};
    }
    if (!/^(efectivo|transferencia)$/.test(normalized))
      return {handled:true,text:"Elegí *EFECTIVO*, *TRANSFERENCIA* o *MIXTO*."};
    draft.payment=normalized==="efectivo"?"cash":"transfer";
    draft.splitTransferCOP=undefined;
    const summary=buildOrderSummary(draft,available,zoneRows);
    draft.stage="confirm";draft.menuRevision=doc.revision;await persist(input.phone,draft);
    return {handled:true,text:summary.text};
  }
  if (draft.stage==="split_amount") {
    const amount=parseExactTransferCOP(input.message);
    const total=buildOrderSummary(draft,available,zoneRows).total;
    const split=amount===null?null:splitPaymentQuote(total,amount);
    if(!split){
      return {handled:true,text:"Necesito un monto exacto menor que el total y que deje "+
        "algo en efectivo. Escribí por ejemplo *40000 COP* o *40 mil COP*; "+
        "no interpreto '40' como 40 mil."};
    }
    draft.payment="mixed";draft.splitTransferCOP=amount!;
    draft.stage="split_confirm";await persist(input.phone,draft);
    return {handled:true,text:splitQuoteMessage(total,amount!)};
  }
  if (draft.stage==="split_confirm") {
    if(normalized!=="confirmar division") {
      if(/^(cambiar monto|cambiar|modificar monto)$/.test(normalized)){
        draft.stage="split_amount";await persist(input.phone,draft);
        return {handled:true,text:"¿Cuántos pesos COP exactos vas a transferir? "+
          "Ejemplo: *40000 COP*."};
      }
      return {handled:true,text:"Revisá ambos importes y respondé "+
        "*CONFIRMAR DIVISIÓN*, o *CAMBIAR MONTO*."};
    }
    const total=buildOrderSummary(draft,available,zoneRows).total;
    if(!splitPaymentQuote(total,Number(draft.splitTransferCOP)))
      return {handled:true,humanHandoff:true,
        text:"Los importes ya no coinciden con el total del pedido. "+
          "Un encargado debe revisarlo antes de registrarlo."};
    draft.payment="mixed";draft.stage="confirm";
    draft.menuRevision=doc.revision;await persist(input.phone,draft);
    return {handled:true,text:buildOrderSummary(draft,available,zoneRows).text};
  }
  if (draft.stage==="confirm") {
    if (normalized!=="confirmar pedido")
      return {handled:true,text:"Para registrarlo respondé exactamente *CONFIRMAR PEDIDO*. Para descartarlo, *CANCELAR PEDIDO*."};
    if (doc.revision!==draft.menuRevision) {
      draft.stage="payment";await persist(input.phone,draft);
      return {handled:true,text:"El menú cambió desde que cotizamos. Necesito confirmar otra vez el total antes de guardar el pedido. Escribí *EFECTIVO* o *TRANSFERENCIA*."};
    }
    const quote=buildOrderSummary(draft,available,zoneRows);
    const order=await supabaseRpc<{id:string;number:number;version:number;total_cop:number}>(
      draft.payment==="mixed"?"restaurant_ops_create_split_order":"restaurant_ops_create_order",{

      p_company_id:COMPANY,p_source:"whatsapp",p_source_key:"wa-"+draft.id,
      p_customer_phone:input.phone,p_customer_name:draft.customerName!,
      p_fulfillment_mode:draft.mode!,p_items:draft.items,
      p_zone_id:draft.mode==="delivery"?draft.zoneId:null,
      p_address:draft.mode==="delivery"?draft.address:null,
      p_customer_note:draft.customerNote??null,
      p_pickup_due_at:draft.mode==="pickup"?draft.pickupDueAt:null,
      p_actor_id:"whatsapp_checkout",p_actor_role:"system",
      p_customer_confirmed:true,p_expected_menu_revision:draft.menuRevision,
      ...(draft.payment==="mixed"?
        {p_transfer_cop:draft.splitTransferCOP}:
        {p_payment_method:draft.payment==="cash"?"cash":"transfer",
         p_payment_status:draft.payment==="cash"?"cash_on_delivery":"pending"})
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
    const instructions = draft.payment === "transfer" || draft.payment==="mixed"
      ? await transferInstructionsForOrder({
          number: order.number,
          totalCOP: draft.payment==="mixed"?
            Number(draft.splitTransferCOP):Number(order.total_cop ?? quote.total)
        }).catch(() => ({
          text: "La cuenta bancaria no está disponible en este momento. " +
            "Un encargado te indicará cómo completar el pago; no hagas transferencias a cuentas no verificadas.",
          humanHandoff: true
        }))
      : null;
    return {handled:true,humanHandoff:instructions?.humanHandoff===true,
      text:"*Pedido #"+order.number+" registrado*.\n"+
        quote.lines.map(x=>x.quantity+" × "+x.productName+
          (x.instructions?" ("+x.instructions+")":"")).join("\n")+
        "\nTotal: $"+quote.total.toLocaleString("es-CO")+
        (draft.mode==="pickup"?"\nRetiro en local. Te avisamos cuando esté listo.":
          "\nDomicilio registrado. Te avisamos cuando salga a reparto.")+
        (draft.payment==="mixed"?"\nPago dividido: $"+
          Number(draft.splitTransferCOP).toLocaleString("es-CO")+
          " por transferencia pendiente de verificar + $"+
          (quote.total-Number(draft.splitTransferCOP)).toLocaleString("es-CO")+
          " en efectivo. *Cocina espera la verificación bancaria*." : "")+
        (instructions?"\n\n"+instructions.text:"\nPago en efectivo al recibir. Te avisamos cuando cocina confirme la preparación.")};
  }
  return {handled:false,text:""};
}
