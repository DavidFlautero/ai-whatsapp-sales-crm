import assert from "node:assert/strict";

import {
  normalizeWhapiMessageType,
} from "../src/services/whapi/whapi-message-normalizer.js";

import {
  getIngestKey,
} from "../src/modules/inbox/ingest-dedup.service.js";

function testTypes() {
  const cases: Array<[string, string]> = [
    ["text", "text"],
    ["image", "image"],
    ["video", "video"],
    ["audio", "audio"],
    ["voice", "audio"],
    ["ptt", "audio"],
    ["document", "document"],
    ["location", "location"],
    ["link_preview", "text"],
    ["sticker", "image"],
    ["gif", "video"],
    ["reaction", "interactive"],
    ["unknown_type", "unknown"],
  ];

  for (const [input, expected] of cases) {
    assert.equal(
      normalizeWhapiMessageType(input),
      expected,
      `Tipo incorrecto: ${input}`,
    );
  }

  assert.equal(
    normalizeWhapiMessageType(null),
    "unknown",
  );
}

function testDeduplication() {
  const input = {
    companyId: "eventos-mediterraneo",
    provider: "whapi",
    externalMessageId: "message-123",
  };

  const first = getIngestKey(input);
  const second = getIngestKey(input);

  assert.equal(first, second);

  assert.equal(first.length, 64);

  const otherCompany = getIngestKey({
    ...input,
    companyId: "otra-empresa",
  });

  assert.notEqual(
    first,
    otherCompany,
  );

  const otherMessage = getIngestKey({
    ...input,
    externalMessageId: "message-456",
  });

  assert.notEqual(
    first,
    otherMessage,
  );

  assert.throws(() => {
    getIngestKey({
      ...input,
      externalMessageId: "",
    });
  });
}

function main() {
  console.log("=== STAGE 1 TESTS ===");

  testTypes();

  console.log("OK: Normalizacion");

  testDeduplication();

  console.log("OK: Identidad e idempotencia");

  console.log(
    "OK: PRUEBAS UNITARIAS BASICAS"
  );
}

main();
