import { isSupabaseConfigured, supabaseRequest } from "../db/supabase-rest.client.js";
import { generateAgentResponse } from "../anthropic/anthropic.service.js";

type Campaign = {
  name: string;
  audience?: string;
  status?: string;
  total_targets?: number;
  total_sent?: number;
  total_replied?: number;
};

const campaigns: Campaign[] = [];

export async function createCampaign(input: {
  name: string;
  audience: string;
}) {
  const campaign: Campaign = {
    name: input.name,
    audience: input.audience,
    status: "draft",
    total_targets: 0,
    total_sent: 0,
    total_replied: 0
  };

  if (!isSupabaseConfigured()) {
    campaigns.unshift(campaign);
    return campaign;
  }

  const rows = await supabaseRequest<Campaign[]>({
    table: "campaign_events",
    method: "POST",
    body: [campaign]
  });

  return rows[0];
}

export async function generateCampaignMessage(input: {
  audience: string;
  objective: string;
}) {
  const prompt = `
Eres experto en campañas de WhatsApp para ventas.

Audiencia:
${input.audience}

Objetivo:
${input.objective}

Reglas:
- humano
- corto
- natural
- vendedor real
- no spam
- máximo 3 líneas

Genera SOLO el mensaje.
`;

  return generateAgentResponse(prompt);
}

export async function listCampaigns() {
  if (!isSupabaseConfigured()) {
    return campaigns;
  }

  return supabaseRequest<Campaign[]>({
    table: "campaign_events",
    query: "?select=*&order=created_at.desc"
  });
}
