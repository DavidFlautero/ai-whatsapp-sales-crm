import { normalizeText } from "./classifier.mjs";

const PATTERNS = {
  owner: [
    /\b(?:tengo|tenemos|alquilo|alquilamos)\b.{0,65}\b(?:chalet|finca|local|salon|espacio)\b/,
    /\b(?:dispongo|disponemos)\s+de\b.{0,65}\b(?:chalet|finca|local|salon|espacio)\b/,
    /\bsoy (?:propietario|propietaria|dueno|duena)\b/,
  ],
  provider: [
    /\b(?:soy|somos|ofrezco|ofrecemos|trabajo como)\b.{0,65}\b(?:dj|fotograf\w*|catering|decorador\w*|animador\w*|musico|chef)\b/,
    /\b(?:prestamos|ofrecemos)\s+servicios?\s+de\b/,
  ],
  client: [
    /\b(?:busco|buscamos|necesito|necesitamos|quiero|queremos|quisiera|quisieramos)\b.{0,85}\b(?:chalet|finca|local|salon|espacio|alquilar|reservar|fiesta|cumpleanos|boda|evento|catering)\b/,
    /\b(?:me interesa|nos interesa)\b.{0,65}\b(?:chalet|salon|local|alquiler|reserva)\b/,
  ],
};

const INQUIRY = [
  /\b(?:disponibilidad|presupuesto|cotizacion)\b/,
  /\b(?:cuanto cuesta|cuanto sale|que precio|que precios)\b/,
  /\b(?:para \d{1,4} personas)\b/,
];

const OPT_OUT = [
  /\bno me (?:escribas|contactes|mandes mensajes)\b/,
  /\bno quiero recibir (?:mas )?mensajes\b/,
  /\b(?:dame|denme) de baja\b/,
  /\bno (?:me|nos) contacten\b/,
];

function anyMatch(text, patterns) {
  return patterns.some(pattern => pattern.test(text));
}

function negatedRole(text) {
  return /\bno (?:soy|somos|tengo|tenemos|ofrezco|ofrecemos)\b/.test(text);
}

export function analyzeContactSignals(messages) {
  const evidence = [];
  const roles = new Set();
  let inquiries = 0;
  let optOut = false;
  let inboundWithBody = 0;

  for (const message of messages) {
    if (message.direction !== "inbound") continue;
    if (!message.id || typeof message.body !== "string") continue;

    const text = normalizeText(message.body);
    if (!text) continue;

    inboundWithBody++;

    if (anyMatch(text, OPT_OUT)) {
      optOut = true;
      evidence.push({
        message_id: message.id,
        signal: "opt_out",
      });
    }

    if (anyMatch(text, INQUIRY)) {
      inquiries++;
      evidence.push({
        message_id: message.id,
        signal: "commercial_inquiry",
      });
    }

    if (negatedRole(text)) continue;

    for (const [role, patterns] of Object.entries(PATTERNS)) {
      if (anyMatch(text, patterns)) {
        roles.add(role);
        evidence.push({
          message_id: message.id,
          signal: `role_${role}`,
        });
      }
    }
  }

  const candidateRoles = [...roles].sort();

  return {
    candidate_roles: candidateRoles,
    proposed_role:
      candidateRoles.length === 1
        ? candidateRoles[0]
        : candidateRoles.length > 1
          ? "review_conflict"
          : "unclassified",
    commercial_inquiry_count: inquiries,
    opt_out_candidate: optOut,
    inbound_with_body: inboundWithBody,
    evidence: evidence.slice(0, 30),
    requires_human_review: true,
    automatically_applied: false,
  };
}
