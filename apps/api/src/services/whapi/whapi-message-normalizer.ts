export type CanonicalMessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "location"
  | "interactive"
  | "unknown";

const TYPES = new Set<CanonicalMessageType>([
  "text",
  "image",
  "audio",
  "video",
  "document",
  "location",
  "interactive",
  "unknown",
]);

const ALIASES: Record<string, CanonicalMessageType> = {
  chat: "text",
  extended_text: "text",
  link_preview: "text",
  voice: "audio",
  ptt: "audio",
  voice_message: "audio",
  gif: "video",
  sticker: "image",
  buttons_response: "interactive",
  button_reply: "interactive",
  list_response: "interactive",
  interactive_response: "interactive",
  poll_vote: "interactive",
  reaction: "interactive",
};

export function normalizeWhapiMessageType(
  raw: unknown,
): CanonicalMessageType {
  if (typeof raw !== "string") {
    return "unknown";
  }

  const value = raw.trim().toLowerCase();

  if (!value) {
    return "unknown";
  }

  const mapped = ALIASES[value];

  if (mapped) {
    return mapped;
  }

  if (TYPES.has(value as CanonicalMessageType)) {
    return value as CanonicalMessageType;
  }

  return "unknown";
}
