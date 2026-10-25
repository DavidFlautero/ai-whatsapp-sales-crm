/**
 * Eventos Mediterráneo
 * Extracción conservadora de información comercial.
 *
 * No envía WhatsApp.
 * No modifica Supabase.
 * No inventa fechas, precios ni disponibilidad.
 */

export type ExtractedFact<T> = {
  value: T;
  evidence: string;
  certainty: "explicit";
};

export type IntakeDate = {
  day: number;
  month: number;
  year: number | null;
};

export type EventIntakeDraft = {
  eventIntent: boolean;

  eventType:
    | ExtractedFact<string>
    | null;

  venueType:
    | ExtractedFact<string>
    | null;

  location:
    | ExtractedFact<string>
    | null;

  dateOptions:
    ExtractedFact<IntakeDate>[];

  dateRange:
    | ExtractedFact<{
        start: IntakeDate;
        end: IntakeDate;
      }>
    | null;

  attendees:
    | ExtractedFact<number>
    | null;

  sleepers:
    | ExtractedFact<number>
    | null;

  budgetMaxEur:
    | ExtractedFact<number>
    | null;

  amenities:
    ExtractedFact<string>[];
};

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const MONTH_PATTERN =
  "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre";

const LOCATIONS = [
  "Valencia",
  "Alicante",
  "Castellón",
  "Gandía",
  "Cullera",
  "Picassent",
  "Montroy",
  "Godelleta",
  "Benidorm",
  "Elche",
  "Torrevieja",
];

