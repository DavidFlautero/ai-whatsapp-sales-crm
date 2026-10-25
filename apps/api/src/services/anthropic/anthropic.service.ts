import { env } from "../../config/env.js";

export async function generateAgentResponse(prompt: string, strict = false) {
  if (!process.env.ANTHROPIC_API_KEY) {
    if (strict) throw new Error("ANTHROPIC_API_KEY_MISSING");
    return "Hola 👋 Te ayudo. ¿Buscás catálogo, stock o querés armar un pedido?";
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL,
        max_tokens: 360,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[CLAUDE ERROR]", { status: response.status, type: data?.error?.type, message: data?.error?.message });
      if (strict) throw new Error(`ANTHROPIC_HTTP_${response.status}`);
      return "Perfecto 👌 Contame qué modelo, talle o color estás buscando y te ayudo con opciones.";
    }

    const text = data.content?.find((item: any) => item.type === "text")?.text;

    const result = String(text ?? "").trim();
    if (!result && strict) throw new Error("ANTHROPIC_EMPTY_RESPONSE");
    return result || "Perfecto 👌 ¿Qué estás buscando?";
  } catch (error) {
    console.error("[CLAUDE REQUEST ERROR]", error);
    if (strict) throw error;
    return "Perfecto 👌 Te ayudo. ¿Qué producto estás buscando?";
  }
}
