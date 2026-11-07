/**
 * Supervised exception routing derived from anonymized restaurant-chat scenarios.
 *
 * This is deliberately not a price engine or a customer-data training corpus.
 * It classifies unsupported operations and prevents the LLM from silently
 * accepting balances, item-level edits or cash/transfer splits.*/export type RestaurantException =| "mixed_payment"| "payment_dispute"| "individual_item_change"| "post_dispatch_change";export type RestaurantExceptionContext={cartUnits:number;recentOrderStatus?:string;};function normalizeCustomerMessage(value:string):string{return value.toLocaleLowerCase("es-CO").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();}export function detectRestaurantException(message:string,context:RestaurantExceptionContext):RestaurantException|null {const m=normalizeCustomerMessage(message);const transfer=/\b(?:bre[\s-]?b|nequi|daviplata|transferencia|consignacion)\b/.test(m);const cash=/\b(?:efectivo|en mano|cash|aqui el resto|aca el resto|resto por aca|resto aqui|resto en efectivo)\b/.test(m);const split=/\b(?:resto|diferencia|mitad|una parte|abono|parcial)\b/.test(m);if((transfer&&cash)||(transfer&&split&&/\b(?:te envio|te mando|pago|abono)\b/.test(m)))return "mixed_payment";// Monetary disagreements are never reconciled from free-form chat arithmetic.if(/\b(?:me dijeron otro total|me dijeron que eran|no cuadra|no cuadran|le debian plata|le deben plata|me deben plata|pedido tiene otro precio|el repartidor cobra diferente|cobro equivocado|cobro diferente)\b/.test(m))
    return "payment_dispute";
  if(/\b(?:cuanto se debe|cuanto le debo|cuanto falta pagar)\b/.test(m) &&
    /\b(?:descuento|deuda|gaseosas|abono|saldo)\b/.test(m))
    return "payment_dispute";

  if(context.cartUnits>1){
    const individual=/\b(?:una de esas|uno de esos|una de ellas|uno de ellos|
      una de las|uno de los|solo una|solamente una|la primera|la segunda|
      una sin|una con|otro sin|una aparte)\b/.test(m);const change=/\b(?:sin|con|extra|vegetales|cebolla|salsa|queso|combo|cambiar|quitar|agregar|retirar)\b/x.test(m);
    if(individual&&change)return "individual_item_change";
  }

  const dispatched=["out_for_delivery","completed","cancelled"]
    .includes(context.recentOrderStatus??"");
  if(dispatched&&context.cartUnits===0&&
    /\b(?:agrega|agregar|quiero sumar|cambiar el pedido|modificar|
      otra bebida|otra gaseosa|de litro|una mas|otro producto)\b/x.test(m))
    return "post_dispatch_change";
  return null;
}

export function restaurantExceptionResponse(kind:RestaurantException):string {
  switch(kind){
    case "mixed_payment":
      return "Entiendo: querés pagar una parte por transferencia y el resto en efectivo. "+
        "Para evitar un cobro incorrecto, lo revisará un encargado con el total oficial. "+
        "No voy a marcar la transferencia como recibida sin verificarla.";
    case "payment_dispute":
      return "Veo que hay una diferencia en el cobro o en el saldo. "+
        "Voy a pasarlo a un encargado para conciliar el pedido, los pagos "+
        "y cualquier descuento registrado. No voy a darte un total sin comprobarlo.";
    case "individual_item_change":
      return "Entendí que querés modificar solo una unidad del pedido. "+
        "Lo revisará un encargado para que la cocina distinga correctamente "+
        "cuál va con ese cambio; no voy a aplicarlo a todos los productos.";
    case "post_dispatch_change":
      return "Ese pedido ya figura en una etapa avanzada o finalizada. "+
        "Voy a consultar con un encargado si todavía se puede modificar, "+
        "antes de cobrar o agregar algo que no llegue al repartidor.";
  }
}

/** Sanitized patterns, not historical records or prices. */
export const RESTAURANT_CONVERSATION_GUIDANCE=[
  "En Colombia «me regalas una mazorcada» significa que quiere comprarla, no obtenerla gratis.",
  "«Y un jugo en agua» seguido de «mora» especifica sabor y preparación del mismo artículo; no reinicies la charla.",
  "«Dos mixtas» es ambiguo si el menú tiene varias opciones mixtas. Preguntá cuál sin inventar el producto.",
  "«Una de esas sin vegetales» cuando hay dos unidades afecta SOLO una, nunca ambas.",
  "«En combo» puede cambiar el precio y contenido. Consultá el SKU/variante oficial antes de agregarlo.",
  "«Así no más» significa que no quiere bebidas ni extras por ahora; no insistir repetidamente.",
  "«Llamame cuando lleguen» es una instrucción de entrega, no un cambio de número público del restaurante.",
  "«Se demora, veci?» requiere consultar el último estado real; si no hay ETA verificado, decilo y derivá.",
  "Un total mencionado en conversaciones antiguas no es un precio oficial ni una deuda confirmada.",
  "Un comprobante enviado no equivale a un pago verificado; los pagos mixtos necesitan conciliación.",
  "El cliente puede escribir pedidos, dirección y detalles en varios mensajes. Preguntá solo lo que falte.",
  "Un trabajador atendiendo el chat tiene prioridad: no enviar saludos automáticos duplicados.",
  "Respondé con una o dos frases naturales; jamás mandes una lista de todos los campos en el saludo."
] as const;
