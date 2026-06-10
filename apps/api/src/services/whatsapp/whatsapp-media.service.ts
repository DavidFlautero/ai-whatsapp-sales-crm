import { env } from "../../config/env.js";

export async function getWhatsappMediaUrl(mediaId: string) {
  const response = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`
    }
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("[WHATSAPP MEDIA URL ERROR]", data);
    throw new Error("Could not get WhatsApp media URL");
  }

  return data.url as string;
}

export async function downloadWhatsappMedia(mediaUrl: string) {
  const response = await fetch(mediaUrl, {
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`
    }
  });

  if (!response.ok) {
    throw new Error("Could not download WhatsApp media");
  }

  const arrayBuffer = await response.arrayBuffer();

  return Buffer.from(arrayBuffer);
}
