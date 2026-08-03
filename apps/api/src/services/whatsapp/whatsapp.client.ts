import {
  env,
} from "../../config/env.js";

export type WhatsappApiResponse = {
  messaging_product?: string;

  contacts?: Array<{
    input?: string;
    wa_id?: string;
  }>;

  messages?: Array<{
    id?: string;
    message_status?: string;
  }>;
};

export async function postWhatsappMessage(
  payload: unknown,
): Promise<WhatsappApiResponse> {
  if (
    !env.WHATSAPP_TOKEN
    || !env.WHATSAPP_PHONE_NUMBER_ID
  ) {
    throw new Error(
      "WHATSAPP_NOT_CONFIGURED",
    );
  }

  const graphVersion =
    env.WHATSAPP_GRAPH_VERSION
      .replace(
        /^v?/,
        "v",
      );

  const url =
    `https://graph.facebook.com/${graphVersion}`
    + `/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  console.log(
    "[WHATSAPP API REQUEST]",
    {
      graphVersion,
      phoneNumberId:
        env.WHATSAPP_PHONE_NUMBER_ID,
    },
  );

  const response =
    await fetch(
      url,
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${env.WHATSAPP_TOKEN}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            payload,
          ),
      },
    );

  const text =
    await response.text();

  let data:
    unknown = null;

  if (text) {
    try {
      data =
        JSON.parse(text);
    } catch {
      data =
        text;
    }
  }

  if (!response.ok) {
    console.error(
      "[WHATSAPP API ERROR]",
      {
        status:
          response.status,

        data,
      },
    );

    throw new Error(
      `WHATSAPP_API_FAILED_${response.status}`,
    );
  }

  console.log(
    "[WHATSAPP API OK]",
    data,
  );

  return data as WhatsappApiResponse;
}
