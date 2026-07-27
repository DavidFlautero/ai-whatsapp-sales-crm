import { isSupabaseConfigured, supabaseRequest } from "../db/supabase-rest.client.js";

type LearningEvent = {
  type: string;
  contact_phone?: string;
  input?: string;
  output?: string;
  score?: number;
  metadata?: Record<string, unknown>;
};

const events: LearningEvent[] = [];

export async function registerLearningEvent(input: LearningEvent) {
  const event = {
    ...input,
    score: input.score ?? 50,
    metadata: input.metadata ?? {}
  };

  if (!isSupabaseConfigured()) {
    events.unshift(event);
    return event;
  }

  const rows = await supabaseRequest<LearningEvent[]>({
    table: "learning_events",
    method: "POST",
    body: [event]
  });

  return rows[0];
}

export async function getLearningInsights() {
  if (!isSupabaseConfigured()) {
    return {
      topIntent: "mayorista",
      bestTone: "humano-natural",
      hottestHour: "20:00",
      conversionSignals: [
        "pregunta precio",
        "pregunta stock",
        "audio largo"
      ]
    };
  }

  const data = await supabaseRequest<any[]>({
    table: "learning_events",
    query: "?select=*"
  });

  const topSignals = data
    .filter((e) => e.score >= 70)
    .slice(0, 5)
    .map((e) => e.type);

  return {
    totalEvents: data.length,
    topSignals,
    adaptiveStatus: "learning"
  };
}
