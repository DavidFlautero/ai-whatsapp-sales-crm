import {getConversationByPhone,updateConversationMetadata}
  from "../conversations/conversation.repository.js";
import {supabaseRequest} from "../db/supabase-rest.client.js";
import {
  spanishNormalize,findMenuMentions,mergeCart,formatDraftCart,
  type CartLine,type MenuProduct
} from "./restaurant-checkout-dialogue.service.js";
import type {
  CheckoutDraft,CheckoutReply
} from "./restaurant-whatsapp-checkout.service.js";

type Product=MenuProduct;
type PendingCombo={
  originalProductId:string;comboProductId:string;createdAt:string;
};
type PendingUnit={
  instruction:string;quantity:number;createdAt:string;
};
type WorkingDraft=CheckoutDraft&{
  pendingCombo?:PendingCombo;pendingUnit?:PendingUnit;
};
const COMPANY="delibocados";
const AGE=20*60*1000;

export type IngredientRemoval={
  instruction:string;quantity:number;
};
const INGREDIENTS:Record<string,string>={
  vegetales:"SIN VEGETALES",cebolla:"SIN CEBOLLA",
  tomate:"SIN TOMATE",lechuga:"SIN LECHUGA",
  salsa:"SIN SALSA",salsas:"SIN SALSAS",
  queso:"SIN QUESO",mayonesa:"SIN MAYONESA"
};

export function detectIngredientRemoval(input:string):IngredientRemoval|null{
  const source=spanishNormalize(input).replace(/[.,!?]/g," ");
  if(/\b(?:alergi\w*|anafilaxia|intolerancia|celiac\w*)\b/.test(source))
    return null;
  const part=source.match(/\b(?:sin|quitar|quita|no poner|no le pongas)\s+(?:los?\s+|las?\s+)?(vegetales|cebolla|tomate|lechuga|salsas?|queso|mayonesa)\b/);
  if(!part)return null;
  if(!/\b(?:una|uno|dos|tres|de esas|de esos|la primera|la segunda|sin|quitar|quita)\b/.test(source))
    return null;
  // Only the quantity immediately attached to the modification applies.
  // "dos hamburguesas, una de esas sin vegetales" changes ONE burger.
  const before=source.slice(0,part.index).trim();
  const amount=before.match(/\b(una|uno|dos|2|tres|3)(?:\s+de\s+(?:esas|esos|ellas|ellos|las|los))?\s*$/);
  const qty=amount ? /^(?:dos|2)$/.test(amount[1])?2:
    /^(?:tres|3)$/.test(amount[1])?3:1 : 1;
  return {instruction:INGREDIENTS[part[1]],quantity:qty};
}

function fresh<T extends {createdAt:string}>(value:T|undefined):T|null{
  if(!value||!Number.isFinite(Date.parse(value.createdAt)))return null;
  const age=Date.now()-Date.parse(value.createdAt);
  return age>=0&&age<AGE?value:null;
}
function normalizeProduct(value:string):string{
  return spanishNormalize(value).replace(/[.,!?]/g," ");
}
export function findCatalogCombo(product:Product,menu:Product[]):Product|null {
  const base=normalizeProduct(product.name).replace(/\bcombo\b/g,"").trim();
  if(!base||base.length<6)return null;
  const options=menu.filter(p=>p.id!==product.id && p.available!==false &&
    p.priceNeedsReview!==true && Number.isSafeInteger(Number(p.priceCOP)) &&
    Number(p.priceCOP)>=0 && /\bcombo\b/.test(normalizeProduct(p.name)) &&
    normalizeProduct(p.name).replace(/\bcombo\b/g,"").trim()===base);
  return options.length===1?options[0]:null;
}

export function applyUnitRemoval(
  lines:CartLine[],productId:string,quantity:number,instruction:string
):CartLine[]|null {
  if(!INGREDIENTS || !Object.values(INGREDIENTS).includes(instruction) ||
    !Number.isInteger(quantity)||quantity<1||quantity>25)return null;
  const standard=lines.findIndex(x=>x.productId===productId && !x.instructions &&
    x.quantity>=quantity);
  if(standard<0)return null;
  const copy=lines.map(x=>({...x}));
  copy[standard].quantity-=quantity;
  const filtered=copy.filter(x=>x.quantity>0);
  return mergeCart(filtered,[{productId,quantity,instructions:instruction}]);
}

