import assert from "node:assert/strict";

import type {
  Request,
  Response,
} from "express";

import {
  getAdminOverview,
} from "../../controllers/admin/data.controller.js";

type OverviewPayload = {
  ok: boolean;
  degraded: boolean;
  degradedModules: unknown[];

  contacts: unknown[];
  conversations: unknown[];
  messages: unknown[];
  prompts: unknown[];

  catalogProducts: unknown[];
  events: unknown[];
};

const headers:
  Record<string, string> = {};

let payload:
  OverviewPayload
  | null = null;

const request = {
  get(
    name: string,
  ) {
    if (
      name.toLowerCase()
      === "x-request-id"
    ) {
      return "overview-selftest-0001";
    }

    return undefined;
  },
} as unknown as Request;

const response = {
  setHeader(
    name: string,
    value:
      string
      | number
      | readonly string[],
  ) {
    headers[
      name.toLowerCase()
    ] = String(value);

    return this;
  },

  json(
    body: OverviewPayload,
  ) {
    payload = body;

    return this;
  },
} as unknown as Response;

await getAdminOverview(
  request,
  response,
);

if (payload === null) {
  throw new Error(
    "El controlador no produjo el payload del overview.",
  );
}

const result: OverviewPayload =
  payload;

assert.equal(
  result.ok,
  true,
);

assert.equal(
  result.degraded,
  true,
);

assert.ok(
  Array.isArray(
    result.degradedModules,
  ),
);

assert.ok(
  result.degradedModules.length > 0,
);

assert.ok(
  Array.isArray(
    result.contacts,
  ),
);

assert.ok(
  Array.isArray(
    result.conversations,
  ),
);

assert.ok(
  Array.isArray(
    result.messages,
  ),
);

assert.ok(
  Array.isArray(
    result.catalogProducts,
  ),
);

assert.equal(
  headers["x-data-mode"],
  "degraded",
);

console.log(
  "✅ Overview respondió correctamente.",
);

console.log(
  `✅ Módulos degradados: ${
    result.degradedModules.length
  }`,
);

console.log(
  "✅ Colecciones fallback verificadas.",
);

console.log(
  "✅ ADMIN OVERVIEW DEGRADED SELFTEST PASSED",
);
