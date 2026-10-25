import assert from "node:assert/strict";

import {
  prepareIncomingEventCapture,
} from "./event-intake-capture.service.js";

const base = {
  companyId: "eventos-mediterraneo",
  phone: "+34 635 10 51 45",
  sourceMessageId: "wamid.test001",

  text:
    "Necesito un chalet en Alicante " +
    "para 30 personas el 14 de noviembre.",
};

const first =
  prepareIncomingEventCapture(base);

assert.equal(
  first.p_company_id,
  "eventos-mediterraneo",
);

assert.equal(
  first.p_whatsapp,
  "34635105145",
);

assert.equal(
  first.p_message_id,
  "wamid.test001",
);

assert.equal(
  first.p_draft.eventIntent,
  true,
);

assert.equal(
  first.p_draft.location?.value,
  "Alicante",
);

assert.equal(
  first.p_draft.attendees?.value,
  30,
);

assert.equal(
  first.p_draft.dateOptions[0]
    ?.value.day,
  14,
);

// Mensaje posterior del mismo cliente.
// El extractor puede procesarlo sin
// exigir que repita el tipo de evento.

const second =
  prepareIncomingEventCapture({
    ...base,
    sourceMessageId: "wamid.test002",
    text: "Somos 35 personas",
  });

assert.equal(
  second.p_draft.attendees?.value,
  35,
);

// El saludo no debe inventar un evento.

const greeting =
  prepareIncomingEventCapture({
    ...base,
    sourceMessageId: "wamid.test003",
    text: "Hola, buenas",
  });

assert.equal(
  greeting.p_draft.eventIntent,
  false,
);

// Validaciones de entrada.

assert.throws(
  () =>
    prepareIncomingEventCapture({
      ...base,
      phone: "numero-invalido",
    }),
  /INVALID_INTAKE_PHONE/,
);

assert.throws(
  () =>
    prepareIncomingEventCapture({
      ...base,
      sourceMessageId: "",
    }),
  /INVALID_INTAKE_MESSAGE_ID/,
);

assert.throws(
  () =>
    prepareIncomingEventCapture({
      ...base,
      text: " ",
    }),
  /EMPTY_INTAKE_MESSAGE/,
);

console.log(
  "OK: ADAPTADOR DE CAPTACION VALIDADO",
);

console.log({
  company: first.p_company_id,
  eventDetected: first.p_draft.eventIntent,
  attendees: first.p_draft.attendees?.value,
  location: first.p_draft.location?.value,
  messageId: first.p_message_id,
});

console.log(
  "No se realizaron operaciones de base de datos.",
);
