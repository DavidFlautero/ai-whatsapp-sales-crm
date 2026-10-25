type MessageContent = {
  message_type?: string | null;
  body?: string | null;
};

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | null {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as JsonObject;
}

function path(
  root: unknown,
  parts: string[],
): unknown {
  let current: unknown = root;

  for (const part of parts) {
    const record = object(current);

    if (!record) return null;

    current = record[part];
  }

  return current;
}

function meaningful(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const text = value.trim();

  if (!text) return null;

  if (/^https?:\/\/\S+$/i.test(text)) {
    return null;
  }

  if (/^[a-f0-9-]{32,}$/i.test(text)) {
    return null;
  }

  if (/^[A-Za-z0-9+/=]{100,}$/.test(text)) {
    return null;
  }

  return text.slice(0, 6000);
}

const TEXT_PATHS = [
  ["text", "body"],
  ["message", "text", "body"],
  ["message", "text"],
  ["message", "body"],
  ["data", "message", "text", "body"],
  ["data", "message", "text"],
  ["data", "text", "body"],
  ["data", "text"],
  ["text"],
  ["caption"],
  ["body"],
  ["content"],
];

export function extractCommercialText(
  message: MessageContent,
): string | null {
  const body = message.body?.trim();

  if (!body) return null;

  const jsonLike =
    body.startsWith("{") ||
    body.startsWith("[");

  if (!jsonLike) {
    if (message.message_type === "text") {
      return meaningful(body);
    }

    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(body);
  } catch {
    // Un contenido estructurado ilegible no
    // puede tratarse como texto conversacional.
    return null;
  }

  for (const parts of TEXT_PATHS) {
    const candidate = meaningful(
      path(parsed, parts),
    );

    if (candidate) return candidate;
  }

  return null;
}

export function classifyCommercialContent(
  message: MessageContent,
) {
  const text = extractCommercialText(message);

  if (text) {
    return {
      category: "extractable_text",
      analyzable: true,
    };
  }

  const body = message.body?.trim() || "";

  if (!body) {
    return {
      category: "empty",
      analyzable: false,
    };
  }

  if (
    body.startsWith("{") ||
    body.startsWith("[")
  ) {
    try {
      JSON.parse(body);

      return {
        category: "structured_metadata",
        analyzable: false,
      };
    } catch {
      // No es JSON válido.
    }
  }

  if (
    message.message_type === "image" ||
    message.message_type === "audio" ||
    message.message_type === "video" ||
    message.message_type === "document"
  ) {
    return {
      category: "media_requires_processing",
      analyzable: false,
    };
  }

  return {
    category: "other_uninterpreted",
    analyzable: false,
  };
}
