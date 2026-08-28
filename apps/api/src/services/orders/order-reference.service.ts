import {
  listCustomerOrdersByPhone,
} from "./order.service.js";

export type CustomerOrder =
  Record<string, unknown>
  & {
    customer:
      Record<string, unknown>;

    items:
      Array<
        Record<string, unknown>
      >;
  };

export type OrderReferenceResolution = {
  status:
    | "resolved"
    | "ambiguous"
    | "not_found";

  order:
    CustomerOrder
    | null;

  candidates:
    CustomerOrder[];

  reason:
    string;
};

function normalize(
  value: unknown,
): string {
  return String(
    value
    ?? "",
  )
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /\p{Diacritic}/gu,
      "",
    )
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .trim();
}

function madridDateKey(
  value: unknown,
): string | null {
  const date =
    value instanceof Date
      ? value
      : typeof value === "string"
        ? new Date(value)
        : null;

  if (
    !date
    || Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Europe/Madrid",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      },
    ).formatToParts(
      date,
    );

  const year =
    parts.find(
      (part) =>
        part.type === "year",
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type === "month",
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type === "day",
    )?.value;

  return (
    year
    && month
    && day
      ? `${year}-${month}-${day}`
      : null
  );
}

function relativeDateKey(
  daysAgo: number,
): string | null {
  const now =
    new Date();

  return madridDateKey(
    new Date(
      now.getTime()
      - daysAgo
        * 24
        * 60
        * 60
        * 1000,
    ),
  );
}

function orderText(
  order: CustomerOrder,
): string {
  const items =
    Array.isArray(order.items)
      ? order.items
      : [];

  return normalize(
    [
      order.number,
      order.commercial_status,
      order.payment_status,
      order.fulfillment_status,
      order.reservation_status,
      ...items.flatMap(
        (item) => [
          item.product_name_snapshot,
          item.color_name_snapshot,
          item.size_snapshot,
          item.sku_snapshot,
        ],
      ),
    ].join(" "),
  );
}

function matchesStatus(
  order: CustomerOrder,
  message: string,
): boolean {
  const commercialStatus =
    normalize(
      order.commercial_status,
    );

  const paymentStatus =
    normalize(
      order.payment_status,
    );

  const fulfillmentStatus =
    normalize(
      order.fulfillment_status,
    );

  if (
    /\bcancelad[oa]s?\b/
      .test(message)
  ) {
    return (
      commercialStatus
      === "cancelled"
    );
  }

  if (
    /\bpagad[oa]s?\b/
      .test(message)
  ) {
    return (
      paymentStatus
      === "paid"
    );
  }

  if (
    /\bpendiente(?:s)? de pago\b/
      .test(message)
    || /\bsin pagar\b/
      .test(message)
    || /\bdebo\b/
      .test(message)
  ) {
    return (
      paymentStatus
      === "unpaid"
      || paymentStatus
        === "partial"
    );
  }

  if (
    /\bactiv[oa]s?\b/
      .test(message)
    || /\bpendiente(?:s)?\b/
      .test(message)
  ) {
    return (
      commercialStatus
      !== "cancelled"
      && ![
        "shipped",
        "delivered",
        "cancelled",
      ].includes(
        fulfillmentStatus,
      )
    );
  }

  return true;
}

function matchesDate(
  order: CustomerOrder,
  message: string,
): boolean {
  const createdDate =
    madridDateKey(
      order.created_at,
    );

  if (
    /\banteayer\b/
      .test(message)
  ) {
    return (
      createdDate
      === relativeDateKey(2)
    );
  }

  if (
    /\bayer\b/
      .test(message)
  ) {
    return (
      createdDate
      === relativeDateKey(1)
    );
  }

  if (
    /\bhoy\b/
      .test(message)
  ) {
    return (
      createdDate
      === relativeDateKey(0)
    );
  }

  return true;
}

function meaningfulWords(
  message: string,
): string[] {
  const ignored =
    new Set([
      "pedido",
      "pedidos",
      "quiero",
      "tengo",
      "tenia",
      "tenemos",
      "esta",
      "este",
      "esto",
      "aquel",
      "cancelado",
      "activo",
      "pendiente",
      "pago",
      "ayer",
      "anteayer",
      "hoy",
      "ultimo",
      "primero",
      "segundo",
      "producto",
      "productos",
      "elimina",
      "eliminar",
      "borra",
      "borrar",
      "cancela",
      "cancelar",
      "quita",
      "quitar",
      "agrega",
      "agregar",
      "modifica",
      "modificar",
      "importe",
      "monto",
      "total",
      "valor",
      "saldo",
      "ars",
      "cop",
      "eur",
      "usd",
      "mil",
      "barato",
      "caro",
    ]);

  return message
    .split(" ")
    .filter(
      (word) =>
        word.length >= 3
        && !ignored.has(word),
    );
}

