import { salesAgentReply } from "../services/agent/sales-agent.service.js";
import { sendWhatsappText } from "../services/whatsapp/whatsapp.service.js";

type WhatsappWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from: string;
          text?: { body?: string };
          type?: string;
        }>;
      };
    }>;
  }>;
};

export async function handleWhatsappIncoming(payload: WhatsappWebhookPayload) {
  const messages =
    payload.entry?.flatMap((entry) =>
      entry.changes?.flatMap((change) => change.value?.messages ?? []) ?? []
    ) ?? [];

  for (const message of messages) {
    const from = message.from;
    const text = message.text?.body?.trim();

    if (!from || !text) continue;

    const reply = await salesAgentReply({
      phone: from,
      message: text
    });

    await sendWhatsappText({
      to: from,
      text: reply
    });
  }
}
