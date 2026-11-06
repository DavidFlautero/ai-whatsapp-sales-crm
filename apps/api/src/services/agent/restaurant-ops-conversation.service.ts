import { supabaseRequest } from "../db/supabase-rest.client.js";

const COMPANY = "delibocados";
export type RestaurantIntent =
  | "pickup" | "delivery" | "order_status" | "complaint" | "payment" | "other" | "ambiguous";

export function classifyRestaurantIntent(message: string): RestaurantIntent {
  const value = message.toLocaleLowerCase("es-CO").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

  const pickup = /\b(paso a buscar(?:lo|la)?|voy a (?:pasar|recoger|buscar)(?:lo|la)?|lo (recojo|recogemos)|pasamos por|retiro en (el )?local|para recoger|recoger en (el )?local|para llevar|lo busco)\b/.test(value);
  const delivery = /\b(domicilio|domicilios|a mi casa|a mi direccion|me lo (envian|mandan|llevan)|me lo pueden traer|envio a domicilio|para entregar)\b/.test(value);
  if (pickup && delivery) return "ambiguous";
  if (pickup) return "pickup";
  if (delivery) return "delivery";
  if (/\b(reclamo|queja|llego mal|equivocado|faltaron|falta un producto|mal estado|intoxicacion|no llego|demorado|tarde)\b/.test(value))
    return "complaint";
  if (/\b(estado de mi pedido|donde esta mi pedido|como va mi pedido|ya esta listo|cuando sale|cuando llega|cuanto falta|numero de pedido)\b/.test(value))
    return "order_status";
  if (/\b(pague|comprobante|transferencia|nequi|daviplata|efectivo|medio de pago|forma de pago)\b/.test(value))
    return "payment";
  return "other";
}

type Order = {
  number: number; status: string; fulfillment_mode: string;
  payment_status: string; created_at: string; total_cop: number;
};
type Zone = { name: string; fee_cop: number; eta_minutes: number };

export async function buildRestaurantOperationsContext(input: {
  companyId: string; phone: string; message: string;
}): Promise<string> {
  if (input.companyId !== COMPANY || !/^[0-9]{8,15}$/.test(input.phone)) {
    throw new Error("RESTAURANT_AI_TENANT_INVALID");
  }
  const intent = classifyRestaurantIntent(input.message);

  const orders = await supabaseRequest<Order[]>({
    table: "restaurant_ops_orders",
    query: "?company_id=eq." + COMPANY +
      "&customer_phone=eq." + encodeURIComponent(input.phone) +
      "&select=number,status,fulfillment_mode,payment_status,created_at,total_cop" +
      "&order=created_at.desc&limit=5"
  });
  const zones = intent === "delivery" ? await supabaseRequest<Zone[]>({
    table: "restaurant_ops_zones",
    query: "?company_id=eq." + COMPANY +
      "&active=eq.true&select=name,fee_cop,eta_minutes&order=priority.asc&limit=30"
  }) : [];

  const rules = [
    "CONTEXTO OPERATIVO RESTAURANTE (DATOS INTERNOS VERIFICADOS)",
    "Intención detectada: " + intent,
    "Solo el servidor confirma pedidos, pagos, disponibilidad y tiempos.",
    "NUNCA afirmes haber creado un pedido sin un ID real devuelto por la API.",
    "Para retiro en el local: no pedir dirección, no cobrar domicilio ni asignar repartidor.",
    "Para domicilio: solicitar dirección y comprobar zona activa antes de cotizar; sin zona verificada, derivar a un empleado.",
    "Al cotizar productos, el importe debe salir del catálogo oficial y la tarifa de la zona.",
    "No crear ni modificar pedidos desde respuestas de texto; el cliente debe confirmar el resumen completo.",
    "No afirmar pagos recibidos basándose únicamente en capturas de pantalla.",
    "Si existe reclamación, error grave, alergias o riesgo alimentario, priorizar asistencia humana.",
    "Si el cliente pregunta por un pedido, utilizar únicamente los estados listados abajo.",
    "Pedidos reales recientes: " + JSON.stringify(orders),
    "Zonas activas de referencia (sin geolocalización automática): " + JSON.stringify(zones),
  ];
  if (intent === "pickup") {
    rules.push("El cliente manifestó que PASARÁ A BUSCARLO. Confirmar horario de retiro; no pedir dirección.");
  }
  if (intent === "delivery") {
    rules.push("El cliente solicita DOMICILIO. Si la dirección o zona están incompletas, pedir aclaración antes de confirmar.");
  }
  if (intent === "ambiguous") {
    rules.push("La modalidad es ambigua: preguntar si retira en local o necesita domicilio.");
  }
  return rules.join("\n");
}
