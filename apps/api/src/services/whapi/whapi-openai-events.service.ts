type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    type?: string;
    code?: string;
  };
};

export async function generateOpenAiEventsResponse(
  prompt: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("EVENTS_OPENAI_KEY_MISSING");
  }

  const model =
    process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: prompt,
        max_output_tokens: 800,
        store: false,
      }),
      signal: AbortSignal.timeout(35000),
    },
  );

  const data = await response.json() as OpenAIResponse;

  if (!response.ok) {
    console.error("[WHAPI OPENAI HTTP ERROR]", {
      status: response.status,
      code: data.error?.code ?? data.error?.type ?? "unknown",
    });

    throw new Error(`EVENTS_OPENAI_HTTP_${response.status}`);
  }

  const text = (
    data.output_text ||
    data.output
      ?.flatMap(item => item.content ?? [])
      .filter(item => item.type === "output_text")
      .map(item => item.text ?? "")
      .join("\n") ||
    ""
  ).trim();

  if (!text) {
    throw new Error("EVENTS_OPENAI_EMPTY_RESPONSE");
  }

  return text;
}