export function applyComboChoice(
  lines:CartLine[],originalProductId:string,comboProductId:string,
  quantity:number
):CartLine[]|null {
  if(!Number.isInteger(quantity)||quantity<1||quantity>25)return null;
  const available=lines.filter(x=>x.productId===originalProductId&&!x.instructions)
    .reduce((n,x)=>n+x.quantity,0);
  if(available<quantity)return null;
  let remaining=quantity;
  const copy=lines.map(x=>({...x}));
  for(const line of copy){
    if(line.productId!==originalProductId||line.instructions||remaining<=0)continue;
    const moved=Math.min(line.quantity,remaining);
    line.quantity-=moved;remaining-=moved;
  }
  return mergeCart(copy.filter(x=>x.quantity>0),[{productId:comboProductId,quantity}]);
}
function cartProductIds(draft:WorkingDraft):string[]{
  return [...new Set(draft.items.filter(x=>x.quantity>0).map(x=>x.productId))];
}
function selectedProduct(message:string,draft:WorkingDraft,menu:Product[]):Product|null {
  const inCart=new Set(cartProductIds(draft));
  const explicit=findMenuMentions(message,menu).filter(x=>inCart.has(x.product.id));
  if(explicit.length===1)return explicit[0].product;
  if(explicit.length>1)return null;
  const ids=[...inCart];
  return ids.length===1?menu.find(x=>x.id===ids[0])??null:null;
}
function itemPrompt(draft:WorkingDraft,menu:Product[]):string {
  const ids=new Set(cartProductIds(draft));
  return menu.filter(x=>ids.has(x.id)).map(p=>p.name).join(" o ");
}
export function isComboRequest(text:string):boolean{
  const t=normalizeProduct(text);
  return /^(?:en combo|hazlo en combo|hacelo en combo|los quiero en combo|las quiero en combo|poner en combo|ponlo en combo|quiero el combo|quiero combo)$/.test(t);
}

