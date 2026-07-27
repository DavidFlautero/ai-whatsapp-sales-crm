import { isSupabaseConfigured, supabaseRequest } from "../db/supabase-rest.client.js";

type LeadScore = {
  contact_phone: string;
  score: number;
  temperature: "cold" | "warm" | "hot";
  buying_intent: string;
  urgency: string;
  reason: string;
};

const scoreStore = new Map<string, LeadScore>();

export function calculateLeadScore(message: string): Omit<LeadScore, "contact_phone"> {
  const msg = message.toLowerCase();

  let score = 45;
  const reasons: string[] = [];

  if (msg.includes("precio") || msg.includes("cuánto") || msg.includes("cuanto")) {
    score += 12;
    reasons.push("preguntó precio");
  }

  if (msg.includes("stock") || msg.includes("tenés") || msg.includes("tienes")) {
    score += 15;
    reasons.push("preguntó disponibilidad");
  }

  if (msg.includes("mayorista") || msg.includes("pedido") || msg.includes("comprar")) {
    score += 18;
    reasons.push("intención comercial directa");
  }

  if (msg.includes("hoy") || msg.includes("ahora") || msg.includes("urgente")) {
    score += 12;
    reasons.push("urgencia alta");
  }

  score = Math.max(0, Math.min(100, score));

  const temperature = score >= 75 ? "hot" : score >= 50 ? "warm" : "cold";

  return {
    score,
    temperature,
    buying_intent: score >= 75 ? "high" : score >= 50 ? "medium" : "low",
    urgency: msg.includes("hoy") || msg.includes("urgente") ? "high" : "normal",
    reason: reasons.length ? reasons.join(", ") : "interacción inicial"
  };
}

export async function upsertLeadScore(input: {
  phone: string;
  message: string;
}) {
  const score = calculateLeadScore(input.message);

  const row: LeadScore = {
    contact_phone: input.phone,
    ...score
  };

  if (!isSupabaseConfigured()) {
    scoreStore.set(input.phone, row);
    return row;
  }

  const rows = await supabaseRequest<LeadScore[]>({
    table: "lead_scores",
    method: "POST",
    query: "?on_conflict=contact_phone",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [{
      ...row,
      updated_at: new Date().toISOString()
    }]
  });

  return rows[0];
}

export async function listLeadScores() {
  if (!isSupabaseConfigured()) {
    return Array.from(scoreStore.values());
  }

  return supabaseRequest<LeadScore[]>({
    table: "lead_scores",
    query: "?select=*&order=score.desc"
  });
}