function matchesProductTerms(
  order: CustomerOrder,
  message: string,
): boolean {
  const words =
    meaningfulWords(
      message,
    );

  if (!words.length) {
    return true;
  }

  const searchable =
    orderText(order);

  return words.some(
    (word) =>
      searchable.includes(word),
  );
}


const SPANISH_UNITS: Record<string, number> = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
};

const SPANISH_TENS: Record<string, number> = {
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
};

const SPANISH_HUNDREDS: Record<string, number> = {
  cien: 100,
  ciento: 100,
  doscientos: 200,
  trescientos: 300,
  cuatrocientos: 400,
  quinientos: 500,
  seiscientos: 600,
  setecientos: 700,
  ochocientos: 800,
  novecientos: 900,
};

function safeFiniteNumber(
  value: unknown,
): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        && value.trim()
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function parseSpanishNumberBelowThousand(
  rawValue: string,
): number | null {
  const words =
    normalize(rawValue)
      .split(" ")
      .filter(
        (word) =>
          word
          && word !== "y",
      );

  if (!words.length) {
    return null;
  }

  let result = 0;

  for (const word of words) {
    if (
      Object.prototype.hasOwnProperty.call(
        SPANISH_HUNDREDS,
        word,
      )
    ) {
      result +=
        SPANISH_HUNDREDS[word]
        ?? 0;

      continue;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        SPANISH_TENS,
        word,
      )
    ) {
      result +=
        SPANISH_TENS[word]
        ?? 0;

      continue;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        SPANISH_UNITS,
        word,
      )
    ) {
      result +=
        SPANISH_UNITS[word]
        ?? 0;

      continue;
    }

    return null;
  }

  return result > 0
    && result < 1000
      ? result
      : null;
}

function parseFormattedAmount(
  rawValue: string,
): number | null {
  const clean =
    rawValue
      .trim()
      .replace(
        /\s+/g,
        "",
      );

  if (!clean) {
    return null;
  }

  /**
   * En referencias de pedido:
   * 75.000 / 75,000 representan normalmente 75000.
   */
  const groupedThousands =
    /^\d{1,3}(?:[.,]\d{3})+$/
      .test(clean);

  const normalizedValue =
    groupedThousands
      ? clean.replace(
          /[.,]/g,
          "",
        )
      : clean.replace(
          /[^\d]/g,
          "",
        );

  if (!normalizedValue) {
    return null;
  }

  const amount =
    Number(normalizedValue);

  return (
    Number.isSafeInteger(amount)
    && amount >= 1000
  )
    ? amount
    : null;
}

function extractAmountReferences(
  rawMessage: string,
): number[] {
  const amounts =
    new Set<number>();

  const original =
    rawMessage.toLowerCase();

  const normalized =
    normalize(rawMessage);

  const contextualPatterns = [
    /(?:ars|cop|eur|usd|\$|€)\s*([\d][\d.,]*)/gi,
    /\b(?:total|importe|monto|valor|saldo|cuesta|vale|de|por)\s*(?:ars|cop|eur|usd|\$|€)?\s*([\d][\d.,]*)/gi,
  ];

  for (
    const pattern
    of contextualPatterns
  ) {
    for (
      const match
      of original.matchAll(pattern)
    ) {
      const amount =
        parseFormattedAmount(
          match[1]
          ?? "",
        );

      if (amount !== null) {
        amounts.add(amount);
      }
    }
  }

  /**
   * También aceptamos un número grande aislado:
   * "elimina 75000".
   *
   * No aceptamos números pequeños para evitar confundir
   * cantidades, talles o sufijos coloquiales.
   */
  for (
    const match
    of original.matchAll(
      /\b(\d{4,})\b/g,
    )
  ) {
    const amount =
      parseFormattedAmount(
        match[1]
        ?? "",
      );

    if (amount !== null) {
      amounts.add(amount);
    }
  }

  /**
   * 75 mil / 325 mil.
   */
  for (
    const match
    of normalized.matchAll(
      /\b(\d{1,3})\s+mil\b/g,
    )
  ) {
    const base =
      Number(
        match[1],
      );

    if (
      Number.isInteger(base)
      && base > 0
    ) {
      amounts.add(
        base * 1000,
      );
    }
  }

  /**
   * setenta y cinco mil / trescientos veinticinco mil.
   */
  const numberWords =
    [
      ...Object.keys(
        SPANISH_UNITS,
      ),
      ...Object.keys(
        SPANISH_TENS,
      ),
      ...Object.keys(
        SPANISH_HUNDREDS,
      ),
      "y",
    ]
      .sort(
        (a, b) =>
          b.length - a.length,
      )
      .join("|");

  const spokenThousandsPattern =
    new RegExp(
      `\\b((?:(?:${numberWords})\\s+){0,5}(?:${numberWords}))\\s+mil\\b`,
      "g",
    );

  for (
    const match
    of normalized.matchAll(
      spokenThousandsPattern,
    )
  ) {
    const base =
      parseSpanishNumberBelowThousand(
        match[1]
        ?? "",
      );

    if (base !== null) {
      amounts.add(
        base * 1000,
      );
    }
  }

  return [
    ...amounts,
  ];
}

