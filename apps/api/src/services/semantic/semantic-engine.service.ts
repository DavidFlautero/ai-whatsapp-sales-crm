import { isSupabaseConfigured, supabaseRequest } from "../db/supabase-rest.client.js";

type SemanticEvent = {
  contact_phone: string;
  event_type?: string;
  semantic_label?: string;
  semantic_value?: string;
  confidence?: number;
};

const semanticEvents: SemanticEvent[] = [];

export async function registerSemanticEvent(input: SemanticEvent) {
  const event = {
    ...input,
    confidence: input.confidence ?? 70
  };

  if (!isSupabaseConfigured()) {
    semanticEvents.unshift(event);
    return event;
  }

  const rows = await supabaseRequest<SemanticEvent[]>({
    table: "semantic_events",
    method: "POST",
    body: [event]
  });

  return rows[0];
}

export async function detectSemanticSignals(input: {
  phone: string;
  message: string;
}) {
  const msg = input.message.toLowerCase();

  const events: SemanticEvent[] = [];

  if (msg.includes("barato") || msg.includes("descuento")) {
    events.push({
      contact_phone: input.phone,
      event_type: "pricing_behavior",
      semantic_label: "price_sensitive",
      semantic_value: "discount_interest",
      confidence: 82
    });
  }

  if (msg.includes("urgente") || msg.includes("hoy")) {
    events.push({
      contact_phone: input.phone,
      event_type: "urgency",
      semantic_label: "high_intent",
      semantic_value: "urgent_purchase",
      confidence: 88
    });
  }

  if (msg.includes("mayorista")) {
    events.push({
      contact_phone: input.phone,
      event_type: "customer_type",
      semantic_label: "wholesale",
      semantic_value: "b2b",
      confidence: 90
    });
  }

  await Promise.all(events.map(registerSemanticEvent));

  return events;
}

export async function buildSemanticContext(phone: string) {
  if (!isSupabaseConfigured()) {
    return semanticEvents
      .filter((e) => e.contact_phone === phone)
      .slice(0, 10);
  }

  return supabaseRequest<SemanticEvent[]>({
    table: "semantic_events",
    query: `?contact_phone=eq.${encodeURIComponent(phone)}&select=*&order=created_at.desc&limit=20`
  });
}
