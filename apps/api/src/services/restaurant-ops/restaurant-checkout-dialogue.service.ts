/**
 * Deterministic conversation commands for restaurant checkout.
 * Read-only helpers: no AI model decides prices or creates orders.
 */
export type MenuProduct = {
  id: string;
  name: string;
  priceCOP: number;
  available?: boolean;
  priceNeedsReview?: boolean;
};
export type CartLine = { productId: string; quantity: number };

export function spanishNormalize(input: string) {
  return input.toLocaleLowerCase("es-CO")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/\s+/g," ").trim();
}
export const MENU_PAGE_SIZE = 18;

export function wantsCartSummary(input:string):boolean {
  const m=spanishNormalize(input);
  return /\b(?:carrito|canasta)\b/.test(m) ||
    /\b(?:que|cuanto|cuantos)\s+(?:teng\w*|llev\w*|hay|va|vale|sale)\b.*\b(?:pedido|productos|orden)\b/.test(m) ||
    /\b(?:resumen|total|detalle|contenido)\b.*\b(?:pedido|orden|compra)\b/.test(m) ||
    /\b(?:mi pedido|pedido actual)\b.*\b(?:que tengo|que llevo|cuanto cuesta|subtotal)\b/.test(m);
}
export function isCoverageQuestion(input:string):boolean {
  const m=spanishNormalize(input);
  return /\b(?:bogota|funza|mosquera)\b/.test(m) &&
    /\b(?:pedidos?|entregas?|domicilios?|envian|envios?|llevan|hacen|llegan|cobertura)\b/.test(m) ||
    /\b(?:a donde|hasta donde|que zonas|que ciudades)\b.*\b(?:domicilios?|envian|pedidos?)\b/.test(m);
}
export function coverageAnswer(input:string):string {
  const m=spanishNormalize(input);
  if(/\bbogota\b/.test(m)) {
    return "Por ahora no realizamos domicilios a Bogotá. Atendemos sectores de Funza y Mosquera; cada dirección debe estar dentro de una zona verificada. ¿Querés pedir para retirar en el local?";
  }
  return "Realizamos domicilios en sectores de Funza y Mosquera, según las zonas habilitadas. Decime tu sector y dirección para comprobar cobertura y costo; no puedo confirmar un domicilio fuera de una zona verificada.";
}
export function isMenuRequest(input:string):boolean {
  const m=spanishNormalize(input);
  return /^(?:menu|carta|ver menu|ver carta|mostrame el menu|muestrame el menu|ver productos|lista de productos)(?: por favor)?[.!?]*$/.test(m);
}
export function isMoreMenuRequest(input:string):boolean {
  const m=spanishNormalize(input);
  return /^(?:ver mas|mas productos|siguiente|siguiente pagina|mas opciones|otros productos)[.!?]*$/.test(m);
}
export function isPreviousMenuRequest(input:string):boolean {
  return /^(?:anterior|pagina anterior|volver al menu anterior)[.!?]*$/.test(spanishNormalize(input));
}
export function isAddRequest(input:string):boolean {
  const m=spanishNormalize(input);
  return /^(?:agrega(?:me)?|agregar|anade(?:me)?|anadir|suma(?:me)?|sumar|pon(?:me)?|incluye|inclui|quiero agregar|quiero anadir|quiero sumar|otra|otro)\b/.test(m) ||
    (/^(?:quiero|quisiera|dame|me das|me regalas|me vendes)\s+(?:un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d{1,2})\b/.test(m) &&
      !/\b(?:domicilio|retiro|delivery|envio)\b/.test(m));
}
export function isRemoveRequest(input:string):boolean {
  return /^(?:quita(?:me)?|quitar|saca(?:me)?|sacar|elimina(?:me)?|eliminar|borra(?:me)?|borrar|no quiero|sin)\b/.test(spanishNormalize(input));
}
export function parseNumberedProduct(input:string, menu:MenuProduct[]):CartLine[]|null {
  const m=spanishNormalize(input);
  // One menu item: "11" means one unit of the published menu's item #11.
  if(/^\d{1,3}$/.test(m)) {
    const product=menu[Number(m)-1];
    return product?[{productId:product.id,quantity:1}]:null;
  }
  // Existing syntax: "2x7, 1x11" means two of #7 and one of #11.
  const token=/^\s*(\d{1,2})\s*[x×]\s*(\d{1,3})\s*$/;
  const chunks=m.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean);
  if(!chunks.length || chunks.length>20)return null;
  const items=new Map<string,number>();
  for(const chunk of chunks) {
    const q=chunk.match(token);
    if(!q)return null;
    const quantity=Number(q[1]),index=Number(q[2]);
    const product=menu[index-1];
    if(!product || quantity<1 || quantity>25)return null;
    const total=(items.get(product.id)??0)+quantity;
    if(total>25)return null;
    items.set(product.id,total);
  }
  return [...items].map(([productId,quantity])=>({productId,quantity}));
}
export type ProductMention={product:MenuProduct;start:number;end:number};
export function findMenuMentions(input:string,menu:MenuProduct[]):ProductMention[] {
  const m=spanishNormalize(input);
  const products=menu.map(p=>({p,name:spanishNormalize(p.name)}))
    .filter(p=>p.name.length>=4)
    .sort((a,b)=>b.name.length-a.name.length);
  const found:ProductMention[]=[];
  for(const {p,name} of products){
    // A simple final 's' accounts for common plurals such as hamburguesas.
    const variants=[name,...(/[aeo]$/.test(name)?[name+"s"]:[])];
    for(const variant of variants.sort((a,b)=>b.length-a.length)){
      const index=m.indexOf(variant);
      if(index<0 || m.indexOf(variant,index+variant.length)>=0)continue;
      const before=index===0?" ":m[index-1];
      const after=m[index+variant.length]??" ";
      if(/[a-z0-9]/.test(before)||/[a-z0-9]/.test(after))continue;
      const end=index+variant.length;
      if(found.some(f=>index<f.end&&end>f.start))continue;
      found.push({product:p,start:index,end});
      break;
    }
  }
  return found.sort((a,b)=>a.start-b.start);
}
export function findExplicitMenuProducts(input:string,menu:MenuProduct[]):MenuProduct[] {
  return findMenuMentions(input,menu).map(x=>x.product);
}
export function mergeCart(
  existing:CartLine[],added:CartLine[]
):CartLine[]|null {
  const map=new Map<string,number>();
  for(const line of existing)map.set(line.productId,line.quantity);
  for(const line of added) {
    const total=(map.get(line.productId)??0)+line.quantity;
    if(total>25||total<1)return null;
    map.set(line.productId,total);
  }
  return [...map].map(([productId,quantity])=>({productId,quantity}));
}
export function removeFromCart(existing:CartLine[], ids:string[]):CartLine[] {
  const unwanted=new Set(ids);
  return existing.filter(x=>!unwanted.has(x.productId));
}
export function formatDraftCart(cart:CartLine[],menu:MenuProduct[]):string {
  if(!cart.length)return "Tu carrito todavía está vacío. Decime qué productos querés.";
  let subtotal=0,valid=true;
  const lines=cart.map(line=>{
    const p=menu.find(p=>p.id===line.productId);
    if(!p || p.available===false || p.priceNeedsReview ||
       !Number.isSafeInteger(Number(p.priceCOP)) || Number(p.priceCOP)<0){
      valid=false;
      return "• "+line.quantity+" × "+(p?.name??"Producto no disponible")+" — requiere revisión";
    }
    subtotal+=line.quantity*Number(p.priceCOP);
    return "• "+line.quantity+" × "+p.name+" — $"+
      (line.quantity*Number(p.priceCOP)).toLocaleString("es-CO");
  });
  return "*Tu pedido actual:*\n"+lines.join("\n")+
    (valid?"\n*Subtotal: $"+subtotal.toLocaleString("es-CO")+"* (sin domicilio).":
      "\nHay productos sin precio disponible. No podemos confirmar el total.")+
    "\nPodés *AGREGAR*, *QUITAR* o continuar. No se ha registrado el pedido todavía.";
}
export function isPlausibleCustomerName(input:string):boolean {
  const name=input.trim().replace(/\s+/g," ");
  if(name.length<2||name.length>80||name.split(" ").length>5)return false;
  if(!/^[\p{L}][\p{L} .'-]+$/u.test(name))return false;
  const normalized=spanishNormalize(name);
  if(/\b(?:quiero|agrega|agregar|anadir|ponme|pedido|carrito|menu|cuanto|tengo|dime|decime|domicilio|retiro|pagar|efectivo|transferencia|chorizo|arepa)\b/.test(normalized))return false;
  return true;
}