function orderAmountValues(
  order: CustomerOrder,
): number[] {
  const values =
    new Set<number>();

  const directFields = [
    order.total,
    order.grand_total,
    order.total_amount,
    order.amount_total,
    order.balance_due,
    order.outstanding_amount,
    order.pending_amount,
    order.amount_due,
  ];

  for (
    const rawValue
    of directFields
  ) {
    const value =
      safeFiniteNumber(
        rawValue,
      );

    if (
      value !== null
      && value >= 0
    ) {
      values.add(
        Math.round(value),
      );
    }
  }

  const total =
    safeFiniteNumber(
      order.total
      ?? order.grand_total
      ?? order.total_amount
      ?? order.amount_total,
    );

  const paid =
    safeFiniteNumber(
      order.paid_amount
      ?? order.amount_paid
      ?? order.paid_total,
    );

  if (
    total !== null
    && paid !== null
    && total >= paid
  ) {
    values.add(
      Math.round(
        total - paid,
      ),
    );
  }

  return [
    ...values,
  ];
}

function matchesAmountReference(
  order: CustomerOrder,
  amountReferences: number[],
): boolean {
  if (!amountReferences.length) {
    return true;
  }

  const orderAmounts =
    orderAmountValues(
      order,
    );

  return amountReferences.some(
    (reference) =>
      orderAmounts.some(
        (orderAmount) =>
          Math.abs(
            orderAmount
            - reference,
          ) <= 1,
      ),
  );
}

function applyAmountExtreme(
  candidates: CustomerOrder[],
  message: string,
): CustomerOrder | null {
  if (!candidates.length) {
    return null;
  }

  const wantsCheapest =
    /\b(?:mas barato|menor importe|menor monto|menor total|el barato)\b/
      .test(message);

  const wantsMostExpensive =
    /\b(?:mas caro|mayor importe|mayor monto|mayor total|el caro)\b/
      .test(message);

  if (
    !wantsCheapest
    && !wantsMostExpensive
  ) {
    return null;
  }

  const valued =
    candidates
      .map(
        (order) => ({
          order,

          amount:
            orderAmountValues(
              order,
            )[0]
            ?? Number.NaN,
        }),
      )
      .filter(
        (entry) =>
          Number.isFinite(
            entry.amount,
          ),
      )
      .sort(
        (a, b) =>
          wantsCheapest
            ? a.amount - b.amount
            : b.amount - a.amount,
      );

  if (!valued.length) {
    return null;
  }

  /**
   * Si hay empate, no elegimos silenciosamente.
   */
  if (
    valued.length > 1
    && valued[0]?.amount
      === valued[1]?.amount
  ) {
    return null;
  }

  return valued[0]?.order
    ?? null;
}

