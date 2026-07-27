import { upsertCustomerMemory } from "./customer-memory.repository.js";

export async function extractAndStoreMemory(input: {
  phone: string;
  message: string;
}) {
  const msg = input.message.toLowerCase();

  const memories: Array<{ key: string; value: string; confidence: number }> = [];

  if (msg.includes("pantal")) {
    memories.push({ key: "producto_interes", value: "pantalones", confidence: 82 });
  }

  if (msg.includes("jean")) {
    memories.push({ key: "producto_interes", value: "jeans", confidence: 82 });
  }

  if (msg.includes("negro") || msg.includes("negra")) {
    memories.push({ key: "color_preferido", value: "negro", confidence: 78 });
  }

  if (msg.includes("mayorista") || msg.includes("por mayor")) {
    memories.push({ key: "tipo_cliente", value: "mayorista", confidence: 86 });
  }

  if (msg.includes("precio") || msg.includes("cuánto") || msg.includes("cuanto")) {
    memories.push({ key: "objecion_actual", value: "precio", confidence: 70 });
  }

  await Promise.all(
    memories.map((memory) =>
      upsertCustomerMemory({
        contact_phone: input.phone,
        key: memory.key,
        value: memory.value,
        confidence: memory.confidence,
        source: "message_analysis"
      })
    )
  );

  return memories;
}
