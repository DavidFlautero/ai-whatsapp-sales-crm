import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveCompanyCapabilities,
} from "./company-agent-capabilities.service.js";

test("configura sector restaurante", () => {
  const result = resolveCompanyCapabilities(
    "restaurante-demo",
    { sector: "restaurant" },
  );

  assert.equal(result.sector, "restaurant");
  assert.equal(result.memory, true);
  assert.equal(result.orders, false);
  assert.deepEqual(result.adapters, []);
});

test("rechaza adaptadores desconocidos", () => {
  const result = resolveCompanyCapabilities(
    "empresa-demo",
    {
      sector: "retail",
      adapters: ["ninox", "desconocido", "ninox"],
    },
  );

  assert.deepEqual(result.adapters, ["ninox"]);
  assert.equal(result.orders, false);
});

test("no hereda herramientas de otra empresa", () => {
  const first = resolveCompanyCapabilities(
    "fulanitas",
    { sector: "retail", adapters: ["ninox"] },
  );

  const second = resolveCompanyCapabilities(
    "delibocados",
    { sector: "restaurant" },
  );

  assert.deepEqual(first.adapters, ["ninox"]);
  assert.deepEqual(second.adapters, []);
  assert.equal(second.orders, false);
});

test("restaurante nuevo tiene catálogo habilitado", () => {
  const result = resolveCompanyCapabilities(
    "restaurante-nuevo",
    { sector: "restaurant" },
  );

  assert.equal(result.catalog, true);
  assert.equal(result.orders, false);
  assert.deepEqual(result.adapters, []);
});

test("empresa retail no recibe catálogo gastronómico", () => {
  const result = resolveCompanyCapabilities(
    "tienda-nueva",
    { sector: "retail", adapters: ["ninox"] },
  );

  assert.equal(result.catalog, false);
  assert.equal(result.orders, false);
});
