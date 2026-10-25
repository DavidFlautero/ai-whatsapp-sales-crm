export function clean(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function safeExcerpt(value) {
  return String(value ?? "")
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      "[correo]",
    )
    .replace(/https?:\/\/\S+/gi, "[enlace]")
    .replace(
      /(?:\+?\d[\d() .-]{7,}\d)/g,
      "[telefono]",
    )
    .replace(/\s+/g, " ")
    .slice(0, 240);
}

const EVENTS = [
  ["quinceanera", /\b(?:quinceanera|quinceanos|15 anos)\b/],
  ["boda", /\b(?:boda|casamiento|matrimonio)\b/],
  ["cumpleanos", /\b(?:cumpleanos|cumple)\b/],
  ["comunion", /\bcomunion\b/],
  ["bautizo", /\b(?:bautizo|bautismo)\b/],
  [
    "evento_empresa",
    /\b(?:evento empresarial|evento corporativo|fiesta de empresa)\b/,
  ],
];

const SERVICES = [
  ["espacio", /\b(?:chalet|finca|salon|local|espacio)\b/],
  ["catering", /\b(?:catering|comida|banquete)\b/],
  ["dj_musica", /\b(?:dj|musica|sonido)\b/],
  ["decoracion", /\bdecoracion\b/],
  ["fotografia", /\b(?:fotografo|fotografia|fotos)\b/],
];

const MONTH =
  "(enero|febrero|marzo|abril|mayo|junio|" +
  "julio|agosto|septiembre|octubre|noviembre|diciembre)";

function sortTime(message) {
  const timestamp = Date.parse(
    message.occurred_at ??
    message.created_at ??
    "",
  );
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function makeDossierEvidence(messages) {
  const ordered = [...messages]
    .filter((m) => Boolean(m?.id))
    .sort(
      (a, b) =>
        sortTime(a) - sortTime(b) ||
        String(a.id).localeCompare(String(b.id)),
    );

  const evidence = [];
  const seen = new Set();

  let inboundText = 0;
  let outbound = 0;

  for (const message of ordered) {
    if (message.direction === "outbound") {
      outbound++;
      continue;
    }

    if (
      message.direction !== "inbound" ||
      typeof message.body !== "string" ||
      !message.body.trim()
    ) {
      continue;
    }

    inboundText++;

    const body = clean(message.body);

    function record(kind, value) {
      const key = `${message.id}|${kind}|${value}`;

      if (seen.has(key) || evidence.length >= 150) {
        return;
      }

      seen.add(key);

      evidence.push({
        kind,
        value,
        message_id: String(message.id),
        occurred_at:
          message.occurred_at ??
          message.created_at ??
          null,
        excerpt: safeExcerpt(message.body),
        status: "candidate_not_verified",
      });
    }

    const offer =
      /\b(?:tengo|tenemos|ofrezco|ofrecemos|alquilo|alquilamos|dispongo de)\b.{0,80}\b(?:chalet|local|finca|salon|espacio|catering|fotografia|decoracion)\b/
        .test(body);

    const request =
      /\b(?:busco|buscamos|quiero|queremos|necesito|necesitamos|quisiera|quisieramos|me interesa|tienen disponibilidad|tenes disponibilidad|me pasas|me puedes pasar)\b/
        .test(body);

    if (
      /\b(?:no me escribas|no me contactes|no quiero recibir (?:mas )?mensajes|dame de baja|no nos contacten)\b/
        .test(body)
    ) {
      record("opt_out", "review_block_contact");
    }

    if (offer) {
      record(
        "commercial_offer",
        "provider_or_owner_offer",
      );
    }

    if (request) {
      record(
        "commercial_request",
        "potential_customer_need",
      );
    }

    for (const [value, pattern] of EVENTS) {
      if (pattern.test(body)) {
        record("event_type", value);
      }
    }

    if (request) {
      for (const [value, pattern] of SERVICES) {
        if (pattern.test(body)) {
          record("requested_service", value);
        }
      }
    }

    for (
      const match of body.matchAll(
        /\b(?:para|somos|seremos|de|entre)\s+(\d{1,4})\s+(?:personas|invitados|asistentes)\b/g,
      )
    ) {
      const number = Number(match[1]);

      if (number > 0 && number <= 2000) {
        record(
          "guest_count_mentioned",
          String(number),
        );
      }
    }

    for (
      const match of body.matchAll(
        /\b(?:para|de|entre)\s+(\d{1,4})\s+(?:a|y|o)\s+(\d{1,4})\s+(?:personas|invitados)\b/g,
      )
    ) {
      const a = Number(match[1]);
      const b = Number(match[2]);

      if (
        a > 0 && b > 0 &&
        a <= 2000 && b <= 2000
      ) {
        record(
          "guest_range_mentioned",
          `${a}-${b}`,
        );
      }
    }

    const datePattern = new RegExp(
      `\\b(\\d{1,2})\\s+de\\s+${MONTH}\\b`,
      "g",
    );

    for (const match of body.matchAll(datePattern)) {
      const day = Number(match[1]);

      if (day >= 1 && day <= 31) {
        record(
          "day_month_mentioned",
          `${day} de ${match[2]}`,
        );
      }
    }

    const alternativePattern = new RegExp(
      `\\b(\\d{1,2})\\s+(?:o|y)\\s+(\\d{1,2})\\s+de\\s+${MONTH}\\b`,
      "g",
    );

    for (
      const match of body.matchAll(alternativePattern)
    ) {
      const a = Number(match[1]);
      const b = Number(match[2]);

      if (
        a >= 1 && a <= 31 &&
        b >= 1 && b <= 31
      ) {
        record(
          "alternative_days_mentioned",
          `${a} o ${b} de ${match[3]}`,
        );
      }
    }

    const budget = body.match(
      /\b(?:presupuesto|dispongo de|tenemos de presupuesto|mi tope es)\s*(?::|de|es)?\s*(\d{2,6})\s*(?:€|euros)\b/,
    );

    if (budget) {
      record(
        "budget_mentioned_eur",
        budget[1],
      );
    }
  }

  const counts = {};

  for (const item of evidence) {
    counts[item.kind] =
      (counts[item.kind] ?? 0) + 1;
  }

  return {
    source_message_count: ordered.length,
    inbound_text_count: inboundText,
    outbound_count: outbound,
    last_direction:
      ordered.at(-1)?.direction ?? null,
    last_activity:
      ordered.at(-1)?.occurred_at ??
      ordered.at(-1)?.created_at ??
      null,
    candidate_counts: counts,
    evidence,
    recent_context:
      ordered.slice(-16).map((message) => ({
        message_id: String(message.id),
        direction: message.direction,
        occurred_at:
          message.occurred_at ??
          message.created_at ??
          null,
        excerpt: safeExcerpt(message.body),
      })),
    review_required: true,
  };
}
