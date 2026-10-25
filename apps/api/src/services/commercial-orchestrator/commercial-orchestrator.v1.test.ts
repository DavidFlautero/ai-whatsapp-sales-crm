import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCommercialPlan,
  rankCommercialCatalog,
} from "./commercial-orchestrator.v1.js";

import type {
  EventIntakeDraft,
} from "../intake/event-intake.service.js";

function draft(
  overrides: Partial<EventIntakeDraft> = {},
): EventIntakeDraft {
  return {
    eventIntent: false,
    eventType: null,
    venueType: null,
    location: null,
    dateOptions: [],
    dateRange: null,
    attendees: null,
    sleepers: null,
    budgetMaxEur: null,
    amenities: [],
    ...overrides,
  };
}

function fact<T>(value: T) {
  return {
    value,
    evidence: "test",
    certainty: "explicit" as const,
  };
}

test("reconoce DJ y sonido sin chalet", () => {
  const result = buildCommercialPlan(
    "Necesito DJ y sonidista",
    draft(),
  );

  assert.deepEqual(
    result.services,
    ["dj", "sound"],
  );

  assert.equal(result.externalActionsAllowed, false);
});

test("reconoce varios servicios", () => {
  const result = buildCommercialPlan(
    "Busco chalet, DJ, sonido y luces",
    draft(),
  );

  assert.deepEqual(
    result.services,
    ["venue", "dj", "sound", "lighting"],
  );
});

test("no interpreta conversación casual como pedido", () => {
  const result = buildCommercialPlan(
    "El DJ estuvo ayer en el chalet",
    draft(),
  );

  assert.equal(
    result.readyForCatalogSearch,
    false,
  );
});

test("conserva los datos del extractor", () => {
  const result = buildCommercialPlan(
    "Necesito chalet en Valencia",
    draft({
      eventIntent: true,
      location: fact("Valencia"),
      attendees: fact(80),
      budgetMaxEur: fact(1500),
    }),
  );

  assert.equal(result.attendees, 80);
  assert.equal(result.budgetMaxEur, 1500);
});

test("descarta chalets con aforo insuficiente", () => {
  const plan = buildCommercialPlan(
    "Necesito chalet para 80 personas",
    draft({
      eventIntent: true,
      attendees: fact(80),
    }),
  );

  const results = rankCommercialCatalog(plan, [
    {
      id: "1",
      name: "Pequeño",
      kind: "venue",
      category: "venue",
      location: "Valencia",
      capacity: 40,
      status: "active",
    },
    {
      id: "2",
      name: "Grande",
      kind: "venue",
      category: "venue",
      location: "Valencia",
      capacity: 100,
      status: "active",
    },
  ]);

  assert.deepEqual(
    results.map(item => item.id),
    ["2"],
  );

  assert.equal(
    results[0].availability,
    "unverified",
  );
});

test("descarta proveedores bloqueados", () => {
  const plan = buildCommercialPlan(
    "Necesito sonido",
    draft(),
  );

  const results = rankCommercialCatalog(plan, [
    {
      id: "1",
      name: "Sonido A",
      kind: "provider",
      category: "sound_equipment",
      location: "Valencia",
      capacity: null,
      status: "active",
    },
    {
      id: "2",
      name: "Sonido B",
      kind: "provider",
      category: "sound_equipment",
      location: "Valencia",
      capacity: null,
      status: "blocked",
    },
  ]);

  assert.deepEqual(
    results.map(item => item.id),
    ["1"],
  );
});

test("reconoce categorías reales de servicios", () => {
  const plan = buildCommercialPlan(
    "Necesito DJ, sonido y sillas",
    draft(),
  );

  const results = rankCommercialCatalog(plan, [
    {
      id: "1",
      name: "Servicios múltiples",
      kind: "provider",
      category:
        "dj_services sound_equipment chair_rental",
      location: "Valencia",
      capacity: null,
      status: "active",
    },
  ]);

  assert.deepEqual(
    new Set(results.map(item => item.matchingService)),
    new Set(["dj", "sound", "furniture"]),
  );
});
