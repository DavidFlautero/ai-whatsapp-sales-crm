import test from "node:test";
import assert from "node:assert/strict";

import {
  makeDossierEvidence,
  safeExcerpt,
} from "./context-core-v3.mjs";

const msg = (id, body, direction = "inbound") => ({
  id,
  body,
  direction,
  occurred_at: "2026-10-14T10:00:00Z",
});

function values(messages, kind) {
  return makeDossierEvidence(messages)
    .evidence
    .filter((item) => item.kind === kind)
    .map((item) => item.value);
}

test("extrae invitados mencionados", () => {
  assert.deepEqual(
    values(
      [msg("1", "Quiero reservar para 50 personas")],
      "guest_count_mentioned",
    ),
    ["50"],
  );
});

test("extrae rango de invitados", () => {
  assert.deepEqual(
    values(
      [msg("2", "Es de 50 a 70 personas")],
      "guest_range_mentioned",
    ),
    ["50-70"],
  );
});

test("detecta fecha sin inventar año", () => {
  assert.deepEqual(
    values(
      [msg("3", "El evento es el 22 de mayo")],
      "day_month_mentioned",
    ),
    ["22 de mayo"],
  );
});

test("reconoce fechas alternativas", () => {
  assert.deepEqual(
    values(
      [msg("4", "Puede ser 7 o 14 de noviembre")],
      "alternative_days_mentioned",
    ),
    ["7 o 14 de noviembre"],
  );
});

test("extrae tipo de evento", () => {
  assert.deepEqual(
    values(
      [msg("5", "Fiesta de quinceañera")],
      "event_type",
    ),
    ["quinceanera"],
  );
});

test("extrae servicio solicitado", () => {
  assert.deepEqual(
    values(
      [msg("6", "Quiero un chalet con catering")],
      "requested_service",
    ),
    ["espacio", "catering"],
  );
});

test("distingue oferta comercial", () => {
  assert.equal(
    values(
      [msg("7", "Tengo un chalet para alquilar")],
      "commercial_offer",
    ).length,
    1,
  );
});

test("no clasifica salida como necesidad del cliente", () => {
  assert.equal(
    values(
      [msg("8", "Quiero un chalet", "outbound")],
      "commercial_request",
    ).length,
    0,
  );
});

test("respeta solicitud de no contacto", () => {
  assert.equal(
    values(
      [msg("9", "No me escribas más")],
      "opt_out",
    ).length,
    1,
  );
});

test("no inventa cantidad de invitados", () => {
  assert.equal(
    values(
      [msg("10", "Hay un chalet de 500 metros")],
      "guest_count_mentioned",
    ).length,
    0,
  );
});

test("elimina correos de extractos", () => {
  assert.equal(
    safeExcerpt("Escribe a prueba@ejemplo.com"),
    "Escribe a [correo]",
  );
});

test("marca evidencia como pendiente", () => {
  const result = makeDossierEvidence([
    msg("11", "Quiero una boda"),
  ]);

  assert.equal(result.review_required, true);

  assert.ok(
    result.evidence.every(
      (item) =>
        item.status === "candidate_not_verified",
    ),
  );
});
