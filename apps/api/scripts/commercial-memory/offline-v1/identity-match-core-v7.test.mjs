import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizePhone,
  phoneToken,
  proposeIdentityLinks,
} from "./identity-match-core-v7.mjs";

const secret = Buffer.alloc(32, 7);

function anchor(
  id = null,
  phones = [],
) {
  return {
    fingerprint: "a".repeat(20),
    contact_id: id,
    phone_tokens: phones,
  };
}

function record(
  table,
  id,
  phones = [],
) {
  return {
    table,
    id,
    phone_tokens: phones,
  };
}

test("normaliza formatos sin inventar pais", () => {
  assert.equal(
    normalizePhone("+34 612 345 678"),
    "34612345678",
  );
});

test("no equipara prefijos distintos", () => {
  assert.notEqual(
    phoneToken(secret, "empresa", "+34612345678"),
    phoneToken(secret, "empresa", "0034612345678"),
  );
});

test("rechaza telefonos incompletos", () => {
  assert.equal(
    normalizePhone("12345"),
    null,
  );
});

test("identifica coincidencia de ID", () => {
  const result = proposeIdentityLinks(
    anchor("abc"),
    [record("contacts", "abc")],
  );

  assert.equal(result.proposed_tables, 1);

  assert.deepEqual(
    result.proposals[0].candidates[0].reasons,
    ["same_internal_id"],
  );
});

test("identifica coincidencia telefonica", () => {
  const token = phoneToken(
    secret,
    "empresa",
    "+34612345678",
  );

  const result = proposeIdentityLinks(
    anchor(null, [token]),
    [record("customers", "id1", [token])],
  );

  assert.equal(result.proposed_tables, 1);

  assert.deepEqual(
    result.proposals[0].candidates[0].reasons,
    ["same_phone_token"],
  );
});

test("detecta dos fichas en la misma tabla", () => {
  const token = "x";

  const result = proposeIdentityLinks(
    anchor(null, [token]),
    [
      record("contacts", "1", [token]),
      record("contacts", "2", [token]),
    ],
  );

  assert.equal(result.has_ambiguity, true);

  assert.equal(
    result.proposals[0].status,
    "ambiguous_requires_review",
  );
});

test("no confunde tablas diferentes", () => {
  const token = "x";

  const result = proposeIdentityLinks(
    anchor(null, [token]),
    [
      record("contacts", "1", [token]),
      record("customers", "2", [token]),
    ],
  );

  assert.equal(result.proposed_tables, 2);
  assert.equal(result.has_ambiguity, false);
});

test("sin evidencia no propone vinculacion", () => {
  const result = proposeIdentityLinks(
    anchor(),
    [record("customers", "1")],
  );

  assert.equal(result.proposed_tables, 0);
});

test("nunca aprueba automaticamente", () => {
  const result = proposeIdentityLinks(
    anchor("abc"),
    [record("contacts", "abc")],
  );

  assert.equal(result.automatically_linked, false);
  assert.equal(result.human_review_required, true);

  assert.equal(
    result.proposals[0].automatically_linked,
    false,
  );
});

test("deduplica coincidencias del mismo ID", () => {
  const result = proposeIdentityLinks(
    anchor("abc"),
    [
      record("contacts", "abc"),
      record("contacts", "abc"),
    ],
  );

  assert.equal(
    result.proposals[0].candidate_count,
    1,
  );
});
