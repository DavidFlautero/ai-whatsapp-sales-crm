import { env } from "../../config/env.js";

export async function postWhatsappMessage(payload: unknown) {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    console.log("[WHATSAPP NOT CONFIGURED]", {
      hasToken: Boolean(env.WHATSAPP_TOKEN),
      hasPhoneNumberId: Boolean(env.WHATSAPP_PHONE_NUMBER_ID),
      payload
    });
    return;
  }

  const url = `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  console.log("[WHATSAPP API REQUEST]", {
    url,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("[WHATSAPP API ERROR]", data);
    return data;
  }

  console.log("[WHATSAPP API OK]", data);

  return data;
}
