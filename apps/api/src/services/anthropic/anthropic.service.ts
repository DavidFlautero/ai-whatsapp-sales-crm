export async function generateAgentResponse(prompt: string) {
  if (!process.env.ANTHROPIC_API_KEY) {
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
        model: "claude-3-5-haiku-latest",
        max_tokens: 360,
        temperature: 0.82,
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
      console.error("[CLAUDE ERROR]", data);
      return "Perfecto 👌 Contame qué modelo, talle o color estás buscando y te ayudo con opciones.";
    }

    const text = data.content?.find((item: any) => item.type === "text")?.text;

    return String(text ?? "").trim() || "Perfecto 👌 ¿Qué estás buscando?";
  } catch (error) {
    console.error("[CLAUDE REQUEST ERROR]", error);
    return "Perfecto 👌 Te ayudo. ¿Qué producto estás buscando?";
  }
}
