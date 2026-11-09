/**
 * Deterministic intent guard for transactions, WITHOUT asking a language model
 * to choose if a customer's explicit purchase should persist to the draft.
 * The checkout engine alone validates products, prices, payment and totals.
 */
import {spanishNormalize} from "./restaurant-checkout-dialogue.service.js";

export type FulfillmentChoice="pickup"|"delivery"|"ambiguous"|null;

export function explicitFulfillment(message:string):FulfillmentChoice{
  const m=spanishNormalize(message);
  const pickup=/\b(?:para retirar|para recoger|paso a buscar(?:lo|la)?|retiro en (?:el )?local|recoger en (?:el )?local|para llevar|lo recojo|paso por (?:el )?local)\b/.test(m);
  const delivery=/\b(?:a domicilio|para domicilio|envio a domicilio|domicilio|delivery|a mi casa|a mi direccion|que me lo (?:lleven|traigan|envien|manden)|para entrega)\b/.test(m);
  if(pickup && delivery)return "ambiguous";
  if(pickup)return "pickup";
  if(delivery)return "delivery";
  return null;
}

export function explicitPurchaseStatement(message:string):boolean{
  const m=spanishNormalize(message);
  if(m.length>900 || m.length<7)return false;
  // Questions about prices, menus or recommendations are NOT buying signals,
  // even if they contain "quiero".
  if(/\b(?:quiero|quisiera|me gustaria|necesito)\s+(?:saber|consultar|preguntar|ver|conocer|mirar|comparar|recomendaciones?|una recomendacion|el menu|la carta)\b/.test(m))
    return false;
  if(/^(?:cuanto|que precio|a cuanto|tienen|hay|venden|podria|puedo|me recomendas|me recomiendas)\b/.test(m))
    return false;
  // Quantity is mandatory for non-listed products; no guessing which item.
  const direct=/(?:^|\b)(?:quiero|quisiera|dame|deme|dame|me das|me vendes|me regalas|ponme|poneme|anotame|agregame|agrega|agregar|sumame|anade|añade|me gustaria pedir|voy a pedir|quiero pedir|necesito pedir|te pido|pedime)\s+(?:por favor\s+)?(?:un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d{1,2})\b/.test(m);
  const ordering=/(?:^|\b)(?:quiero pedir|voy a pedir|me gustaria pedir|hacer un pedido|para mi pedido|agregame|anotame|sumame|te pido)\b/.test(m);
  // An explicit order without quantifier is only passed to the checkout engine,
  // which refuses unknown products and ambiguous quantities.
  return direct||ordering;
}

export function shouldDeterministicallyCheckout(
  message:string,stage:string|undefined
):boolean{
  const m=spanishNormalize(message);
  if(explicitPurchaseStatement(message))return true;
  if(/^(?:confirmar pedido|cancelar pedido|confirmar cantidad|confirmar division|vaciar (?:carrito|pedido))$/.test(m))return true;
  if(!stage||["completed","cancelled","human_review"].includes(stage))return false;
  if(stage==="name"){
    // Only simple plausible names; no product, price or multi-intent commands.
    return /^[\p{L}][\p{L} .'-]{1,70}$/u.test(message.trim()) &&
      !/\b(?:pedido|menu|carta|cuanto|precio|domicilio|retirar|transferencia|efectivo|agrega|suma|quita)\b/.test(m);
  }
  if(stage==="mode")return /^(?:retiro|recoger|paso a buscar|local|domicilio|delivery|envio)$/.test(m);
  if(stage==="zone")return /^\d{1,2}$/.test(m)||/^(?:retiro|local)$/.test(m);
  if(stage==="address")return /\b(?:calle|carrera|cra|avenida|av\.|diagonal|transversal|funza|mosquera|barrio)\b/.test(m);
  if(stage==="pickup_time")return /^(?:ahora|\d{1,3})$/.test(m);
  if(stage==="notes")return /^(?:no|ninguna|ninguno|sin observaciones)$/.test(m);
  if(stage==="payment")return /^(?:efectivo|transferencia|mixto)$/.test(m);
  if(stage==="split_amount")return /\b(?:cop|pesos|mil)\b/.test(m);
  if(stage==="split_confirm")return /^(?:confirmar division|cambiar monto|cambiar|modificar monto)$/.test(m);
  return false;
}
