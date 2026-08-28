import {
  upsertCustomerMemory,
} from "./customer-memory.repository.js";

import {
  recordCustomerInterestEvents,
  type CustomerInterestEvent,
} from "../interests/customer-interest.repository.js";

const colors = [
  "negro",
  "negra",
  "blanco",
  "blanca",
  "azul",
  "rojo",
  "roja",
  "verde",
  "beige",
  "gris",
  "marrón",
  "marron",
  "rosa",
  "violeta",
  "amarillo",
  "amarilla",
];

const explicitSizePattern =
  /\b(?:talle|talla|size)\s*[:#-]?\s*(xs|s|m|l|xl|xxl|xxxl|3xl|4xl|(?:2[6-9]|[3-5]\d|60))\b/gi;

const numericSizePattern =
  /\b(?:2[6-9]|[3-5]\d|60)\b/g;

function normalizeText(
  input: string,
) {
  return input
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase();
}

function unique(
  values: string[],
) {
  return Array.from(
    new Set(
      values.filter(Boolean),
    ),
  );
}

function detectColors(
  message: string,
) {
  const normalized =
    normalizeText(message);

  return unique(
    colors
      .map(
        (color) =>
          normalizeText(color),
      )
      .filter(
        (color) =>
          new RegExp(
            `\\b${color}\\b`,
            "i",
          ).test(
            normalized,
          ),
      )
      .map(
        (color) => {
          if (
            color === "negra"
          ) {
            return "negro";
          }

          if (
            color === "blanca"
          ) {
            return "blanco";
          }

          if (
            color === "roja"
          ) {
            return "rojo";
          }

          if (
            color === "amarilla"
          ) {
            return "amarillo";
          }

          if (
            color === "marron"
          ) {
            return "marrón";
          }

          return color;
        },
      ),
  );
}

function detectSizes(
  message: string,
) {
  const found:
    string[] = [];

  for (
    const match
    of message.matchAll(
      explicitSizePattern,
    )
  ) {
    const size =
      match[1]
        ?.toUpperCase();

    if (size) {
      found.push(size);
    }
  }

  for (
    const match
    of message.matchAll(
      numericSizePattern,
    )
  ) {
    const size =
      match[0]
        ?.toUpperCase();

    if (size) {
      found.push(size);
    }
  }

  return unique(
    found,
  );
}

function detectProductInterest(
  message: string,
) {
  const normalized =
    normalizeText(message);

  const products = [
    [
      "jean",
      /\bjeans?\b/,
    ],

    [
      "pantalón",
      /\bpantalones?\b/,
    ],

    [
      "camisa",
      /\bcamisas?\b/,
    ],

    [
      "camiseta",
      /\bcamisetas?\b|\bremeras?\b/,
    ],

    [
      "vestido",
      /\bvestidos?\b/,
    ],

    [
      "chaqueta",
      /\bchaquetas?\b|\bcamperas?\b/,
    ],

    [
      "short",
      /\bshorts?\b/,
    ],

    [
      "falda",
      /\bfaldas?\b/,
    ],

    [
      "buzo",
      /\bbuzos?\b|\bsudaderas?\b/,
    ],
  ] as const;

  return unique(
    products
      .filter(
        (
          [, pattern],
        ) =>
          pattern.test(
            normalized,
          ),
      )
      .map(
        ([name]) =>
          name,
      ),
  );
}

function detectRejectionReason(
  normalized: string,
) {
  if (
    /\b(caro|cara|costoso|costosa|precio alto|muy alto)\b/
      .test(normalized)
  ) {
    return "precio";
  }

  if (
    /\b(no hay mi talla|sin talla|no tienes mi talla|no tienen mi talla)\b/
      .test(normalized)
  ) {
    return "talla";
  }

  if (
    /\b(no me gusta el color|otro color|ese color no)\b/
      .test(normalized)
  ) {
    return "color";
  }

  if (
    /\b(no me gusta|ese no|esa no|otro modelo|otra opcion)\b/
      .test(normalized)
  ) {
    return "diseño";
  }

  if (
    /\b(agotado|sin stock|no hay disponible)\b/
      .test(normalized)
  ) {
    return "stock";
  }

  return null;
}

export async function extractAndStoreMemory(
  input: {
    phone: string;
    message: string;
    companyId?: string;
    messageId?: string;
  },
) {
  const normalized =
    normalizeText(
      input.message,
    );

  const colorsFound =
    detectColors(
      input.message,
    );

  const sizesFound =
    detectSizes(
      input.message,
    );

  const productsFound =
    detectProductInterest(
      input.message,
    );

  const events:
    CustomerInterestEvent[] = [];

  for (
    const color
    of colorsFound
  ) {
    events.push({
      contact_phone:
        input.phone,

      event_type:
        "color_mentioned",

      value:
        color,

      color_name:
        color,

      confidence:
        86,

      source:
        "message_analysis",

      message_id:
        input.messageId
        ?? null,
    });
  }

  for (
    const size
    of sizesFound
  ) {
    events.push({
      contact_phone:
        input.phone,

      event_type:
        "size_mentioned",

      value:
        size,

      size_value:
        size,

      confidence:
        92,

      source:
        "message_analysis",

      message_id:
        input.messageId
        ?? null,
    });
  }

  for (
    const product
    of productsFound
  ) {
    events.push({
      contact_phone:
        input.phone,

      event_type:
        "product_mentioned",

      value:
        product,

      product_name:
        product,

      confidence:
        82,

      source:
        "message_analysis",

      message_id:
        input.messageId
        ?? null,
    });
  }

  if (
    /\b(precio|cuanto|cuánto|valor|sale)\b/
      .test(
        normalized,
      )
  ) {
    events.push({
      contact_phone:
        input.phone,

      event_type:
        "price_objection",

      value:
        "precio",

      confidence:
        72,

      source:
        "message_analysis",

      message_id:
        input.messageId
        ?? null,
    });
  }

  if (
    /\b(comprar|quiero llevar|me llevo|confirmo|hacer pedido|armame el pedido)\b/
      .test(
        normalized,
      )
  ) {
    events.push({
      contact_phone:
        input.phone,

      event_type:
        "purchase_intent",

      value:
        "alta",

      confidence:
        90,

      source:
        "message_analysis",

      message_id:
        input.messageId
        ?? null,
    });
  }

  const rejectionReason =
    detectRejectionReason(
      normalized,
    );

  if (rejectionReason) {
    events.push({
      contact_phone:
        input.phone,

      event_type:
        "product_rejected",

      reason:
        rejectionReason,

      value:
        rejectionReason,

      confidence:
        82,

      source:
        "message_analysis",

      message_id:
        input.messageId
        ?? null,
    });
  }

  if (events.length) {
    await recordCustomerInterestEvents(
      events,
      input.companyId,
    );
  }

  const memoryWrites = [];

  if (colorsFound.length) {
    memoryWrites.push(
      upsertCustomerMemory(
        {
          contact_phone:
            input.phone,

          key:
            "colores_preferidos",

          value:
            colorsFound.join(", "),

          confidence:
            82,

          source:
            "message_analysis",

          metadata: {
            values:
              colorsFound,
          },
        },
        input.companyId,
      ),
    );
  }

  if (sizesFound.length) {
    memoryWrites.push(
      upsertCustomerMemory(
        {
          contact_phone:
            input.phone,

          key:
            "talles_preferidos",

          value:
            sizesFound.join(", "),

          confidence:
            90,

          source:
            "message_analysis",

          metadata: {
            values:
              sizesFound,
          },
        },
        input.companyId,
      ),
    );
  }

  if (productsFound.length) {
    memoryWrites.push(
      upsertCustomerMemory(
        {
          contact_phone:
            input.phone,

          key:
            "productos_de_interes",

          value:
            productsFound.join(", "),

          confidence:
            80,

          source:
            "message_analysis",

          metadata: {
            values:
              productsFound,
          },
        },
        input.companyId,
      ),
    );
  }

  if (
    /\b(mayorista|por mayor)\b/
      .test(normalized)
  ) {
    memoryWrites.push(
      upsertCustomerMemory(
        {
          contact_phone:
            input.phone,

          key:
            "tipo_cliente",

          value:
            "mayorista",

          confidence:
            92,

          source:
            "message_analysis",
        },
        input.companyId,
      ),
    );
  }

  if (rejectionReason) {
    memoryWrites.push(
      upsertCustomerMemory(
        {
          contact_phone:
            input.phone,

          key:
            "ultima_objecion",

          value:
            rejectionReason,

          confidence:
            82,

          source:
            "message_analysis",
        },
        input.companyId,
      ),
    );
  }

  await Promise.all(
    memoryWrites,
  );

  return {
    events,
    memories:
      memoryWrites.length,
  };
}