function fact<T>(
  value: T,
  evidence: string,
): ExtractedFact<T> {
  return {
    value,
    evidence: evidence.trim(),
    certainty: "explicit",
  };
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseAmount(
  value: string,
): number | null {
  const cleaned =
    value.replace(/\s/g, "");

  const amount = Number(
    cleaned.includes(",")
      ? cleaned
          .replace(/\./g, "")
          .replace(",", ".")
      : cleaned.replace(/\./g, ""),
  );

  return Number.isFinite(amount) &&
    amount > 0 &&
    amount <= 1_000_000
      ? amount
      : null;
}

function parseDate(
  dayText: string,
  monthText: string,
  yearText?: string,
): IntakeDate | null {
  const day = Number(dayText);
  const month =
    MONTHS[normalize(monthText)];

  const year = yearText
    ? Number(yearText)
    : null;

  if (
    !month ||
    day < 1 ||
    day > 31 ||
    (
      year !== null &&
      (year < 2020 || year > 2100)
    )
  ) {
    return null;
  }

  const checkYear = year ?? 2024;

  const maxDay = new Date(
    Date.UTC(
      checkYear,
      month,
      0,
    ),
  ).getUTCDate();

  if (day > maxDay) {
    return null;
  }

  return {
    day,
    month,
    year,
  };
}

export function extractEventIntake(
  text: string,
): EventIntakeDraft {
  const input = text
    .slice(0, 8000)
    .replace(/\s+/g, " ")
    .trim();

  const normalized =
    normalize(input);

  const eventIntent =
    /\b(necesit|busc|quier|reserv|alquil|celebr|organizar|organizo)/.test(
      normalized,
    ) &&
    /\b(chalet|casa|finca|salon|local|espacio|cumple|fiesta|boda|evento|mis 18)/.test(
      normalized,
    );

  const result: EventIntakeDraft = {
    eventIntent,
    eventType: null,
    venueType: null,
    location: null,
    dateOptions: [],
    dateRange: null,
    attendees: null,
    sleepers: null,
    budgetMaxEur: null,
    amenities: [],
  };

  // Tipo de celebración.

  const eventMatch =
    /\b(cumpleaños|cumpleanos|mis 18|cumple|boda|baby shower|fiesta|comuni[oó]n|reuni[oó]n de empresa)\b/i.exec(
      input,
    );

  if (eventMatch) {
    const eventType =
      /^(mis 18|cumple)/i.test(
        eventMatch[0],
      )
        ? "cumpleaños"
        : normalize(eventMatch[0]);

    result.eventType = fact(
      eventType,
      eventMatch[0],
    );
  }

  // Tipo de espacio.

  const venueMatch =
    /\b(chalet|casa|finca|sal[oó]n|local|espacio|terraza)\b/i.exec(
      input,
    );

  if (venueMatch) {
    result.venueType = fact(
      normalize(venueMatch[0]),
      venueMatch[0],
    );
  }

  // Localización explícita.
  // La interpretación geográfica amplia
  // se incorporará en el motor IA.

  for (const place of LOCATIONS) {
    const pattern = new RegExp(
      `\\b(?:en|por|zona de|cerca de)\\s+(${place})(\\s+centro)?\\b`,
      "i",
    );

    const match =
      pattern.exec(input);

    if (match) {
      result.location = fact(
        `${match[1]}${match[2] ?? ""}`.trim(),
        match[0],
      );

      break;
    }
  }

  // Fechas. Nunca inventar el año.

  const dateKeys =
    new Set<string>();

  const addDate = (
    date: IntakeDate | null,
    evidence: string,
  ) => {
    if (!date) return;

    const key =
      `${date.day}/${date.month}/${date.year ?? "?"}`;

    if (!dateKeys.has(key)) {
      dateKeys.add(key);

      result.dateOptions.push(
        fact(date, evidence),
      );
    }
  };

  // Periodos: del 1 al 3 de enero.

  const rangePattern = new RegExp(
    `\\b(?:del?\\s+)?(\\d{1,2})\\s+al\\s+(\\d{1,2})\\s+de\\s+(${MONTH_PATTERN})(?:\\s+de\\s+(20\\d{2}))?\\b`,
    "i",
  );

  const range =
    rangePattern.exec(input);

  if (range) {
    const start = parseDate(
      range[1],
      range[3],
      range[4],
    );

    const end = parseDate(
      range[2],
      range[3],
      range[4],
    );

    if (
      start &&
      end &&
      start.day <= end.day
    ) {
      result.dateRange = fact(
        { start, end },
        range[0],
      );
    }
  }

  if (!result.dateRange) {
    // Alternativas: 12 o 19 de diciembre.

    const alternatives =
      new RegExp(
        `\\b(\\d{1,2})\\s+(?:o|y|/)\\s+(?:el\\s+)?(\\d{1,2})\\s+de\\s+(${MONTH_PATTERN})(?:\\s+de\\s+(20\\d{2}))?\\b`,
        "gi",
      );

    for (
      const match of
      input.matchAll(alternatives)
    ) {
      addDate(
        parseDate(
          match[1],
          match[3],
          match[4],
        ),
        match[0],
      );

      addDate(
        parseDate(
          match[2],
          match[3],
          match[4],
        ),
        match[0],
      );
    }

    // Fechas completas.

    const fullDates =
      new RegExp(
        `\\b(\\d{1,2})\\s+de\\s+(${MONTH_PATTERN})(?:\\s+de\\s+(20\\d{2}))?\\b`,
        "gi",
      );

    for (
      const match of
      input.matchAll(fullDates)
    ) {
      addDate(
        parseDate(
          match[1],
          match[2],
          match[3],
        ),
        match[0],
      );
    }
  }

  // Cantidad de asistentes.

  const guestMatch =
    /\b(?:para|ser[ií]amos|seremos|somos|unas?|unos?|aproximadamente|aprox\.?|alrededor de)\s+(\d{1,3})\s*(?:personas|invitados|asistentes)?\b/i.exec(
      input,
    ) ??
    /\b(\d{1,3})\s+(?:personas|invitados|asistentes)\b/i.exec(
      input,
    );

  if (guestMatch) {
    const count =
      Number(guestMatch[1]);

    if (
      count > 0 &&
      count <= 999
    ) {
      result.attendees = fact(
        count,
        guestMatch[0],
      );
    }
  }

  // Personas que dormirán.
  // Independiente del aforo del evento.

  const sleepersMatch =
    /\b(?:duermen|dormir[aá]n|pernoctan|se quedan a dormir)\s+(\d{1,3})\b/i.exec(
      input,
    ) ??
    /\b(\d{1,3})\s+(?:personas\s+)?(?:a dormir|duermen|pernoctan)\b/i.exec(
      input,
    );

  if (sleepersMatch) {
    const count =
      Number(sleepersMatch[1]);

    if (
      count > 0 &&
      count <= 999
    ) {
      result.sleepers = fact(
        count,
        sleepersMatch[0],
      );
    }
  }

  // Presupuesto declarado.
  // No confundir con un precio ofertado.

  const budgetMatch =
    /\b(?:presupuesto(?:\s+(?:m[aá]ximo|de|aproximado))?|hasta|m[aá]ximo)\s*(?:de\s*)?(?:unos?\s*)?(\d{1,3}(?:[. ]\d{3})*(?:,\d{1,2})?|\d{4,6})(?:\s*(?:€|euros?))?\b/i.exec(
      input,
    ) ??
    /\b(?:tengo|tenemos|contamos con)\s+(\d{1,3}(?:[. ]\d{3})*(?:,\d{1,2})?|\d{4,6})\s*(?:€|euros?)\s+de presupuesto\b/i.exec(
      input,
    );

  if (budgetMatch) {
    const amount =
      parseAmount(
        budgetMatch[1],
      );

    if (amount !== null) {
      result.budgetMaxEur = fact(
        amount,
        budgetMatch[0],
      );
    }
  }

  // Instalaciones solicitadas.
  // La IA deberá resolver negaciones y
  // preferencias complejas posteriormente.

  const amenities = [
    {
      pattern: /\bpiscina\b/i,
      name: "piscina",
    },
    {
      pattern: /\bjacuzzi\b/i,
      name: "jacuzzi",
    },
    {
      pattern: /\bbarbacoa\b/i,
      name: "barbacoa",
    },
    {
      pattern: /\b(?:cocina|cocinar)\b/i,
      name: "cocina",
    },
    {
      pattern: /\b(?:m[uú]sica|dj)\b/i,
      name: "música",
    },
  ];

  for (const amenity of amenities) {
    const match =
      amenity.pattern.exec(input);

    if (!match) continue;

    const before = input
      .slice(
        Math.max(
          0,
          match.index - 20,
        ),
        match.index,
      )
      .toLowerCase();

    if (
      /\b(?:sin|no quiero|no necesito)\s+$/.test(
        before,
      )
    ) {
      continue;
    }

    result.amenities.push(
      fact(
        amenity.name,
        match[0],
      ),
    );
  }

  return result;
}