export async function handleRestaurantLineModification(input:{
  phone:string;message:string
}):Promise<CheckoutReply>{
  const conversation=await getConversationByPhone(input.phone,COMPANY);
  const value=conversation?.metadata?.restaurant_checkout_v1 as WorkingDraft|undefined;
  if(!value?.id||["completed","cancelled","human_review"].includes(value.stage)||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    Date.now()-Date.parse(value.createdAt)>2*3600000)
    return {handled:false,text:""};
  const draft:WorkingDraft={...value,items:value.items.map(x=>({...x}))};
  if(!draft.items.length)return {handled:false,text:""};

  const modification=detectIngredientRemoval(input.message);
  const combo=isComboRequest(input.message);
  const pendingUnit=fresh(draft.pendingUnit);
  const pendingCombo=fresh(draft.pendingCombo);
  if(!modification&&!combo&&!pendingUnit&&!pendingCombo)return {handled:false,text:""};

  const rows=await supabaseRequest<Array<{payload:{products?:Product[]}}>>({
    table:"restaurant_menu_documents",
    query:"?company_id=eq.delibocados&select=payload&limit=1"
  });
  const menu=(rows[0]?.payload?.products??[]).filter(x=>x.id&&x.name&&
    x.available!==false&&x.priceNeedsReview!==true &&
    Number.isSafeInteger(Number(x.priceCOP))&&Number(x.priceCOP)>=0);

  const save=async()=>{
    await updateConversationMetadata(input.phone,{restaurant_checkout_v1:draft},COMPANY);
  };
  const target=selectedProduct(input.message,draft,menu);
  const simple=normalizeProduct(input.message);

  if(pendingUnit && !modification && !combo){
    const line=target;
    // A vague answer must not silently select a product when several are present.
    const explicit=findMenuMentions(input.message,menu).filter(x=>
      cartProductIds(draft).includes(x.product.id));
    if(!line||explicit.length!==1)
      return {handled:true,text:"¿A cuál producto aplicamos *"+
        pendingUnit.instruction+"*? "+itemPrompt(draft,menu)};
    const adjusted=applyUnitRemoval(draft.items,line.id,pendingUnit.quantity,pendingUnit.instruction);
    if(!adjusted)return {handled:true,text:"No encuentro suficientes unidades estándar de "+
      line.name+" para ese cambio. "+formatDraftCart(draft.items,menu)};
    draft.items=adjusted;draft.pendingUnit=undefined;
    if(draft.stage==="confirm")draft.stage="payment";
    await save();
    return {handled:true,text:"Anoté el cambio solo para "+
      pendingUnit.quantity+" × "+line.name+".\n"+formatDraftCart(draft.items,menu)+
      "\nLa cocina verá las instrucciones de esa unidad."};
  }

  if(modification){
    if(/(?:alergi\w*|anafilaxia|intolerancia|celiac\w*)/i.test(input.message))
      return {handled:false,text:""};
    if(!target){
      draft.pendingUnit={...modification,createdAt:new Date().toISOString()};
      await save();
      return {handled:true,text:"Perfecto: *"+modification.instruction+
        "* para "+modification.quantity+" unidad(es). ¿De cuál producto? "+
        itemPrompt(draft,menu)};
    }
    const adjusted=applyUnitRemoval(draft.items,target.id,modification.quantity,modification.instruction);
    if(!adjusted)
      return {handled:true,text:"No veo "+modification.quantity+
        " unidades sin modificaciones de "+target.name+
        ". Revisemos el carrito antes de avanzar.\n"+formatDraftCart(draft.items,menu)};
    draft.items=adjusted;draft.pendingUnit=undefined;
    if(draft.stage==="confirm")draft.stage="payment";
    await save();
    return {handled:true,text:"Listo, registré *"+modification.instruction+
      "* solamente en "+modification.quantity+" × "+target.name+
      ". Las otras unidades quedan iguales.\n"+formatDraftCart(draft.items,menu)};
  }

  if(pendingCombo){
    const comboProduct=menu.find(x=>x.id===pendingCombo.comboProductId);
    const baseProduct=menu.find(x=>x.id===pendingCombo.originalProductId);
    if(!comboProduct||!baseProduct){draft.pendingCombo=undefined;await save();
      return {handled:true,text:"La opción de combo ya no está publicada. No cambié el pedido."};}
    let qty:number|null=null;
    if(/^(?:todas|todos|las dos|los dos|ambas|ambos)$/.test(simple)){
      qty=draft.items.filter(x=>x.productId===baseProduct.id&&!x.instructions)
        .reduce((n,x)=>n+x.quantity,0);
    } else if(/^(?:solo una|solo uno|una|uno|1)$/.test(simple)){
      qty=1;
    }
    if(qty===null)
      return {handled:true,text:"¿Convertimos *todas* las unidades de "+
        baseProduct.name+" en "+comboProduct.name+", o *solo una*? "+
        "Los precios se toman del catálogo oficial."};
    const adjusted=applyComboChoice(draft.items,baseProduct.id,comboProduct.id,qty);
    if(!adjusted)return {handled:true,text:"No pude hacer el cambio sin alterar "+
      "las otras unidades. No modifiqué el carrito."};
    draft.items=adjusted;draft.pendingCombo=undefined;
    if(draft.stage==="confirm")draft.stage="payment";
    await save();
    return {handled:true,text:"Cambié "+qty+" × "+baseProduct.name+
      " por "+qty+" × "+comboProduct.name+
      " al precio oficial publicado.\n"+formatDraftCart(draft.items,menu)};
  }

  if(combo){
    if(!target)return {handled:true,text:"¿Cuál producto querés en combo? "+
      itemPrompt(draft,menu)};
    const matching=findCatalogCombo(target,menu);
    if(!matching)return {handled:true,text:"No encuentro un combo con precio "+
      "verificado para "+target.name+" en el catálogo actual. "+
      "No voy a sumar papas o bebida ni cambiar el precio sin confirmarlo con el local."};
    const qty=draft.items.filter(x=>x.productId===target.id&&!x.instructions)
      .reduce((n,x)=>n+x.quantity,0);
    if(!qty)return {handled:true,text:"Este artículo ya tiene "+
      "instrucciones especiales. Un encargado debe confirmar el combo."};
    if(qty>1){
      draft.pendingCombo={originalProductId:target.id,comboProductId:matching.id,
        createdAt:new Date().toISOString()};
      await save();
      return {handled:true,text:"Tenemos *"+matching.name+"* a $"+
        Number(matching.priceCOP).toLocaleString("es-CO")+
        " COP cada uno. ¿Querés cambiar *todas* las unidades o *solo una*?"};
    }
    const adjusted=applyComboChoice(draft.items,target.id,matching.id,1);
    if(!adjusted)return {handled:true,text:"No pude aplicar el combo de forma segura."};
    draft.items=adjusted;
    if(draft.stage==="confirm")draft.stage="payment";
    await save();
    return {handled:true,text:"Cambié "+target.name+" por *"+
      matching.name+"* según el menú.\n"+formatDraftCart(draft.items,menu)};
  }
  return {handled:false,text:""};
}
