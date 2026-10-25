import { createHash } from "node:crypto";

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function fingerprint(value) {
  return createHash("sha256")
    .update(String(value))
    .digest("hex");
}

const OWNER_PATTERNS = [
  /\bsoy (?:el |la )?(?:dueno|duena|propietario|propietaria) de\b/,
  /\btengo (?:un|una) (?:chalet|finca|salon|local|espacio)\b/,
  /\balquilo (?:mi|nuestro|nuestra) (?:chalet|finca|salon|local|espacio)\b/,
  /\bofrezco (?:mi|nuestro|nuestra) (?:chalet|finca|salon|local|espacio)\b/,
  /\bdispongo de (?:un|una) (?:chalet|finca|salon|local|espacio)\b/,
];

const PROVIDER_PATTERNS = [
  /\bsoy (?:fotografo|fotografa|dj|decorador|decoradora)\b/,
  /\bofrecemos (?:servicios? de |servicio de )?(?:catering|fotografia|decoracion|musica)\b/,
  /\bme dedico a (?:la )?(?:fotografia|decoracion|organizacion de eventos)\b/,
  /\bprestamos servicios de (?:catering|fotografia|decoracion)\b/,
];

const CLIENT_PATTERNS = [
  /\bbusco (?:un|una) (?:chalet|local|salon|finca|espacio)\b/,
  /\bestoy buscando (?:un|una) (?:chalet|local|salon|finca|espacio)\b/,
  /\bnecesito (?:un|una) (?:chalet|local|salon|finca|espacio)\b/,
  /\bquiero organizar (?:un|una|mi)\b/,
  /\bquisiera (?:un )?presupuesto\b/,
  /\bpresupuesto para (?:un|una|mi)\b/,
];

const OPT_OUT_PATTERNS = [
  /\bno me (?:escribas|contactes|mandes mensajes)\b/,
  /\bno quiero recibir (?:mas )?mensajes\b/,
  /\bdame de baja\b/,
  /\bno quiero que me contacten\b/,
];

const CITY_NAMES = [
  "valencia",
  "silla",
  "torrent",
  "paterna",
  "sagunto",
  "cullera",
  "gandia",
  "alfafar",
  "alboraya",
  "manises",
  "picassent",
  "chiva",
];

