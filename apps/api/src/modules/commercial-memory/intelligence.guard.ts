import type { Message } from "./types.js";
import type { AIObservation } from "./intelligence.types.js";

import {
  cleanLabel,
  confidence,
} from "./keys.js";

const roles = new Set([
  "customer","owner","supplier","organizer","unknown",
]);

const intents = new Set([
  "event_inquiry","owner_offer","supplier_offer","other",
]);

const moves = new Set([
  "question","quote_request","offer","counteroffer",
  "availability","acceptance_claim","payment_claim",
  "rejection","information","other",
]);

const prices = new Set([
  "owner_cost","supplier_cost","customer_price",
  "deposit","unknown",
]);

function validDate(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !/^20\d{2}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }

  const date = new Date(`${value}T12:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  ) ? value : null;
}

function mentionsAmount(
  text: string,
  amount: number,
): boolean {
  if (!Number.isFinite(amount) || amount < 0) {
    return false;
  }

  const values = text.match(
    /\b\d[\d.,]*\s*(?:€|euros?)(?=$|[\s,.;!?])/gi,
  ) || [];

  return values.some(value => {
    const numeric = value
      .replace(/(?:€|euros?)/gi, "")
      .trim();

    let normalized = numeric;

    if (numeric.includes(",") && numeric.includes(".")) {
      normalized =
        numeric.lastIndexOf(",") >
        numeric.lastIndexOf(".")
          ? numeric.replace(/\./g, "").replace(",", ".")
          : numeric.replace(/,/g, "");
    } else if (/^\d{1,3}\.\d{3}$/.test(numeric)) {
      normalized = numeric.replace(".", "");
    } else {
      normalized = numeric.replace(",", ".");
    }

    return Math.abs(
      Number(normalized) - amount,
    ) < 0.01;
  });
}

export function guardObservation(
  source: Message,
  raw: AIObservation,
): AIObservation | null {
  if (
    !raw ||
    !roles.has(raw.actor_role) ||
    !intents.has(raw.intent) ||
    !moves.has(raw.commercial_move) ||
    !prices.has(raw.price_role)
  ) {
    return null;
  }

  const body = source.body || "";

  const quote = cleanLabel(
    raw.evidence_quote,
    140,
  );

  if (
    !quote ||
    !body.includes(quote)
  ) {
    return null;
  }

  const date = validDate(raw.event_date);

  const hasExplicitDate = date &&
    (
      body.includes(date) ||
      /\b\d{1,2}[\/.-]\d{1,2}[\/.-]20\d{2}\b/
        .test(body)
    );

  const amount =
    typeof raw.amount_eur === "number" &&
    mentionsAmount(body, raw.amount_eur)
      ? raw.amount_eur
      : null;

  return {
    actor_role: raw.actor_role,
    intent: raw.intent,
    commercial_move: raw.commercial_move,
    event_date:
      hasExplicitDate ? date : null,
    event_type:
      cleanLabel(raw.event_type, 100),
    venue_mention:
      cleanLabel(raw.venue_mention, 100),
    attendees:
      Number.isInteger(raw.attendees) &&
      raw.attendees !== null &&
      raw.attendees >= 1 &&
      raw.attendees <= 2000
        ? raw.attendees
        : null,
    amount_eur: amount,
    price_role:
      amount !== null ? raw.price_role : "unknown",
    evidence_quote: quote,
    recommended_action:
      cleanLabel(raw.recommended_action, 160),
    confidence: confidence(raw.confidence),
  };
}
