import { isSupabaseConfigured, supabaseRequest } from "../db/supabase-rest.client.js";

type PredictiveScore = {
  contact_phone: string;
  purchase_probability?: number;
  estimated_value?: number;
  next_purchase_window?: string;
  churn_risk?: string;
  semantic_intent?: string;
  semantic_summary?: string;
};

const scores = new Map<string, PredictiveScore>();

export async function generatePredictiveProfile(input: {
  phone: string;
  message: string;
}) {
  const msg = input.message.toLowerCase();

  let probability = 45;
  let value = 120;

  if (msg.includes("precio")) probability += 10;
  if (msg.includes("stock")) probability += 15;
  if (msg.includes("mayorista")) {
    probability += 22;
    value += 400;
  }

  if (msg.includes("urgente")) probability += 15;

  const profile: PredictiveScore = {
    contact_phone: input.phone,
    purchase_probability: Math.min(100, probability),
    estimated_value: value,
    next_purchase_window: probability >= 70 ? "24h" : "7d",
    churn_risk: probability >= 70 ? "low" : "medium",
    semantic_intent:
      probability >= 80 ? "ready_to_buy" :
      probability >= 60 ? "warm_interest" :
      "exploring",
    semantic_summary:
      probability >= 80
        ? "Cliente con alta intención de compra"
        : "Cliente evaluando opciones"
  };

  if (!isSupabaseConfigured()) {
    scores.set(input.phone, profile);
    return profile;
  }

  const rows = await supabaseRequest<PredictiveScore[]>({
    table: "predictive_scores",
    method: "POST",
    query: "?on_conflict=contact_phone",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [{
      ...profile,
      updated_at: new Date().toISOString()
    }]
  });

  return rows[0];
}

export async function listPredictiveProfiles() {
  if (!isSupabaseConfigured()) {
    return Array.from(scores.values());
  }

  return supabaseRequest<PredictiveScore[]>({
    table: "predictive_scores",
    query: "?select=*&order=purchase_probability.desc"
  });
}
