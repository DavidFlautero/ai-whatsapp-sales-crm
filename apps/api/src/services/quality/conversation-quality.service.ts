import { isSupabaseConfigured, supabaseRequest } from "../db/supabase-rest.client.js";

type QualityScore = {
  contact_phone: string;
  score: number;
  clarity: number;
  persuasion: number;
  empathy: number;
  commercial_progress: number;
  issue_detected?: string;
  recommendation?: string;
};

const scores: QualityScore[] = [];

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

export async function evaluateConversationTurn(input: {
  phone: string;
  customerMessage: string;
  agentReply: string;
}) {
  const customer = input.customerMessage.toLowerCase();
  const reply = input.agentReply.toLowerCase();

  let clarity = 70;
  let persuasion = 65;
  let empathy = 65;
  let commercial = 60;
  let issue = "";
  let recommendation = "Continuar conversación con pregunta concreta.";

  if (reply.includes("?")) commercial += 10;
  if (reply.includes("catálogo") || reply.includes("catalogo")) commercial += 8;
  if (reply.includes("stock")) commercial += 8;
  if (reply.includes("perfecto") || reply.includes("claro")) empathy += 8;
  if (customer.includes("precio") && !reply.includes("precio")) {
    issue = "No respondió directamente intención de precio";
    recommendation = "Responder precio, rango o pedir modelo/cantidad para cotizar.";
    persuasion -= 10;
  }
  if (customer.includes("pantal") && reply.includes("qué producto")) {
    issue = "Pregunta repetitiva: el cliente ya dijo producto.";
    recommendation = "Avanzar con tipo, talle, color o cantidad.";
    clarity -= 20;
    commercial -= 20;
  }

  const score = clamp(Math.round((clarity + persuasion + empathy + commercial) / 4));

  const result: QualityScore = {
    contact_phone: input.phone,
    score,
    clarity: clamp(clarity),
    persuasion: clamp(persuasion),
    empathy: clamp(empathy),
    commercial_progress: clamp(commercial),
    issue_detected: issue || undefined,
    recommendation
  };

  if (!isSupabaseConfigured()) {
    scores.unshift(result);
    return result;
  }

  const rows = await supabaseRequest<QualityScore[]>({
    table: "conversation_quality_scores",
    method: "POST",
    body: [result]
  });

  return rows[0];
}

export async function listQualityScores() {
  if (!isSupabaseConfigured()) return scores;

  return supabaseRequest<QualityScore[]>({
    table: "conversation_quality_scores",
    query: "?select=*&order=created_at.desc&limit=200"
  });
}
