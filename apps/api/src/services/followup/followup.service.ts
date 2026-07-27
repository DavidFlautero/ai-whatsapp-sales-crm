import { isSupabaseConfigured, supabaseRequest } from "../db/supabase-rest.client.js";
import { generateAgentResponse } from "../anthropic/anthropic.service.js";
import { buildCustomerMemoryContext } from "../memory/customer-memory.repository.js";

type Followup = {
  contact_phone: string;
  status?: string;
  reason?: string;
  scheduled_for?: string;
  generated_message?: string;
  sent_message?: string;
  ai_priority?: number;
  result?: string;
};

const followups: Followup[] = [];

export async function createSmartFollowup(input: {
  phone: string;
  reason: string;
}) {
  const memory = await buildCustomerMemoryContext(input.phone);

  const prompt = `
Eres un vendedor experto en seguimiento comercial por WhatsApp.

Objetivo:
Generar followup extremadamente humano y natural.

Cliente:
${input.phone}

Motivo:
${input.reason}

Memoria:
${memory}

Reglas:
- corto
- humano
- natural
- no robótico
- no insistente
- máximo 2 líneas
- terminar con pregunta útil

Genera SOLO el mensaje.
`;

  const message = await generateAgentResponse(prompt);

  const followup: Followup = {
    contact_phone: input.phone,
    status: "pending",
    reason: input.reason,
    generated_message: message,
    ai_priority: 75,
    scheduled_for: new Date(Date.now() + 86400000).toISOString(),
    result: "waiting"
  };

  if (!isSupabaseConfigured()) {
    followups.unshift(followup);
    return followup;
  }

  const rows = await supabaseRequest<Followup[]>({
    table: "followups",
    method: "POST",
    body: [followup]
  });

  return rows[0];
}

export async function listFollowups() {
  if (!isSupabaseConfigured()) {
    return followups;
  }

  return supabaseRequest<Followup[]>({
    table: "followups",
    query: "?select=*&order=created_at.desc"
  });
}
