import type {
  Message,
  Signal,
  CommercialFact,
} from "./types.js";

import {
  extractRules,
} from "./rules-extractor.js";

export function selectSignal(
  message: Message,
  ai: Signal | null,
): Signal {
  const rule = extractRules(message);

  if (!ai || ai.confidence < 0.65) {
    return rule;
  }

  if (
    rule.intent === "owner_offer" &&
    ai.intent === "event_inquiry"
  ) {
    return rule;
  }

  if (
    rule.intent === "supplier_offer" &&
    ai.intent === "event_inquiry"
  ) {
    return rule;
  }

  if (
    message.direction === "outbound" &&
    ai.intent === "event_inquiry"
  ) {
    return rule;
  }

  if (
    ai.intent === "event_inquiry" &&
    ai.confidence < 0.78
  ) {
    return {
      ...ai,
      intent: "other",
    };
  }

  return ai;
}

export function extractFacts(
  signal: Signal,
): CommercialFact[] {
  const facts: CommercialFact[] = [];

  function append(
    factType: string,
    value: unknown,
    score: number,
  ) {
    if (
      value !== null &&
      value !== undefined &&
      value !== ""
    ) {
      facts.push({
        factType,
        value: { value },
        confidence: score,
      });
    }
  }

  append(
    "event_intent",
    signal.intent === "event_inquiry"
      ? true
      : null,
    signal.confidence,
  );

  append(
    "event_date_proposed",
    signal.eventDate,
    signal.confidence,
  );

  append(
    "event_type_proposed",
    signal.eventType,
    signal.confidence,
  );

  append(
    "venue_mention_proposed",
    signal.venueMention,
    signal.confidence,
  );

  append(
    "attendee_count_proposed",
    signal.attendees,
    signal.confidence,
  );

  append(
    "amount_mentioned_eur_unclassified",
    signal.quotedAmountEur,
    signal.confidence,
  );

  if (signal.potentialAcceptance) {
    append(
      "possible_acceptance",
      true,
      signal.confidence,
    );
  }

  return facts;
}
