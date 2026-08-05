import { env } from "../../config/env.js";

export async function getWhatsappMediaUrl(
  mediaId: string,
): Promise<string> {
  const graphVersion =
    env.WHATSAPP_GRAPH_VERSION.replace(/^v?/, "v");

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${mediaId}`,
    {
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      },
    },
  );

  const data = await response.json() as {
    url?: string;
    error?: unknown;
  };

  if (!response.ok || !data.url) {
    console.error("[WHATSAPP MEDIA URL ERROR]", data);
    throw new Error("Could not get WhatsApp media URL");
  }

  return data.url;
}

export async function downloadWhatsappMedia(
  mediaUrl: string,
): Promise<Buffer> {
  const response = await fetch(mediaUrl, {
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Could not download WhatsApp media: ${response.status}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();

  return Buffer.from(arrayBuffer);
}
