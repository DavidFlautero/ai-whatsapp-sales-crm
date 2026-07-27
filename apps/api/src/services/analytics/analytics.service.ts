import { listContacts } from "../crm/crm.repository.js";
import { listConversations, listMessages } from "../conversations/conversation.repository.js";

export async function getAnalyticsOverview() {
  const [contacts, conversations, messages] = await Promise.all([
    listContacts(),
    listConversations(),
    listMessages()
  ]);

  const inbound = messages.filter((message: any) => message.direction === "inbound").length;
  const outbound = messages.filter((message: any) => message.direction === "outbound").length;

  return {
    contacts: contacts.length,
    conversations: conversations.length,
    messages: messages.length,
    inbound,
    outbound,
    conversion: contacts.length ? Math.min(32, Math.round((outbound / Math.max(inbound, 1)) * 18)) : 0,
    activeLeads: conversations.length,
    estimatedPipelineUsd: contacts.length * 140
  };
}
