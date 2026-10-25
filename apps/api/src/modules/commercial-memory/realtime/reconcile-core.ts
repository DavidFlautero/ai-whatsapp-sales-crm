import {
  createHash,
} from "node:crypto";

export type MessageDirection =
  | "inbound"
  | "outbound"
  | "unknown";

export type CanonicalMessage = {
  companyId: string;

  sourceMessageId: string;

  idempotencyKey: string;

  direction: MessageDirection;

  createdAt: string;

  conversationId: string | null;

  contactId: string | null;

  requiresReview: boolean;
};

export type NormalizeResult =
  | {
      status: "accepted";
      message: CanonicalMessage;
    }
  | {
      status: "quarantined";
      reason: string;
    };

type RawMessage = Record<
  string,
  unknown
>;

function asRecord(
  value: unknown,
): RawMessage | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as RawMessage;
}

function nonEmpty(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized || null;
}

function firstString(
  raw: RawMessage,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = nonEmpty(raw[key]);

    if (value) return value;
  }

  return null;
}

function normalizeDirection(
  value: unknown,
): MessageDirection {
  const direction = nonEmpty(value)
    ?.toLowerCase();

  if (
    direction === "inbound" ||
    direction === "incoming" ||
    direction === "received"
  ) {
    return "inbound";
  }

  if (
    direction === "outbound" ||
    direction === "outgoing" ||
    direction === "sent"
  ) {
    return "outbound";
  }

  return "unknown";
}

function normalizeTimestamp(
  value: unknown,
): string | null {
  let date: Date;

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    const milliseconds =
      value < 100000000000
        ? value * 1000
        : value;

    date = new Date(milliseconds);
  } else if (
    typeof value === "string" &&
    value.trim()
  ) {
    if (/^\d{10,13}$/.test(value.trim())) {
      const numeric = Number(value);

      const milliseconds =
        numeric < 100000000000
          ? numeric * 1000
          : numeric;

      date = new Date(milliseconds);
    } else {
      date = new Date(value);
    }
  } else {
    return null;
  }

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function firstTimestamp(
  raw: RawMessage,
): string | null {
  const keys = [
    "created_at",
    "timestamp",
    "received_at",
    "sent_at",
    "message_timestamp",
  ];

  for (const key of keys) {
    const normalized = normalizeTimestamp(
      raw[key],
    );

    if (normalized) return normalized;
  }

  return null;
}

function makeKey(
  companyId: string,
  sourceMessageId: string,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        "commercial-message-v1",
        companyId,
        sourceMessageId,
      ]),
    )
    .digest("hex");
}

export function normalizeCommercialMessage(
  input: unknown,
  expectedCompanyId: string,
): NormalizeResult {
  const raw = asRecord(input);

  if (!raw) {
    return {
      status: "quarantined",
      reason: "INVALID_MESSAGE_PAYLOAD",
    };
  }

  const configuredCompany =
    nonEmpty(expectedCompanyId);

  if (!configuredCompany) {
    return {
      status: "quarantined",
      reason: "INVALID_EXPECTED_COMPANY",
    };
  }

  const rowCompany = firstString(
    raw,
    [
      "company_id",
      "companyId",
    ],
  );

  if (
    rowCompany &&
    rowCompany !== configuredCompany
  ) {
    return {
      status: "quarantined",
      reason: "CROSS_COMPANY_MESSAGE",
    };
  }

  const sourceMessageId = firstString(
    raw,
    [
      "id",
      "message_id",
      "provider_message_id",
      "wa_message_id",
    ],
  );

  if (!sourceMessageId) {
    return {
      status: "quarantined",
      reason: "MISSING_MESSAGE_IDENTIFIER",
    };
  }

  const createdAt =
    firstTimestamp(raw);

  if (!createdAt) {
    return {
      status: "quarantined",
      reason: "INVALID_MESSAGE_TIMESTAMP",
    };
  }

  const direction =
    normalizeDirection(
      raw.direction,
    );

  const conversationId = firstString(
    raw,
    [
      "conversation_id",
      "conversationId",
    ],
  );

  const contactId = firstString(
    raw,
    [
      "contact_id",
      "contactId",
      "crm_contact_id",
    ],
  );

  return {
    status: "accepted",

    message: {
      companyId: configuredCompany,
      sourceMessageId,

      idempotencyKey: makeKey(
        configuredCompany,
        sourceMessageId,
      ),

      direction,
      createdAt,

      conversationId,
      contactId,

      requiresReview:
        direction === "unknown" ||
        (
          !conversationId &&
          !contactId
        ),
    },
  };
}

export function deduplicateMessages(
  messages: CanonicalMessage[],
): CanonicalMessage[] {
  const seen = new Set<string>();

  const result: CanonicalMessage[] = [];

  for (const message of messages) {
    if (
      seen.has(
        message.idempotencyKey,
      )
    ) {
      continue;
    }

    seen.add(
      message.idempotencyKey,
    );

    result.push(message);
  }

  return result.sort(
    (a, b) =>
      a.createdAt.localeCompare(
        b.createdAt,
      ) ||
      a.idempotencyKey.localeCompare(
        b.idempotencyKey,
      ),
  );
}
