import type {
  Message,
  Signal,
} from "./types.js";

import { cleanLabel } from "./keys.js";

const inquiry =
  /(busco|necesito|quiero|quisiera|me interesa|quer[ií]a|presupuesto|ten[eé]is|ten[eé]s|disponibilidad|cu[aá]nto sale|cu[aá]nto cuesta|para celebrar)/i;

const eventWords =
  /(chalet|cumplea[nñ]os|boda|comuni[oó]n|fiesta|evento|finca|sal[oó]n|local|celebraci[oó]n|despedida)/i;

const ownerWords =
  /(mi chalet|mi finca|mi local|mi sal[oó]n|nuestro chalet|os lo alquilo|te lo alquilo|lo tengo disponible)/i;

const supplierWords =
  /(ofrezco catering|soy dj|servicio de limpieza|alquilo equipo de sonido|soy fot[oó]grafo)/i;

const acceptance =
  /(quedamos as[ií]|lo confirmamos|confirmo la reserva|se[nñ]al enviada|ya transfer[ií]|reserva confirmada|he pagado|queda reservado|trato hecho)/i;

export function extractRules(
  message: Message,
): Signal {
  const text = message.message_type === "text"
    ? (message.body || "").slice(0, 6000)
    : "";

  let intent: Signal["intent"] =
    "noncommercial";

  let role: Signal["role"] =
    "unknown";

  let score = 0.25;

  if (
    message.direction === "inbound" &&
    inquiry.test(text) &&
    eventWords.test(text)
  ) {
    intent = "event_inquiry";
    role = "customer";
    score = 0.81;
  } else if (ownerWords.test(text)) {
    intent = "owner_offer";
    role = "owner";
    score = 0.79;
  } else if (supplierWords.test(text)) {
    intent = "supplier_offer";
    role = "supplier";
    score = 0.79;
  } else if (eventWords.test(text)) {
    intent = "other";
    score = 0.45;
  }

  const iso =
    /\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/
      .exec(text);

  const slash =
    /\b(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\/(20\d{2})\b/
      .exec(text);

  const candidate = iso
    ? `${iso[1]}-${iso[2]}-${iso[3]}`
    : slash
      ? `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`
      : null;

  const date = candidate
    ? new Date(`${candidate}T12:00:00Z`)
    : null;

  const eventDate =
    date &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === candidate
      ? candidate
      : null;

  const guests =
    /\b(\d{1,3})\s*(?:personas|invitados|adultos|asistentes)\b/i
      .exec(text);

  const euros =
    /(?:€\s*(\d{1,5}(?:[.,]\d{1,2})?)|(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:€|euros?))/i
      .exec(text);

  const eventTypeMatch =
    /(cumplea[nñ]os|boda|comuni[oó]n|despedida|fiesta|evento corporativo)/i
      .exec(text);

  const venueMatch =
    /(?:chalet|finca|sal[oó]n|local)\s+(?:de\s+|el\s+|la\s+)?([A-ZÁÉÍÓÚÑa-záéíóúñ0-9][\wÁÉÍÓÚÑáéíóúñ .\-]{1,48})/i
      .exec(text);

  return {
    intent,
    role,
    eventDate,
    eventType:
      cleanLabel(eventTypeMatch?.[1]),
    venueMention:
      cleanLabel(venueMatch?.[1], 60),
    attendees:
      guests
        ? Math.min(999, Number(guests[1]))
        : null,
    quotedAmountEur:
      euros
        ? Number(
            (euros[1] || euros[2])
              .replace(",", "."),
          )
        : null,
    potentialAcceptance:
      acceptance.test(text),
    confidence: score,
    evidenceQuote:
      cleanLabel(text.slice(0, 140), 140),
  };
}
