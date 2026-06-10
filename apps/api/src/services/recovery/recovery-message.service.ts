import { generateAgentResponse } from "../anthropic/anthropic.service.js";
import { buildCustomerMemoryContext } from "../memory/customer-memory.repository.js";

export async function generateRecoveryMessage(input: {
  phone: string;
  name?: string;
  reason?: string;
}) {
  const memory = await buildCustomerMemoryContext(input.phone);

  const prompt = `
Eres un vendedor experto en recontactación por WhatsApp para Fulanitas.

Objetivo:
Recuperar un cliente antiguo o lead frío con un mensaje humano, corto, natural y comercial.

Cliente:
- Nombre: ${input.name ?? "cliente"}
- Teléfono: ${input.phone}
- Motivo: ${input.reason ?? "cliente inactivo"}

Memoria comercial:
${memory}

Reglas:
- No sonar desesperado.
- No decir "soy una IA".
- Máximo 2 líneas.
- Usar tono cercano.
- Incluir una pregunta clara.
- Si hay producto de interés en memoria, úsalo.

Genera SOLO el mensaje de WhatsApp.
`;

  return generateAgentResponse(prompt);
}
