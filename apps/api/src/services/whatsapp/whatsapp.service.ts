import { postWhatsappMessage } from "./whatsapp.client.js";

export async function sendWhatsappText(input: { to: string; text: string }) {
  console.log("[WHATSAPP SEND TEXT]", input);

  return postWhatsappMessage({
    messaging_product: "whatsapp",
    to: input.to,
    type: "text",
    text: {
      preview_url: false,
      body: input.text
    }
  });
}
