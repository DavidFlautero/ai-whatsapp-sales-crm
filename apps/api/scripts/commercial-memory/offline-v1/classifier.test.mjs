import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyContact,
  normalizeText,
  fingerprint,
} from "./classifier.mjs";

function message(
  id,
  body,
  direction = "inbound",
) {
  return {
    id,
    body,
    direction,
    occurred_at:
      "2026-10-10T12:00:00.000Z",
  };
}

test("normaliza acentos", () => {
  assert.equal(
    normalizeText("Catering en VALÈNCIA"),
    "catering en valencia",
  );
});

test("identifica propietario explicito", () => {
  const result = classifyContact([
    message(
      "m1",
      "Tengo un chalet en Valencia con piscina y capacidad para 30 personas",
    ),
  ]);

  assert.equal(
    result.proposed_role,
    "owner",
  );

  assert.equal(
    result.proposed_capacities[0].value,
    30,
  );

  assert.equal(
    result.proposed_venue_cities[0].value,
    "valencia",
  );

  assert.equal(
    result.proposed_features[0].value,
    "piscina",
  );
});

test("identifica proveedor", () => {
  const result = classifyContact([
    message(
      "m2",
      "Soy fotógrafo de bodas y eventos",
    ),
  ]);

  assert.equal(
    result.proposed_role,
    "provider",
  );

  assert.equal(
    result.proposed_services[0].value,
    "fotografia",
  );
});

test("identifica cliente", () => {
  const result = classifyContact([
    message(
      "m3",
      "Busco un chalet para celebrar un cumpleaños",
    ),
  ]);

  assert.equal(
    result.proposed_role,
    "client",
  );
});

test("no inventa capacidad ofertada", () => {
  const result = classifyContact([
    message(
      "m4",
      "Busco un chalet para 80 personas",
    ),
  ]);

  assert.equal(
    result.proposed_capacities.length,
    0,
  );
});

test("no confirma piscina a partir de pregunta", () => {
  const result = classifyContact([
    message(
      "m5",
      "Tengo un chalet. ¿Tiene piscina?",
    ),
  ]);

  assert.equal(
    result.proposed_features.length,
    0,
  );
});

test("detecta roles contradictorios", () => {
  const result = classifyContact([
    message("m6", "Tengo un chalet"),
    message("m7", "Busco un salón"),
  ]);

  assert.equal(
    result.proposed_role,
    "review",
  );

  assert.equal(
    result.conflicting_roles.length,
    2,
  );
});

test("no clasifica como propietario por mensaje saliente", () => {
  const result = classifyContact([
    message(
      "m8",
      "Tengo un chalet",
      "outbound",
    ),
  ]);

  assert.equal(
    result.proposed_role,
    "unclassified",
  );
});

test("detecta solicitud de no contacto", () => {
  const result = classifyContact([
    message(
      "m9",
      "No me escribas más, por favor",
    ),
  ]);

  assert.equal(
    result.do_not_contact_candidate,
    true,
  );

  assert.equal(
    result.possible_pending_review,
    false,
  );
});

test("evidencia asociada al mensaje", () => {
  const result = classifyContact([
    message(
      "m10",
      "Soy DJ profesional",
    ),
  ]);

  assert.equal(
    result.role_evidence[0].message_id,
    "m10",
  );
});

test("identificador estable", () => {
  assert.equal(
    fingerprint("contacto-1"),
    fingerprint("contacto-1"),
  );

  assert.notEqual(
    fingerprint("contacto-1"),
    fingerprint("contacto-2"),
  );
});

test("no confunde respuesta humana con respuesta del cliente", () => {
  const result = classifyContact([
    message(
      "m11",
      "Busco un local",
      "inbound",
    ),
    message(
      "m12",
      "Tenemos locales disponibles",
      "outbound",
    ),
  ]);

  assert.equal(
    result.possible_pending_review,
    false,
  );
});

// POOL_REGRESSION_TESTS_V2

test("pregunta sobre piscina no confirma instalacion", () => {
  const result = classifyContact([
    message(
      "pool-question-1",
      "Tengo un chalet. ¿Tiene piscina?",
    ),
  ]);

  assert.equal(
    result.proposed_features.length,
    0,
  );
});

test("pregunta informal tampoco confirma piscina", () => {
  const result = classifyContact([
    message(
      "pool-question-2",
      "Tengo un chalet, tiene piscina?",
    ),
  ]);

  assert.equal(
    result.proposed_features.length,
    0,
  );
});

test("sin piscina no genera caracteristica positiva", () => {
  const result = classifyContact([
    message(
      "pool-negative-1",
      "Tengo un chalet sin piscina",
    ),
  ]);

  assert.equal(
    result.proposed_features.length,
    0,
  );
});

test("no tiene piscina no genera caracteristica", () => {
  const result = classifyContact([
    message(
      "pool-negative-2",
      "Tengo un chalet, pero no tiene piscina",
    ),
  ]);

  assert.equal(
    result.proposed_features.length,
    0,
  );
});

test("afirmacion explicita mantiene instalacion", () => {
  const result = classifyContact([
    message(
      "pool-positive-1",
      "Tengo un chalet. Tiene piscina y jardin.",
    ),
  ]);

  assert.deepEqual(
    result.proposed_features.map(
      (item) => item.value,
    ),
    ["piscina"],
  );
});

test("cliente buscando piscina no es propietario", () => {
  const result = classifyContact([
    message(
      "pool-client-1",
      "Busco un chalet con piscina",
    ),
  ]);

  assert.equal(
    result.proposed_role,
    "client",
  );

  assert.equal(
    result.proposed_features.length,
    0,
  );
});

test("negacion posterior no confirma piscina", () => {
  const result = classifyContact([
    message(
      "pool-negative-3",
      "Tengo un chalet. No tiene piscina.",
    ),
  ]);

  assert.equal(
    result.proposed_features.length,
    0,
  );
});

test("pregunta independiente no anula afirmacion previa", () => {
  const result = classifyContact([
    message(
      "pool-positive-2",
      "Tengo un chalet. Tiene piscina. ¿Tiene jacuzzi?",
    ),
  ]);

  assert.equal(
    result.proposed_features[0]?.value,
    "piscina",
  );
});
