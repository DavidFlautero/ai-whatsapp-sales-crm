import {
  strict as assert,
} from "node:assert";

import {
  extractEventIntake,
} from "./event-intake.service.js";

// Caso 1: Martina.
// Dos fechas alternativas y datos incompletos.

const martina = extractEventIntake(
  "Hola, me gustaría reservar un lugar por Valencia centro " +
  "para celebrar mis 18. La fecha sería el sábado " +
  "12 de diciembre o el 19 de diciembre.",
);

assert.equal(
  martina.eventIntent,
  true,
);

assert.equal(
  martina.eventType?.value,
  "cumpleaños",
);

assert.equal(
  martina.location?.value.toLowerCase(),
  "valencia centro",
);

assert.deepEqual(
  martina.dateOptions.map(
    item => [
      item.value.day,
      item.value.month,
    ],
  ),
  [
    [12, 12],
    [19, 12],
  ],
);

assert.equal(
  martina.dateOptions[0].value.year,
  null,
);

assert.equal(
  martina.attendees,
  null,
);

// Caso 2: Alicante.
// Chalet para 30 personas.

const alicante = extractEventIntake(
  "Necesito un chalet en Alicante para " +
  "30 personas el 14 de noviembre. " +
  "Es para un cumpleaños.",
);

assert.equal(
  alicante.eventIntent,
  true,
);

assert.equal(
  alicante.attendees?.value,
  30,
);

assert.equal(
  alicante.location?.value,
  "Alicante",
);

assert.equal(
  alicante.dateOptions[0].value.day,
  14,
);

// Caso 3: estancia de varias noches.
// Diferenciar asistentes y huéspedes.

const nayara = extractEventIntake(
  "Buscamos casa para 9 personas " +
  "del 1 al 3 de enero, " +
  "duermen 6 y presupuesto de 500 euros.",
);

assert.equal(
  nayara.attendees?.value,
  9,
);

assert.equal(
  nayara.sleepers?.value,
  6,
);

assert.equal(
  nayara.budgetMaxEur?.value,
  500,
);

assert.equal(
  nayara.dateRange?.value.start.day,
  1,
);

assert.equal(
  nayara.dateRange?.value.end.day,
  3,
);

// Caso 4: saludo sin solicitud.

const greeting = extractEventIntake(
  "Hola, ¿cómo estás?",
);

assert.equal(
  greeting.eventIntent,
  false,
);

assert.equal(
  greeting.attendees,
  null,
);

// Caso 5: precio ofrecido.
// No convertirlo en presupuesto del cliente.

const quotation = extractEventIntake(
  "Te puedo ofrecer este chalet por 750 €.",
);

assert.equal(
  quotation.budgetMaxEur,
  null,
);

console.log(
  "CAPTACION: 5 CASOS SUPERADOS",
);