function hasPattern(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function evidence(message, value) {
  return {
    message_id: String(message.id),
    value,
    occurred_at:
      message.occurred_at ??
      message.created_at ??
      null,
    excerpt:
      String(message.body ?? "")
        .replace(/\s+/g, " ")
        .slice(0, 180),
  };
}

function extractCity(text) {
  const locationContext =
    /\b(?:chalet|local|salon|finca|espacio|ubicad[oa])\b.{0,90}\ben\s+/;

  if (!locationContext.test(text)) {
    return null;
  }

  for (const city of CITY_NAMES) {
    if (new RegExp(`\\ben ${city}\\b`).test(text)) {
      return city;
    }
  }

  return null;
}

function extractCapacity(text) {
  const matches = [
    ...text.matchAll(
      /\b(?:capacidad|aforo)\s+(?:de|para)\s+(\d{1,4})\s+personas\b/g,
    ),
    ...text.matchAll(
      /\bcaben\s+(\d{1,4})\s+personas\b/g,
    ),
  ];

  for (const match of matches) {
    const value = Number(match[1]);

    if (
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 2000
    ) {
      return value;
    }
  }

  return null;
}

function extractProviderService(text) {
  const services = [
    ["catering", /\bcatering\b/],
    ["fotografia", /\bfotograf(?:o|a|ia)\b/],
    ["dj", /\bdj\b/],
    ["decoracion", /\bdecoraci[oó]n\b/],
  ];

  return services
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
}

export function classifyContact(messages) {
  const ordered = [...messages].sort((a, b) => {
    const x = a.occurred_at ?? a.created_at ?? "";
    const y = b.occurred_at ?? b.created_at ?? "";

    return x.localeCompare(y);
  });

  const roleEvidence = {
    owner: [],
    provider: [],
    client: [],
  };

  const cities = new Map();
  const capacities = new Map();
  const features = new Map();
  const services = new Map();

  const optOutEvidence = [];

  let inbound = 0;
  let outbound = 0;

  for (const message of ordered) {
    if (message.direction === "outbound") {
      outbound++;
      continue;
    }

    if (message.direction !== "inbound") {
      continue;
    }

    inbound++;

    if (
      typeof message.body !== "string" ||
      !message.body.trim() ||
      !message.id
    ) {
      continue;
    }

    const text = normalizeText(message.body);

    if (hasPattern(text, OPT_OUT_PATTERNS)) {
      optOutEvidence.push(
        evidence(message, "do_not_contact"),
      );
    }

    const isOwner = hasPattern(
      text,
      OWNER_PATTERNS,
    );

    const isProvider = hasPattern(
      text,
      PROVIDER_PATTERNS,
    );

    const isClient = hasPattern(
      text,
      CLIENT_PATTERNS,
    );

    if (isOwner) {
      roleEvidence.owner.push(
        evidence(message, "owner"),
      );

      const city = extractCity(text);

      if (city && !cities.has(city)) {
        cities.set(
          city,
          evidence(message, city),
        );
      }

      const capacity = extractCapacity(text);

      if (
        capacity !== null &&
        !capacities.has(capacity)
      ) {
        capacities.set(
          capacity,
          evidence(message, capacity),
        );
      }

      /*
       * Una pregunta no constituye evidencia
       * de una instalación existente.
       *
       * Tampoco se convierten negaciones en
       * características positivas.
       *
       * Clasificación conservadora:
       * ante contradicción se omite la propuesta.
       */
      const confirmedPool = text
        .split(/[.;]+/)
        .some((segment) => {
          const clause = segment.trim();

          if (!clause) {
            return false;
          }

          // Preguntas: no confirmar instalaciones.
          if (/[¿?]/.test(clause)) {
            return false;
          }

          // Negaciones explícitas.
          const negativePool =
            /\b(?:sin piscina|no (?:tiene|hay|dispone de)\s+piscina|no cuenta con piscina|carece de piscina)\b/;

          if (negativePool.test(clause)) {
            return false;
          }

          const positivePool =
            /\b(?:con piscina|tiene piscina|dispone de piscina)\b/;

          return positivePool.test(clause);
        });

      if (confirmedPool) {
        features.set(
          "piscina",
          evidence(message, "piscina"),
        );
      }
    }

    if (isProvider) {
      roleEvidence.provider.push(
        evidence(message, "provider"),
      );

      for (
        const service of extractProviderService(text)
      ) {
        if (!services.has(service)) {
          services.set(
            service,
            evidence(message, service),
          );
        }
      }
    }

    if (isClient) {
      roleEvidence.client.push(
        evidence(message, "client"),
      );
    }
  }

  const roles = Object.entries(roleEvidence)
    .filter(([, items]) => items.length > 0)
    .map(([role]) => role);

  const role =
    roles.length === 1
      ? roles[0]
      : roles.length > 1
        ? "review"
        : "unclassified";

  const lastMessage =
    ordered.length
      ? ordered[ordered.length - 1]
      : null;

  const possiblePending =
    lastMessage?.direction === "inbound" &&
    optOutEvidence.length === 0;

  return {
    proposed_role: role,
    conflicting_roles:
      roles.length > 1 ? roles : [],
    role_evidence:
      roles.flatMap((r) =>
        roleEvidence[r].slice(0, 3)
      ),
    proposed_venue_cities:
      [...cities.values()],
    proposed_capacities:
      [...capacities.values()],
    proposed_features:
      [...features.values()],
    proposed_services:
      [...services.values()],
    do_not_contact_candidate:
      optOutEvidence.length > 0,
    opt_out_evidence:
      optOutEvidence.slice(0, 3),
    possible_pending_review:
      Boolean(possiblePending),
    last_direction:
      lastMessage?.direction ?? null,
    last_activity:
      lastMessage?.occurred_at ??
      lastMessage?.created_at ??
      null,
    message_counts: {
      total: ordered.length,
      inbound,
      outbound,
    },
  };
}
