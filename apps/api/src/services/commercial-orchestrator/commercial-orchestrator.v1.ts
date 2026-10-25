import {
  extractEventIntake,
  type EventIntakeDraft,
} from "../intake/event-intake.service.js";

export type ServiceKind =
  | "venue" | "dj" | "sound" | "lighting"
  | "decoration" | "catering" | "security"
  | "staff" | "transport" | "photography"
  | "video" | "cleaning" | "furniture"
  | "technician";

export type CommercialPlan = {
  version: "commercial-v1";
  intent: "event_request" | "not_an_event_request";
  services: ServiceKind[];
  eventType: string | null;
  location: string | null;
  dateOptions: EventIntakeDraft["dateOptions"];
  dateRange: EventIntakeDraft["dateRange"];
  attendees: number | null;
  budgetMaxEur: number | null;
  missing: string[];
  readyForCatalogSearch: boolean;
  externalActionsAllowed: false;
};

const patterns: ReadonlyArray<[ServiceKind, RegExp]> = [
  ["venue", /\b(chalet|chalets|casa|casas|finca|fincas|salon|salones|local|locales|espacio|espacios)\b/],
  ["dj", /\b(dj|djs|disc jockey|pinchadiscos)\b/],
  ["sound", /\b(sonidista|sonidistas|sonido|sound|audio|altavoces|megafonia|equipos? de sonido)\b/],
  ["lighting", /\b(iluminacion|luces|lighting|luminotecnia)\b/],
  ["decoration", /\b(decoracion|decoradores|ambientacion|decoration)\b/],
  ["catering", /\b(catering|comida|banquete|cocineros)\b/],
  ["security", /\b(seguridad|vigilantes|security|control de accesos)\b/],
  ["staff", /\b(camareros|camareras|azafatas|azafatos|personal de eventos)\b/],
  ["transport", /\b(transporte|transport|autobuses|traslados|furgonetas)\b/],
  ["photography", /\b(fotografo|fotografos|fotografa|fotografas|fotografia|photography)\b/],
  ["video", /\b(videografo|videografos|videografia|videography|grabacion de video)\b/],
  ["cleaning", /\b(limpieza|limpiadores|limpiadoras|cleaning)\b/],
  ["furniture", /\b(sillas|mesas|mobiliario|furniture|chair rental|table rental)\b/],
  ["technician", /\b(tecnico|tecnicos|montaje tecnico|technician|technical crew)\b/],
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ");
}

export function detectServices(text: string): ServiceKind[] {
  const input = normalize(text);
  const found: ServiceKind[] = [];

  for (const [kind, pattern] of patterns) {
    const match = pattern.exec(input);
    if (!match) continue;

    const before = input.slice(
      Math.max(0, match.index - 40),
      match.index,
    );

    const negative =
      /(?:\bsin\s+|\bno\s+(?:quiero|necesito|busco)\s+)$/
        .test(before);

    if (!negative) found.push(kind);
  }

  return found;
}

export function buildCommercialPlan(
  text: string,
  draft: EventIntakeDraft,
): CommercialPlan {
  const services = detectServices(text);

  const action =
    /\b(necesit\w*|busc\w*|quier\w*|contrat\w*|alquil\w*|presupuest\w*|cotiz\w*|precio\w*|disponib\w*|organiz\w*)\b/
      .test(normalize(text));

  const eventIntent =
    draft.eventIntent || (action && services.length > 0);

  const missing: string[] = [];

  if (!draft.dateOptions.length && !draft.dateRange)
    missing.push("date");

  if (!draft.location)
    missing.push("location");

  if (services.includes("venue") && !draft.attendees)
    missing.push("attendees");

  if (!services.length)
    missing.push("services");

  return {
    version: "commercial-v1",
    intent: eventIntent
      ? "event_request"
      : "not_an_event_request",
    services: eventIntent ? services : [],
    eventType: draft.eventType?.value ?? null,
    location: draft.location?.value ?? null,
    dateOptions: draft.dateOptions,
    dateRange: draft.dateRange,
    attendees: draft.attendees?.value ?? null,
    budgetMaxEur: draft.budgetMaxEur?.value ?? null,
    missing,
    readyForCatalogSearch:
      eventIntent && services.length > 0,
    externalActionsAllowed: false,
  };
}

export function planIncomingCommercialMessage(
  text: string,
): CommercialPlan {
  return buildCommercialPlan(
    text,
    extractEventIntake(text),
  );
}

export type CatalogEntry = {
  id: string;
  name: string;
  kind: "venue" | "provider";
  category: string | null;
  location: string | null;
  capacity: number | null;
  status: string | null;
};

export type CatalogCandidate = {
  id: string;
  name: string;
  kind: "venue" | "provider";
  matchingService: ServiceKind;
  score: number;
  checksRequired: string[];
  availability: "unverified";
  contactPermission: "unverified";
};

const blocked = new Set([
  "inactive", "disabled", "archived",
  "deleted", "blocked", "suspended",
]);

export function rankCommercialCatalog(
  plan: CommercialPlan,
  entries: CatalogEntry[],
): CatalogCandidate[] {
  if (!plan.readyForCatalogSearch) return [];

  const matches: CatalogCandidate[] = [];

  for (const item of entries) {
    if (!item.id || !item.name) continue;

    if (item.status && blocked.has(normalize(item.status)))
      continue;

    const services: ServiceKind[] =
      item.kind === "venue"
        ? plan.services.includes("venue")
          ? ["venue"]
          : []
        : detectServices(item.category ?? "")
            .filter(service =>
              service !== "venue" &&
              plan.services.includes(service)
            );

    if (!services.length) continue;

    if (
      item.kind === "venue" &&
      plan.attendees !== null &&
      item.capacity !== null &&
      item.capacity < plan.attendees
    ) continue;

    const sameLocation = !!(
      plan.location &&
      item.location &&
      (
        normalize(item.location).includes(normalize(plan.location)) ||
        normalize(plan.location).includes(normalize(item.location))
      )
    );

    const checksRequired = [
      "confirmar disponibilidad y precio",
      "verificar permiso de contacto",
    ];

    if (!item.location || (plan.location && !sameLocation))
      checksRequired.push("verificar zona");

    if (item.kind === "venue" && item.capacity === null)
      checksRequired.push("verificar aforo");

    for (const service of services) {
      matches.push({
        id: item.id,
        name: item.name,
        kind: item.kind,
        matchingService: service,
        score:
          10 +
          (sameLocation ? 5 : 0) +
          (item.capacity !== null ? 2 : 0),
        checksRequired,
        availability: "unverified",
        contactPermission: "unverified",
      });
    }
  }

  return matches
    .sort((a, b) =>
      b.score - a.score ||
      a.name.localeCompare(b.name)
    )
    .slice(0, 30);
}
