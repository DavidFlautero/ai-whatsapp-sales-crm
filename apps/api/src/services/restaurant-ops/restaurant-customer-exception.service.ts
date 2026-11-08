/**
 * A small safety policy derived from anonymized real restaurant dialogues.
 * Chat messages are examples of customer language, not a source of verified
 * prices, banking details, refunds, product availability or business rules.
 */
export type RestaurantException =
  | "mixed_payment"
  | "payment_dispute"
  | "individual_item_change"
  | "post_dispatch_change";

export type RestaurantExceptionContext = {
  cartUnits: number;
  recentOrderStatus?: string;
};

function normalized(value: string): string {
  return value.toLocaleLowerCase("es-CO")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim();
}

export function detectRestaurantException(
  message: string,
  context: RestaurantExceptionContext
): RestaurantException | null {
  const m = normalized(message);
  const transfer = /\b(?:bre[\s-]?b|nequi|daviplata|transferencia|consignacion)\b/.test(m);
  const cash = /\b(?:efectivo|en mano|cash|aqui el resto|aca el resto|resto por aca|resto aqui)\b/.test(m);
  const split = /\b(?:resto|diferencia|mitad|una parte|abono|parcial)\b/.test(m);
  if ((transfer && cash) ||
      (transfer && split && /\b(?:te envio|te mando|pago|abono)\b/.test(m))) {
    return "mixed_payment";
  }

  const discrepancy = /\b(?:me dijeron otro total|me dijeron que eran|no cuadra|no cuadran|le debian plata|le deben plata|me deben plata|pedido tiene otro precio|el repartidor cobra diferente|cobro equivocado|cobro diferente)\b/;
  if (discrepancy.test(m)) return "payment_dispute";
  if (/\b(?:cuanto se debe|cuanto le debo|cuanto falta pagar)\b/.test(m) &&
      /\b(?:descuento|deuda|gaseosas|abono|saldo)\b/.test(m)) {
    return "payment_dispute";
  }

  if (context.cartUnits > 1) {
    const individual = /\b(?:una de esas|uno de esos|una de ellas|uno de ellos|una de las|uno de los|solo una|solamente una|la primera|la segunda|una sin|una con|otro sin|una aparte)\b/;
    const change = /\b(?:sin|con|extra|vegetales|cebolla|salsa|queso|combo|cambiar|quitar|agregar|retirar)\b/;
    if (individual.test(m) && change.test(m)) return "individual_item_change";
  }

  const dispatched = ["out_for_delivery", "completed", "cancelled"]
    .includes(context.recentOrderStatus ?? "");
  // Do not assume a new shopping request modifies a customer's prior order.
  // Only a message explicitly referring to that existing order can trigger
  // post-dispatch review (otherwise "quiero agregar" starts a new cart).
  const refersToOldOrder =
    /\b(?:al|a mi|a ese|a este|el|mi|ese|este|del)\s+(?:ultimo\s+)?pedido\b/.test(m) ||
    /\bpedido\s*#?\s*\d+\b/.test(m) ||
    /\b(?:pedido anterior|orden anterior)\b/.test(m);
  const requestsModification =
    /\b(?:agrega|agregar|anadir|sumar|cambiar|modificar|quitar|retirar|otra bebida|otra gaseosa|una mas|otro producto)\b/.test(m);
  if (dispatched && context.cartUnits === 0 &&
      refersToOldOrder && requestsModification) {
    return "post_dispatch_change";
  }
  return null;
}

export function restaurantExceptionResponse(kind: RestaurantException): string {
  switch (kind) {
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

/** Sanitized language examples, without phone numbers, bank accounts or order prices. */
export const RESTAURANT_CONVERSATION_GUIDANCE = [
  "«Me regalas una mazorcada» en contexto de restaurante es una solicitud de compra, no un regalo.",
  "«Y un jugo en agua» seguido de «mora» define preparación y sabor de una misma bebida.",
  "«Dos mixtas» requiere precisar el producto si el catálogo contiene varias opciones mixtas.",
  "«Una de esas sin vegetales» cambia solo una unidad, nunca todas las unidades iguales.",
  "«En combo» puede cambiar precio y contenido; verificar la variante real del menú.",
  "«Así no más» indica que no desea extras por ahora; no insistir en bebidas repetidamente.",
  "«Llamar cuando lleguen» es una instrucción de entrega para el repartidor.",
  "«Se demora, veci?» requiere consultar el último estado real; no inventar tiempos.",
  "Un total o una cuenta bancaria mencionados en un chat anterior no son datos oficiales.",
  "Un comprobante enviado no significa pago verificado; pago mixto necesita conciliación.",
  "Pedido, dirección, bebida y detalles pueden llegar en mensajes separados.",
  "Si el operador humano responde, el bot no debe enviar un saludo duplicado.",
  "Respuestas naturales de una o dos frases; no pedir todos los campos en un único saludo."
] as const;