function extractOrderNumberSuffix(
  message: string,
): string | null {
  const fullMatch =
    message.match(
      /\bful[\s-]?(\d{6})[\s-]?(\d{6})\b/i,
    );

  if (fullMatch) {
    return normalize(
      fullMatch[0],
    ).replace(
      /\s+/g,
      "",
    );
  }

  const suffixMatch =
    message.match(
      /\b(?:pedido\s*#?|#)\s*0*(\d{1,6})\b/i,
    );

  return suffixMatch?.[1]
    ?? null;
}

function matchesNumber(
  order: CustomerOrder,
  message: string,
): boolean {
  const suffix =
    extractOrderNumberSuffix(
      message,
    );

  if (!suffix) {
    return true;
  }

  const number =
    normalize(
      order.number,
    ).replace(
      /\s+/g,
      "",
    );

  return (
    number.endsWith(
      suffix.padStart(
        6,
        "0",
      ),
    )
    || number.includes(
      suffix,
    )
  );
}

function applyOrdinal(
  candidates: CustomerOrder[],
  message: string,
): CustomerOrder | null {
  if (!candidates.length) {
    return null;
  }

  if (
    /\b(?:ultimo|ultima|mas reciente|nuevo)\b/
      .test(message)
  ) {
    return candidates[0];
  }

  if (
    /\b(?:primero|primera)\b/
      .test(message)
  ) {
    return candidates[
      candidates.length - 1
    ];
  }

  if (
    /\b(?:segundo|segunda)\b/
      .test(message)
  ) {
    return candidates[1]
      ?? null;
  }

  if (
    /\b(?:tercero|tercera)\b/
      .test(message)
  ) {
    return candidates[2]
      ?? null;
  }

  return null;
}

export function resolveOrderReference(
  orders: CustomerOrder[],
  rawMessage: string,
): OrderReferenceResolution {
  const message =
    normalize(
      rawMessage,
    );

  if (!orders.length) {
    return {
      status:
        "not_found",

      order:
        null,

      candidates:
        [],

      reason:
        "El cliente no tiene pedidos registrados.",
    };
  }

  const dateAndStatusMatches =
    orders
      .filter(
        (order) =>
          matchesDate(
            order,
            message,
          ),
      )
      .filter(
        (order) =>
          matchesStatus(
            order,
            message,
          ),
      );

  const amountReferences =
    extractAmountReferences(
      rawMessage,
    );

  if (amountReferences.length) {
    const amountMatches =
      dateAndStatusMatches.filter(
        (order) =>
          matchesAmountReference(
            order,
            amountReferences,
          ),
      );

    if (
      amountMatches.length === 1
    ) {
      return {
        status:
          "resolved",

        order:
          amountMatches[0],

        candidates:
          amountMatches,

        reason:
          `Pedido identificado por importe ${amountReferences.join(
            " / ",
          )}.`,
      };
    }

    if (
      amountMatches.length > 1
    ) {
      return {
        status:
          "ambiguous",

        order:
          null,

        candidates:
          amountMatches,

        reason:
          "Más de un pedido coincide con el importe indicado.",
      };
    }

    return {
      status:
        "not_found",

      order:
        null,

      candidates:
        [],

      reason:
        `No existe un pedido que coincida con el importe ${amountReferences.join(
          " / ",
        )}.`,
    };
  }

  const amountExtreme =
    applyAmountExtreme(
      dateAndStatusMatches,
      message,
    );

  if (amountExtreme) {
    return {
      status:
        "resolved",

      order:
        amountExtreme,

      candidates:
        [amountExtreme],

      reason:
        "Pedido identificado por comparación de importe.",
    };
  }

  const numberMatches =
    orders.filter(
      (order) =>
        matchesNumber(
          order,
          message,
        ),
    );

  const dateMatches =
    numberMatches.filter(
      (order) =>
        matchesDate(
          order,
          message,
        ),
    );

  const statusMatches =
    dateMatches.filter(
      (order) =>
        matchesStatus(
          order,
          message,
        ),
    );

  const productMatches =
    statusMatches.filter(
      (order) =>
        matchesProductTerms(
          order,
          message,
        ),
    );

  const ordinal =
    applyOrdinal(
      productMatches,
      message,
    );

  if (ordinal) {
    return {
      status:
        "resolved",

      order:
        ordinal,

      candidates:
        [ordinal],

      reason:
        "Referencia ordinal resuelta.",
    };
  }

  if (
    productMatches.length === 1
  ) {
    return {
      status:
        "resolved",

      order:
        productMatches[0],

      candidates:
        productMatches,

      reason:
        "Coincidencia única.",
    };
  }

  if (
    productMatches.length > 1
  ) {
    return {
      status:
        "ambiguous",

      order:
        null,

      candidates:
        productMatches,

      reason:
        "La referencia coincide con varios pedidos.",
    };
  }

  return {
    status:
      "not_found",

    order:
      null,

    candidates:
      [],

    reason:
      "Ningún pedido coincide con la referencia.",
  };
}

export async function resolveCustomerOrderReference(
  companyId: string,
  phone: string,
  message: string,
) {
  const orders =
    await listCustomerOrdersByPhone(
      companyId,
      phone,
    );

  return resolveOrderReference(
    orders,
    message,
  );
}
