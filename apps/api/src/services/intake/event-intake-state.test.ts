import assert from "node:assert/strict";

import {
  extractEventIntake,
} from "./event-intake.service.js";

import {
  mergeEventIntake,
  type IntakeState,
} from "./event-intake-state.service.js";

let state: IntakeState | null = null;

function getState(): IntakeState | null {
  return state;
}


function processMessage(
  id: string,
  text: string,
) {
  const draft = extractEventIntake(text);

  const result = mergeEventIntake(
    state,
    draft,
    id,
  );

  state = result.state;

  return result;
}

// No iniciar solicitudes por saludos.

const greeting = processMessage(
  "m0",
  "Hola, buenas tardes",
);

assert.equal(greeting.applied, false);
assert.equal(state, null);

// Crear solicitud inicial.

const first = processMessage(
  "m1",
  "Necesito un chalet en Alicante para 30 personas",
);

assert.equal(first.applied, true);
assert.equal(getState()?.location?.value, "Alicante");
assert.equal(getState()?.attendees?.value, 30);

// Actualización de invitados.

processMessage(
  "m2",
  "En realidad somos 35 personas",
);

assert.equal(getState()?.attendees?.value, 35);

// Añadir presupuesto.

processMessage(
  "m3",
  "Presupuesto máximo 600 euros",
);

assert.equal(getState()?.budgetMaxEur?.value, 600);

// Añadir fecha sin borrar otros datos.

processMessage(
  "m4",
  "Para el 14 de noviembre",
);

assert.equal(
  getState()?.dateOptions[0]?.value.day,
  14,
);

assert.equal(
  getState()?.dateOptions[0]?.value.month,
  11,
);

// Repetición del mismo mensaje.

const beforeVersion = getState()?.version;

const duplicate = processMessage(
  "m4",
  "Para el 14 de noviembre",
);

assert.equal(duplicate.applied, false);
assert.equal(getState()?.version, beforeVersion);

// El estado conserva la evidencia.

assert.equal(
  getState()?.attendees?.messageId,
  "m2",
);

assert.equal(
  getState()?.budgetMaxEur?.messageId,
  "m3",
);

assert.equal(
  getState()?.processedMessageIds.length,
  4,
);

console.log(
  "OK: CONSOLIDACION COMERCIAL VALIDADA",
);

console.log(JSON.stringify({
  location: getState()?.location?.value,
  attendees: getState()?.attendees?.value,
  budget: getState()?.budgetMaxEur?.value,
  dates: getState()?.dateOptions.map(
    item => item.value,
  ),
  version: getState()?.version,
}, null, 2));
