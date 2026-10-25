import test from "node:test";
import assert from "node:assert/strict";
import { analyzeContactSignals } from "./role-signals.mjs";

function msg(id, body, direction = "inbound") {
  return { id, body, direction };
}

test("propietario ofrece chalet", () => {
  const result = analyzeContactSignals([
    msg("1", "Tenemos un chalet para eventos"),
  ]);
  assert.equal(result.proposed_role, "owner");
});

test("proveedor ofrece catering", () => {
  const result = analyzeContactSignals([
    msg("2", "Ofrecemos servicio de catering"),
  ]);
  assert.equal(result.proposed_role, "provider");
});

test("cliente busca salon", () => {
  const result = analyzeContactSignals([
    msg("3", "Necesito un salon para una boda"),
  ]);
  assert.equal(result.proposed_role, "client");
});

test("consulta de presupuesto es señal, no rol confirmado", () => {
  const result = analyzeContactSignals([
    msg("4", "Me pasas un presupuesto?"),
  ]);
  assert.equal(result.commercial_inquiry_count, 1);
  assert.equal(result.proposed_role, "unclassified");
});

test("no atribuye al cliente los mensajes salientes", () => {
  const result = analyzeContactSignals([
    msg("5", "Tenemos un chalet para eventos", "outbound"),
  ]);
  assert.equal(result.proposed_role, "unclassified");
});

test("detecta varios roles para revision", () => {
  const result = analyzeContactSignals([
    msg("6", "Tengo un chalet para eventos"),
    msg("7", "Necesito un salon para mi fiesta"),
  ]);
  assert.equal(result.proposed_role, "review_conflict");
});

test("detecta solicitud de no contacto", () => {
  const result = analyzeContactSignals([
    msg("8", "No quiero recibir mas mensajes"),
  ]);
  assert.equal(result.opt_out_candidate, true);
});

test("no aplica clasificaciones automaticamente", () => {
  const result = analyzeContactSignals([
    msg("9", "Soy DJ profesional"),
  ]);
  assert.equal(result.automatically_applied, false);
  assert.equal(result.requires_human_review, true);
});
