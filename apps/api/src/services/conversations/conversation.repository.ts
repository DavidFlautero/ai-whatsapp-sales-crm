import { isSupabaseConfigured, supabaseRequest } from "../db/supabase-rest.client.js";
import { upsertContact } from "../crm/crm.repository.js";

type Conversation = {
  id?: string;
  contact_phone: string;
  status?: string;
  last_message?: string;
  last_message_at?: string;
};

type Message = {
  id?: string;
  conversation_id?: string;
  contact_phone: string;
  direction: "inbound" | "outbound";
  channel?: string;
  body: string;
  raw_payload?: unknown;
  created_at?: string;
};

const memoryConversations = new Map<string, Conversation>();
const memoryMessages: Message[] = [];

export async function getOrCreateConversation(phone: string, lastMessage?: string) {
  await upsertContact({
    phone,
    last_message: lastMessage
  });

  if (!isSupabaseConfigured()) {
    const existing = memoryConversations.get(phone);

    if (existing) {
      existing.last_message = lastMessage ?? existing.last_message;
      existing.last_message_at = new Date().toISOString();
      return existing;
    }

    const created = {
      id: crypto.randomUUID(),
      contact_phone: phone,
      status: "open",
      last_message: lastMessage,
      last_message_at: new Date().toISOString()
    };

    memoryConversations.set(phone, created);
    return created;
  }

  const existing = await supabaseRequest<Conversation[]>({
    table: "conversations",
    query: `?contact_phone=eq.${encodeURIComponent(phone)}&select=*&limit=1`
  });

  if (existing[0]) {
    await supabaseRequest<Conversation[]>({
      table: "conversations",
      method: "PATCH",
      query: `?id=eq.${existing[0].id}`,
      body: {
        last_message: lastMessage,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    });

    return {
      ...existing[0],
      last_message: lastMessage
    };
  }

  const rows = await supabaseRequest<Conversation[]>({
    table: "conversations",
    method: "POST",
    body: [{
      contact_phone: phone,
      status: "open",
      last_message: lastMessage,
      last_message_at: new Date().toISOString()
    }]
  });

  return rows[0];
}

export async function saveMessage(input: Message) {
  const conversation = await getOrCreateConversation(input.contact_phone, input.body);

  const message: Message = {
    ...input,
    conversation_id: conversation.id,
    channel: input.channel ?? "whatsapp",
    created_at: new Date().toISOString()
  };

  if (!isSupabaseConfigured()) {
    memoryMessages.unshift(message);
    return message;
  }

  const rows = await supabaseRequest<Message[]>({
    table: "messages",
    method: "POST",
    body: [message]
  });

  return rows[0];
}

export async function listConversations() {
  if (!isSupabaseConfigured()) {
    return Array.from(memoryConversations.values()).sort((a, b) =>
      String(b.last_message_at).localeCompare(String(a.last_message_at))
    );
  }

  return supabaseRequest<Conversation[]>({
    table: "conversations",
    query: "?select=*&order=last_message_at.desc"
  });
}

export async function listMessages(phone?: string) {
  if (!isSupabaseConfigured()) {
    return phone
      ? memoryMessages.filter((message) => message.contact_phone === phone)
      : memoryMessages;
  }

  const query = phone
    ? `?contact_phone=eq.${encodeURIComponent(phone)}&select=*&order=created_at.desc`
    : "?select=*&order=created_at.desc&limit=200";

  return supabaseRequest<Message[]>({
    table: "messages",
    query
  });
}
