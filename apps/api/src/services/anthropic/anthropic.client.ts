import { env } from "../../config/env.js";

export async function callClaude(prompt: string): Promise<string> {
  if (!env.ANTHROPIC_API_KEY) {
    return "Claude API no está configurado todavía.";
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
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
    console.error("[anthropic] error", data);
    return "Ahora mismo estoy teniendo una dificultad técnica. Te responde un asesor en breve.";
  }

  const first = data.content?.[0]?.text;

  return typeof first === "string"
    ? first
    : "No pude generar una respuesta en este momento.";
}
