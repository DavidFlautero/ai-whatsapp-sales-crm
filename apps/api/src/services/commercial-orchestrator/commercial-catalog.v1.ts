import {
  supabaseRequest,
} from "../db/supabase-rest.client.js";

import {
  planIncomingCommercialMessage,
  rankCommercialCatalog,
  type CatalogEntry,
  type CommercialPlan,
} from "./commercial-orchestrator.v1.js";

type Row = Record<string, unknown>;

function str(row: Row, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim())
      return value.trim().slice(0, 200);
  }
  return null;
}

function num(row: Row, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];

    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0
    ) return value;

    if (
      typeof value === "string" &&
      /^\d+$/.test(value.trim())
    ) return Number(value);
  }
  return null;
}

function labels(value: unknown): string[] {
  if (typeof value === "string") return [value];

  if (Array.isArray(value))
    return value.filter(
      (entry): entry is string =>
        typeof entry === "string"
    );

  return [];
}

function venue(row: Row): CatalogEntry | null {
  const id = str(row, ["id"]);
  const name = str(row, [
    "name", "title", "venue_name",
  ]);

  if (!id || !name) return null;

  return {
    id,
    name,
    kind: "venue",
    category: "venue",
    location: str(row, [
      "city", "municipality", "location", "area",
    ]),
    capacity: num(row, [
      "max_capacity", "capacity", "max_guests",
      "capacity_max", "max_attendees",
    ]),
    status: str(row, ["status", "state"]),
  };
}

export async function searchCommercialCatalog(
  companyId: string,
  plan: CommercialPlan,
) {
  if (!/^[a-zA-Z0-9_-]{3,160}$/.test(companyId))
    throw new Error("INVALID_COMPANY_ID");

  if (!plan.readyForCatalogSearch)
    return {
      matches: [],
      sources: ["skipped"],
    };

  const query =
    `?company_id=eq.${encodeURIComponent(companyId)}` +
    "&select=*&limit=300";

  const venueNeeded = plan.services.includes("venue");
  const providerNeeded = plan.services.some(
    service => service !== "venue"
  );

  const tables = [
    ["crm_venues", venueNeeded],
    ["crm_providers", providerNeeded],
    ["crm_provider_profiles", providerNeeded],
    ["crm_provider_services", providerNeeded],
    ["crm_service_categories", providerNeeded],
  ] as const;

  const results = await Promise.allSettled(
    tables.map(([table, enabled]) =>
      enabled
        ? supabaseRequest<Row[]>({ table, query })
        : Promise.resolve([] as Row[])
    )
  );

  const sources = tables.map(([table, enabled], i) => ({
    table,
    status: !enabled
      ? "skipped"
      : results[i].status === "fulfilled"
        ? "ok"
        : "unavailable",
  }));

  const rows = (index: number): Row[] =>
    results[index].status === "fulfilled"
      ? (results[index] as PromiseFulfilledResult<Row[]>).value
      : [];

  const entries: CatalogEntry[] = [];

  for (const row of rows(0)) {
    const item = venue(row);
    if (item) entries.push(item);
  }

  const providerLabels = new Map<string, string[]>();

  function add(id: string | null, values: unknown[]) {
    if (!id) return;

    const current = providerLabels.get(id) ?? [];

    providerLabels.set(
      id,
      [...current, ...values.flatMap(labels)]
    );
  }

  for (const profile of rows(2)) {
    add(str(profile, ["provider_id"]), [
      profile.provider_type,
      profile.service_categories,
      profile.specialties,
    ]);
  }

  const categories = new Map<string, string>();

  for (const category of rows(4)) {
    const id = str(category, ["id"]);
    const name = str(category, [
      "name", "slug", "code", "label",
    ]);

    if (id && name) categories.set(id, name);
  }

  for (const service of rows(3)) {
    if (service.active === false) continue;

    const categoryId = str(service, ["category_id"]);

    add(str(service, ["provider_id"]), [
      categoryId ? categories.get(categoryId) : null,
      service.name,
      service.service_name,
    ]);
  }

  for (const row of rows(1)) {
    const id = str(row, ["id"]);
    const name = str(row, [
      "name", "business_name", "display_name",
    ]);

    if (!id || !name) continue;

    const category = [
      ...(providerLabels.get(id) ?? []),
      ...labels(row.category),
      ...labels(row.service_type),
      ...labels(row.specialty),
    ].join(" ");

    entries.push({
      id,
      name,
      kind: "provider",
      category,
      location: str(row, [
        "city", "province", "service_area",
      ]),
      capacity: null,
      status: str(row, ["status", "state"]),
    });
  }

  return {
    matches: rankCommercialCatalog(plan, entries),
    sources,
  };
}

export async function previewCommercialSearch(
  companyId: string,
  message: string,
) {
  const plan = planIncomingCommercialMessage(message);

  const catalog = await searchCommercialCatalog(
    companyId,
    plan,
  );

  return {
    plan,
    catalog,
    sendsWhatsApp: false as const,
    createsReservations: false as const,
  };
}
