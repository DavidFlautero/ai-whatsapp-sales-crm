import { isSupabaseConfigured, supabaseRequest } from "../db/supabase-rest.client.js";

type Prompt = {
  type: string;
  title: string;
  prompt: string;
  active?: boolean;
};

const defaultPrompts: Prompt[] = [
  {
    type: "sales",
    title: "Sales Agent",
    prompt: "Eres un vendedor humano, cálido y directo. Vendes por WhatsApp con naturalidad. Detectas intención de compra y avanzas la conversación hacia catálogo, stock o pedido.",
    active: true
  },
  {
    type: "followup",
    title: "Followup Agent",
    prompt: "Recontacta clientes con tono humano, corto y sin presión. Usa historial, producto de interés y una llamada a la acción clara.",
    active: true
  },
  {
    type: "recovery",
    title: "Recovery Agent",
    prompt: "Recupera clientes inactivos con novedades relevantes, tono cercano y propuesta concreta.",
    active: true
  }
];

const memoryPrompts = new Map(defaultPrompts.map((prompt) => [prompt.type, prompt]));

export async function listPrompts() {
  if (!isSupabaseConfigured()) return Array.from(memoryPrompts.values());

  const rows = await supabaseRequest<Prompt[]>({
    table: "ai_prompts",
    query: "?select=*&order=type.asc"
  });

  return rows.length ? rows : defaultPrompts;
}

export async function getPrompt(type: string) {
  const prompts = await listPrompts();
  return prompts.find((prompt) => prompt.type === type) ?? defaultPrompts[0];
}

export async function upsertPrompt(input: Prompt) {
  if (!isSupabaseConfigured()) {
    memoryPrompts.set(input.type, input);
    return input;
  }

  const rows = await supabaseRequest<Prompt[]>({
    table: "ai_prompts",
    method: "POST",
    query: "?on_conflict=type",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [{
      ...input,
      updated_at: new Date().toISOString()
    }]
  });

  return rows[0];
}
