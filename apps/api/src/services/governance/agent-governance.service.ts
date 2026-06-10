import { isSupabaseConfigured, supabaseRequest } from "../db/supabase-rest.client.js";

type GovernanceEvent = {
  agent_name: string;
  action: string;
  decision: "approved" | "blocked" | "review";
  risk_level?: "low" | "medium" | "high";
  reason?: string;
  metadata?: Record<string, unknown>;
};

const events: GovernanceEvent[] = [];

export async function registerGovernanceEvent(input: GovernanceEvent) {
  const event = {
    ...input,
    risk_level: input.risk_level ?? "low",
    metadata: input.metadata ?? {}
  };

  if (!isSupabaseConfigured()) {
    events.unshift(event);
    return event;
  }

  const rows = await supabaseRequest<GovernanceEvent[]>({
    table: "agent_governance_events",
    method: "POST",
    body: [event]
  });

  return rows[0];
}

export async function validateAgentReply(input: {
  phone: string;
  message: string;
  reply: string;
}) {
  const reply = input.reply.toLowerCase();

  if (reply.includes("no puedo") || reply.includes("no sé")) {
    await registerGovernanceEvent({
      agent_name: "sales-agent",
      action: "reply_validation",
      decision: "review",
      risk_level: "medium",
      reason: "Respuesta débil o evasiva detectada",
      metadata: input
    });

    return {
      approved: true,
      warning: "weak_reply"
    };
  }

  if (reply.length > 900) {
    await registerGovernanceEvent({
      agent_name: "sales-agent",
      action: "reply_validation",
      decision: "review",
      risk_level: "medium",
      reason: "Respuesta demasiado larga para WhatsApp",
      metadata: input
    });

    return {
      approved: true,
      warning: "long_reply"
    };
  }

  await registerGovernanceEvent({
    agent_name: "sales-agent",
    action: "reply_validation",
    decision: "approved",
    risk_level: "low",
    reason: "Respuesta aprobada",
    metadata: {
      phone: input.phone
    }
  });

  return {
    approved: true,
    warning: null
  };
}

export async function listGovernanceEvents() {
  if (!isSupabaseConfigured()) return events;

  return supabaseRequest<GovernanceEvent[]>({
    table: "agent_governance_events",
    query: "?select=*&order=created_at.desc&limit=200"
  });
}
