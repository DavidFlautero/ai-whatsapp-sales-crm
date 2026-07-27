import { isSupabaseConfigured, supabaseRequest } from "../db/supabase-rest.client.js";
import { listContacts } from "../crm/crm.repository.js";

type RecoveryTemplate = {
  id?: string;
  name: string;
  type: string;
  body: string;
  active?: boolean;
};

type RecoveryEvent = {
  contact_phone: string;
  template_id?: string;
  message: string;
  status?: string;
  result?: string;
  sent_at?: string;
};

const templates: RecoveryTemplate[] = [
  {
    id: "inactive_30",
    name: "Cliente dormido 30 días",
    type: "inactive_30",
    body: "Hola {nombre} 👋 ¿cómo estás? Entraron novedades mayoristas esta semana. ¿Querés que te pase catálogo actualizado?",
    active: true
  },
  {
    id: "vip_recovery",
    name: "Cliente antiguo VIP",
    type: "vip_recovery",
    body: "Hola {nombre}, llegaron modelos nuevos que se están moviendo muchísimo. ¿Querés que te mande opciones antes de que se agoten?",
    active: true
  }
];

const events: RecoveryEvent[] = [];

export async function listRecoveryTemplates() {
  if (!isSupabaseConfigured()) return templates;

  return supabaseRequest<RecoveryTemplate[]>({
    table: "recovery_templates",
    query: "?select=*&active=eq.true&order=created_at.asc"
  });
}

export async function listRecoveryCandidates() {
  const contacts = await listContacts();

  return contacts
    .map((contact: any) => {
      const lastSeen = contact.last_seen_at ? new Date(contact.last_seen_at) : null;
      const daysInactive = lastSeen
        ? Math.floor((Date.now() - lastSeen.getTime()) / 86400000)
        : 999;

      return {
        ...contact,
        daysInactive,
        recoveryReason:
          daysInactive >= 90 ? "Cliente antiguo inactivo" :
          daysInactive >= 30 ? "Cliente dormido" :
          "Lead reciente para seguimiento"
      };
    })
    .filter((contact: any) => contact.daysInactive >= 1)
    .sort((a: any, b: any) => b.daysInactive - a.daysInactive);
}

export async function createRecoveryEvent(input: RecoveryEvent) {
  const event = {
    ...input,
    status: input.status ?? "draft",
    result: input.result ?? "pending",
    created_at: new Date().toISOString()
  };

  if (!isSupabaseConfigured()) {
    events.unshift(event);
    return event;
  }

  const rows = await supabaseRequest<RecoveryEvent[]>({
    table: "recovery_events",
    method: "POST",
    body: [event]
  });

  return rows[0];
}

export async function listRecoveryEvents() {
  if (!isSupabaseConfigured()) return events;

  return supabaseRequest<RecoveryEvent[]>({
    table: "recovery_events",
    query: "?select=*&order=created_at.desc&limit=200"
  });
}
