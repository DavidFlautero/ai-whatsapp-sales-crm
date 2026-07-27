import { isSupabaseConfigured, supabaseRequest } from "../db/supabase-rest.client.js";

type Contact = {
  phone: string;
  name?: string;
  company?: string;
  status?: string;
  temperature?: string;
  ai_score?: number;
  total_sales?: number;
  last_message?: string;
  last_seen_at?: string;
  metadata?: Record<string, unknown>;
};

const memoryContacts = new Map<string, Contact>();

export async function upsertContact(input: Contact) {
  const contact: Contact = {
    ...input,
    last_seen_at: new Date().toISOString()
  };

  if (!isSupabaseConfigured()) {
    memoryContacts.set(input.phone, {
      ...(memoryContacts.get(input.phone) ?? {}),
      ...contact
    });

    return memoryContacts.get(input.phone);
  }

  const rows = await supabaseRequest<Contact[]>({
    table: "crm_contacts",
    method: "POST",
    query: "?on_conflict=phone",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [contact]
  });

  return rows[0];
}

export async function listContacts() {
  if (!isSupabaseConfigured()) {
    return Array.from(memoryContacts.values());
  }

  return supabaseRequest<Contact[]>({
    table: "crm_contacts",
    query: "?select=*&order=last_seen_at.desc"
  });
}
