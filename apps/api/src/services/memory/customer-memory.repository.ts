import { isSupabaseConfigured, supabaseRequest } from "../db/supabase-rest.client.js";

type CustomerMemory = {
  contact_phone: string;
  key: string;
  value: string;
  confidence?: number;
  source?: string;
};

const memoryStore = new Map<string, CustomerMemory[]>();

export async function upsertCustomerMemory(input: CustomerMemory) {
  const item = {
    ...input,
    confidence: input.confidence ?? 70,
    source: input.source ?? "ai",
    updated_at: new Date().toISOString()
  };

  if (!isSupabaseConfigured()) {
    const current = memoryStore.get(input.contact_phone) ?? [];
    const filtered = current.filter((m) => m.key !== input.key);
    memoryStore.set(input.contact_phone, [...filtered, item]);
    return item;
  }

  const rows = await supabaseRequest<CustomerMemory[]>({
    table: "customer_memories",
    method: "POST",
    query: "?on_conflict=contact_phone,key",
    prefer: "resolution=merge-duplicates,return=representation",
    body: [item]
  });

  return rows[0];
}

export async function listCustomerMemories(phone?: string) {
  if (!isSupabaseConfigured()) {
    const all = Array.from(memoryStore.values()).flat();
    return phone ? all.filter((m) => m.contact_phone === phone) : all;
  }

  const query = phone
    ? `?contact_phone=eq.${encodeURIComponent(phone)}&select=*&order=updated_at.desc`
    : "?select=*&order=updated_at.desc&limit=300";

  return supabaseRequest<CustomerMemory[]>({
    table: "customer_memories",
    query
  });
}

export async function buildCustomerMemoryContext(phone: string) {
  const memories = await listCustomerMemories(phone);

  if (!memories.length) {
    return "Cliente sin memoria comercial previa.";
  }

  return memories
    .slice(0, 12)
    .map((m: any) => `- ${m.key}: ${m.value} (${m.confidence ?? 70}% confianza)`)
    .join("\n");
}
