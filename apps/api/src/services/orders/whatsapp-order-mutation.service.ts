import crypto from "node:crypto";

import {
  listProducts,
  searchProducts,
  type CatalogItem,
} from "../catalog/catalog.repository.js";

import {
  getConversationByPhone,
  updateConversationMetadata,
} from "../conversations/conversation.repository.js";

import {
  getOrder,
  listCustomerOrdersByPhone,
  mutateOrder,
  type OrderMutationOperation,
} from "./order.service.js";

import {
  describeCustomerOrder,
} from "./order-answer.service.js";

import {
  resolveOrderReference,
  type CustomerOrder,
} from "./order-reference.service.js";

import {
  interpretOrderCommand,
} from "./order-command-interpreter.service.js";

import {
  buildOrderInterpreterContext,
} from "./order-interpreter-context.service.js";

import type {
  InterpretedOrderCommand,
} from "./order-command.types.js";

/**
 * Este servicio NO crea pedidos.
 *
 * Su única responsabilidad es modificar pedidos existentes de manera:
 *
 * - explícita;
 * - confirmada;
 * - idempotente;
 * - validada contra catálogo;
 * - protegida por versión;
 * - reconstruida desde la base real.
 */

const MUTATION_EXPIRATION_MINUTES = 15;

type MutationKind =
  | "add_item"
  | "set_quantity"
  | "remove_item"
  | "replace_variant";

type PendingMutation = {
  status:
    | "awaiting_confirmation"
    | "executing"
    | "completed"
    | "cancelled"
    | "expired"
    | "failed";

  kind: MutationKind;

  companyId: string;
  phone: string;

  orderId: string;
  orderNumber: string;
  expectedVersion: number;

  operations: OrderMutationOperation[];

  summary: string;

  sourceMessage: string;
  sourceMessageId: string;

  fingerprint: string;

  createdAt: string;
  updatedAt: string;
  expiresAt: string;

  resultOrderId?: string;
  resultOrderNumber?: string;

  errorCode?: string;
};

type MutationWorkflowMetadata = {
  order_mutation_workflow?: PendingMutation | null;
};

type MutationHandlerResult = {
  handled: boolean;
  text?: string;
};

type ParsedMutationMetadata = {
  /**
   * Define cómo interpretar quantity cuando la solicitud
   * proviene del intérprete semántico.
   *
   * absolute:
   *   "dejame 5"
   *
   * increment:
   *   "sumale 3 más"
   *
   * decrement:
   *   "sacame 2"
   */
  quantityBehavior?:
    | "absolute"
    | "increment"
    | "decrement";

  /**
   * Confianza del intérprete semántico.
   * Nunca autoriza por sí sola una operación.
   */
  semanticConfidence?: number;
};

type ParsedMutationRequest =
  (
    | {
        kind: "add_item";
        quantity: number;
        searchText: string;
      }
    | {
        kind: "set_quantity";
        quantity: number;
        lineReference: string;
      }
    | {
        kind: "remove_item";
        lineReference: string;
      }
    | {
        kind: "replace_variant";
        quantity?: number;
        currentReference: string;
        replacementReference: string;
      }
  )
  & ParsedMutationMetadata;

function normalize(
  value: unknown,
): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function collapseSpaces(
  value: string,
): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function hash(
  value: string,
): string {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

function asObject(
  value: unknown,
): Record<string, unknown> {
  return (
    value
    && typeof value === "object"
    && !Array.isArray(value)
  )
    ? value as Record<string, unknown>
    : {};
}

function asItems(
  order: CustomerOrder,
): Array<Record<string, unknown>> {
  return Array.isArray(order.items)
    ? order.items
    : [];
}

function workflowFromMetadata(
  metadata: unknown,
): PendingMutation | null {
  const object =
    asObject(metadata);

  const value =
    object.order_mutation_workflow;

  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    return null;
  }

  return value as PendingMutation;
}

function isExpired(
  workflow: PendingMutation,
): boolean {
  const expiresAt =
    new Date(workflow.expiresAt);

  return (
    Number.isNaN(expiresAt.getTime())
    || expiresAt.getTime() <= Date.now()
  );
}

function confirmationIntent(
  message: string,
): "confirm" | "cancel" | "none" {
  const normalized =
    normalize(message);

  const confirmPatterns = [
    /^si$/,
    /^sí$/,
    /^confirmo$/,
    /^confirmar$/,
    /^dale$/,
    /^listo$/,
    /^ok$/,
    /^correcto$/,
    /^hacelo$/,
    /^hazlo$/,
    /^proceder$/,
    /^procede$/,
    /^si confirmo$/,
    /^confirmado$/,
  ];

  if (
    confirmPatterns.some(
      (pattern) =>
        pattern.test(normalized),
    )
  ) {
    return "confirm";
  }

  const cancelPatterns = [
    /^no$/,
    /^cancelar$/,
    /^cancela$/,
    /^dejalo$/,
    /^déjalo$/,
    /^olvidalo$/,
    /^olvídalo$/,
    /^mejor no$/,
    /^no confirmo$/,
    /^anular$/,
  ];

  if (
    cancelPatterns.some(
      (pattern) =>
        pattern.test(normalized),
    )
  ) {
    return "cancel";
  }

  return "none";
}

const SPANISH_SMALL_NUMBERS: Record<string, number> = {
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
};

const SPANISH_TENS: Record<string, number> = {
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
};

function spanishNumberValue(
  rawValue: string | undefined,
): number | null {
  if (!rawValue) {
    return null;
  }

  const value =
    normalize(rawValue);

  if (/^\d+$/.test(value)) {
    const parsed =
      Number(value);

    return Number.isSafeInteger(parsed)
      ? parsed
      : null;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      SPANISH_SMALL_NUMBERS,
      value,
    )
  ) {
    return SPANISH_SMALL_NUMBERS[value]
      ?? null;
  }

  const words =
    value
      .split(" ")
      .filter(
        (word) =>
          word !== "y",
      );

  if (
    words.length === 2
    && Object.prototype.hasOwnProperty.call(
      SPANISH_TENS,
      words[0] ?? "",
    )
    && Object.prototype.hasOwnProperty.call(
      SPANISH_SMALL_NUMBERS,
      words[1] ?? "",
    )
  ) {
    return (
      SPANISH_TENS[words[0] ?? ""]
      + SPANISH_SMALL_NUMBERS[words[1] ?? ""]
    );
  }

  return null;
}

function normalizeSpokenNumbers(
  rawMessage: string,
): string {
  let message =
    collapseSpaces(
      normalize(rawMessage),
    );

  const compoundPatterns = [
    "noventa y nueve",
    "noventa y ocho",
    "noventa y siete",
    "noventa y seis",
    "noventa y cinco",
    "noventa y cuatro",
    "noventa y tres",
    "noventa y dos",
    "noventa y uno",
    "ochenta y nueve",
    "ochenta y ocho",
    "ochenta y siete",
    "ochenta y seis",
    "ochenta y cinco",
    "ochenta y cuatro",
    "ochenta y tres",
    "ochenta y dos",
    "ochenta y uno",
    "setenta y nueve",
    "setenta y ocho",
    "setenta y siete",
    "setenta y seis",
    "setenta y cinco",
    "setenta y cuatro",
    "setenta y tres",
    "setenta y dos",
    "setenta y uno",
    "sesenta y nueve",
    "sesenta y ocho",
    "sesenta y siete",
    "sesenta y seis",
    "sesenta y cinco",
    "sesenta y cuatro",
    "sesenta y tres",
    "sesenta y dos",
    "sesenta y uno",
    "cincuenta y nueve",
    "cincuenta y ocho",
    "cincuenta y siete",
    "cincuenta y seis",
    "cincuenta y cinco",
    "cincuenta y cuatro",
    "cincuenta y tres",
    "cincuenta y dos",
    "cincuenta y uno",
    "cuarenta y nueve",
    "cuarenta y ocho",
    "cuarenta y siete",
    "cuarenta y seis",
    "cuarenta y cinco",
    "cuarenta y cuatro",
    "cuarenta y tres",
    "cuarenta y dos",
    "cuarenta y uno",
    "treinta y nueve",
    "treinta y ocho",
    "treinta y siete",
    "treinta y seis",
    "treinta y cinco",
    "treinta y cuatro",
    "treinta y tres",
    "treinta y dos",
    "treinta y uno",
    "veintinueve",
    "veintiocho",
    "veintisiete",
    "veintiseis",
    "veinticinco",
    "veinticuatro",
    "veintitres",
    "veintidos",
    "veintiuno",
  ];

  for (const phrase of compoundPatterns) {
    const number =
      spanishNumberValue(phrase);

    if (number === null) {
      continue;
    }

    message =
      message.replace(
        new RegExp(
          `\\b${phrase.replace(/ /g, "\\s+")}\\b`,
          "g",
        ),
        String(number),
      );
  }

  const simpleWords = Object.keys(
    SPANISH_SMALL_NUMBERS,
  ).sort(
    (a, b) =>
      b.length - a.length,
  );

  for (const word of simpleWords) {
    message =
      message.replace(
        new RegExp(
          `\\b${word}\\b`,
          "g",
        ),
        String(
          SPANISH_SMALL_NUMBERS[word],
        ),
      );
  }

  return collapseSpaces(message);
}

function parseInteger(
  value: string | undefined,
): number | null {
  if (!value) {
    return null;
  }

  const number =
    Number(value);

  return (
    Number.isInteger(number)
    && number >= 0
  )
    ? number
    : null;
}

function looksLikeMutation(
  message: string,
): boolean {
  const normalized =
    normalizeSpokenNumbers(
      message,
    )
      .replace(
        /\bagregable\b/g,
        "agregale",
      )
      .replace(
        /\bagregarle\b/g,
        "agregale",
      );

  return [
    /\bagrega(?:r|le)?\b/,
    /\bagregale\b/,
    /\bagregame\b/,
    /\bsuma(?:r|le)?\b/,
    /\bañadi(?:r|le)?\b/,
    /\bmete(?:r|le)?\b/,
    /\bdeja(?:r|me)?\b/,
    /\bcambia(?:r|me)?\b/,
    /\breemplaza(?:r|me)?\b/,
    /\bquita(?:r|me)?\b/,
    /\bsaca(?:r|me)?\b/,
    /\belimina(?:r)?\b/,
    /\bborra(?:r)?\b/,
  ].some(
    (pattern) =>
      pattern.test(normalized),
  );
}

function parseMutationRequest(
  rawMessage: string,
): ParsedMutationRequest | null {
  const message =
    normalizeSpokenNumbers(
      rawMessage,
    )
      .replace(
        /\bagregable\b/g,
        "agregale",
      )
      .replace(
        /\bagregarle\b/g,
        "agregale",
      )
      .replace(
        /\bmetele\b/g,
        "agregale",
      )
      .replace(
        /\btalles\b/g,
        "talle",
      );

  /**
   * Ejemplos:
   *
   * - agregale 3 jean negro talle 40
   * - sumale 2 talle 38
   * - mete 5 negros
   */
  const addMatch =
    message.match(
      /(?:agrega(?:r|le)?|suma(?:r|le)?|anadi(?:r|le)?|mete(?:r|le)?)\s+(\d+)\s+(.+)/,
    );

  if (addMatch) {
    const quantity =
      parseInteger(addMatch[1]);

    const searchText =
      collapseSpaces(
        addMatch[2] ?? "",
      );

    if (
      quantity
      && quantity > 0
      && searchText
    ) {
      return {
        kind:
          "add_item",

        quantity,

        searchText,
      };
    }
  }

  /**
   * Ejemplos:
   *
   * - dejame 5 del talle 38
   * - cambia la cantidad del negro a 8
   * - poneme 4 del jean azul
   */
  const setMatch =
    message.match(
      /(?:deja(?:r|me)?|pone(?:r|me)?|cambia(?:r)?(?:\s+la)?\s+cantidad(?:\s+de)?)\s+(\d+)\s+(?:de|del|de la)?\s*(.+)/,
    );

  if (setMatch) {
    const quantity =
      parseInteger(setMatch[1]);

    const lineReference =
      collapseSpaces(
        setMatch[2] ?? "",
      );

    if (
      quantity !== null
      && lineReference
    ) {
      return {
        kind:
          "set_quantity",

        quantity,

        lineReference,
      };
    }
  }

  /**
   * Ejemplos:
   *
   * - quitame el talle 44
   * - elimina los negros
   * - saca el jean azul
   */
  const removeMatch =
    message.match(
      /(?:quita(?:r|me)?|saca(?:r|me)?|elimina(?:r)?|borra(?:r)?)\s+(?:el|la|los|las|del pedido)?\s*(.+)/,
    );

  if (removeMatch) {
    const lineReference =
      collapseSpaces(
        removeMatch[1] ?? "",
      );

    if (lineReference) {
      return {
        kind:
          "remove_item",

        lineReference,
      };
    }
  }

  /**
   * Ejemplos:
   *
   * - cambia el talle 38 por talle 40
   * - reemplaza el negro por azul
   * - cambia 3 del talle 38 por talle 44
   */
  const replaceMatch =
    message.match(
      /(?:cambia(?:r|me)?|reemplaza(?:r|me)?)\s+(?:(\d+)\s+)?(.+?)\s+(?:por|a)\s+(.+)/,
    );

  if (replaceMatch) {
    const quantity =
      parseInteger(
        replaceMatch[1],
      );

    const currentReference =
      collapseSpaces(
        replaceMatch[2] ?? "",
      );

    const replacementReference =
      collapseSpaces(
        replaceMatch[3] ?? "",
      );

    if (
      currentReference
      && replacementReference
    ) {
      return {
        kind:
          "replace_variant",

        quantity:
          quantity
          ?? undefined,

        currentReference,

        replacementReference,
      };
    }
  }

  return null;
}

function isMutableOrder(
  order: CustomerOrder,
): boolean {
  return (
    order.commercial_status
      !== "cancelled"
    && order.payment_status
      === "unpaid"
    && order.fulfillment_status
      === "pending"
    && order.reservation_status
      === "active"
  );
}

function orderNumber(
  order: CustomerOrder,
): string {
  return String(
    order.number
    ?? order.id
    ?? "sin número",
  );
}

function selectTargetOrder(
  orders: CustomerOrder[],
  message: string,
): {
  order: CustomerOrder | null;
  candidates: CustomerOrder[];
  reason: string;
} {
  const mutable =
    orders.filter(
      isMutableOrder,
    );

  if (!mutable.length) {
    return {
      order:
        null,

      candidates:
        [],

      reason:
        "NO_MUTABLE_ORDER",
    };
  }

  const resolved =
    resolveOrderReference(
      mutable,
      message,
    );

  if (
    resolved.status
      === "resolved"
    && resolved.order
  ) {
    return {
      order:
        resolved.order,

      candidates:
        [resolved.order],

      reason:
        "REFERENCE_RESOLVED",
    };
  }

  if (mutable.length === 1) {
    return {
      order:
        mutable[0],

      candidates:
        mutable,

      reason:
        "ONLY_MUTABLE_ORDER",
    };
  }

  return {
    order:
      null,

    candidates:
      resolved.candidates.length
        ? resolved.candidates
        : mutable,

    reason:
      "AMBIGUOUS_ORDER",
  };
}

function itemSearchText(
  item: Record<string, unknown>,
): string {
  return normalize(
    [
      item.sku_snapshot,
      item.product_name_snapshot,
      item.color_name_snapshot,
      item.size_snapshot,
      item.size_snapshot
        ? `talle ${String(item.size_snapshot)}`
        : null,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function findOrderItem(
  order: CustomerOrder,
  reference: string,
): {
  item: Record<string, unknown> | null;
  candidates: Array<Record<string, unknown>>;
} {
  const normalizedReference =
    normalize(reference);

  const words =
    normalizedReference
      .split(" ")
      .filter(
        (word) =>
          word.length >= 2,
      );

  const scored =
    asItems(order)
      .map(
        (item) => {
          const searchable =
            itemSearchText(item);

          const score =
            words.reduce(
              (
                total,
                word,
              ) =>
                total
                + (
                  searchable.includes(word)
                    ? 1
                    : 0
                ),
              0,
            );

          return {
            item,
            score,
          };
        },
      )
      .filter(
        (candidate) =>
          candidate.score > 0,
      )
      .sort(
        (a, b) =>
          b.score - a.score,
      );

  if (!scored.length) {
    return {
      item:
        null,

      candidates:
        [],
    };
  }

  if (
    scored.length > 1
    && scored[0]?.score
      === scored[1]?.score
  ) {
    return {
      item:
        null,

      candidates:
        scored.map(
          (candidate) =>
            candidate.item,
        ),
    };
  }

  return {
    item:
      scored[0]?.item
      ?? null,

    candidates:
      scored.map(
        (candidate) =>
          candidate.item,
      ),
  };
}

function catalogSearchText(
  item: CatalogItem,
): string {
  return normalize(
    [
      item.name,
      item.sku,
      item.color,
      item.size,
      item.size
        ? `talle ${item.size}`
        : null,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

async function findCatalogVariant(
  companyId: string,
  reference: string,
): Promise<{
  item: CatalogItem | null;
  candidates: CatalogItem[];
}> {
  const searched =
    await searchProducts(
      reference,
      companyId,
    );

  const fallback =
    searched.length
      ? searched
      : await listProducts(
          companyId,
        );

  const words =
    normalize(reference)
      .split(" ")
      .filter(
        (word) =>
          word.length >= 2,
      );

  const scored =
    fallback
      .filter(
        (item) =>
          Boolean(
            item.variantId,
          ),
      )
      .map(
        (item) => {
          const searchable =
            catalogSearchText(item);

          const score =
            words.reduce(
              (
                total,
                word,
              ) =>
                total
                + (
                  searchable.includes(word)
                    ? 1
                    : 0
                ),
              0,
            );

          return {
            item,
            score,
          };
        },
      )
      .filter(
        (candidate) =>
          candidate.score > 0,
      )
      .sort(
        (a, b) =>
          b.score - a.score,
      );

  if (!scored.length) {
    return {
      item:
        null,

      candidates:
        [],
    };
  }

  if (
    scored.length > 1
    && scored[0]?.score
      === scored[1]?.score
  ) {
    return {
      item:
        null,

      candidates:
        scored
          .slice(0, 5)
          .map(
            (candidate) =>
              candidate.item,
          ),
    };
  }

  return {
    item:
      scored[0]?.item
      ?? null,

    candidates:
      scored
        .slice(0, 5)
        .map(
          (candidate) =>
            candidate.item,
        ),
  };
}

function describeItem(
  item: Record<string, unknown>,
): string {
  return [
    item.product_name_snapshot,
    item.color_name_snapshot,
    item.size_snapshot
      ? `talle ${String(item.size_snapshot)}`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function describeCatalogItem(
  item: CatalogItem,
): string {
  return [
    item.name,
    item.color,
    item.size
      ? `talle ${item.size}`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function describeCandidates(
  orders: CustomerOrder[],
): string {
  return orders
    .slice(0, 5)
    .map(
      (order) =>
        `• ${describeCustomerOrder(order)}`,
    )
    .join("\n");
}

function describeItemCandidates(
  items: Array<Record<string, unknown>>,
): string {
  return items
    .slice(0, 5)
    .map(
      (item) =>
        `• ${Number(item.quantity ?? 0)} × ${describeItem(item)}`,
    )
    .join("\n");
}

function describeVariantCandidates(
  items: CatalogItem[],
): string {
  return items
    .slice(0, 5)
    .map(
      (item) =>
        `• ${describeCatalogItem(item)} — disponibles: ${item.stock}`,
    )
    .join("\n");
}

function buildFingerprint(
  input: {
    companyId: string;
    orderId: string;
    expectedVersion: number;
    operations: OrderMutationOperation[];
    sourceMessageId: string;
  },
): string {
  return hash(
    JSON.stringify({
      companyId:
        input.companyId,

      orderId:
        input.orderId,

      expectedVersion:
        input.expectedVersion,

      operations:
        input.operations,

      sourceMessageId:
        input.sourceMessageId,
    }),
  );
}

function buildIdempotencyKey(
  workflow: PendingMutation,
): string {
  return [
    "wa-order-mutation",
    workflow.companyId,
    workflow.orderId,
    workflow.sourceMessageId,
    workflow.fingerprint.slice(0, 24),
  ].join(":");
}

function errorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function customerMutationError(
  error: unknown,
): string {
  const message =
    errorMessage(error);

  if (
    message.includes(
      "ORDER_VERSION_CONFLICT",
    )
  ) {
    return (
      "El pedido cambió mientras confirmabas. "
      + "Volvé a indicar el cambio para trabajar con la versión actual."
    );
  }

  if (
    message.includes(
      "INSUFFICIENT_STOCK",
    )
  ) {
    return (
      "El stock cambió y ya no alcanza para completar ese cambio. "
      + "No modifiqué el pedido."
    );
  }

  if (
    message.includes(
      "ORDER_ALREADY_CANCELLED",
    )
  ) {
    return (
      "Ese pedido ya está cancelado y no puede modificarse."
    );
  }

  if (
    message.includes(
      "PAID_OR_PARTIAL_ORDER_CANNOT_BE_MODIFIED",
    )
  ) {
    return (
      "Ese pedido ya tiene un pago registrado. "
      + "Por seguridad no puedo modificar sus productos automáticamente."
    );
  }

  if (
    message.includes(
      "ORDER_ALREADY_IN_FULFILLMENT",
    )
  ) {
    return (
      "Ese pedido ya entró en preparación y no puede modificarse automáticamente."
    );
  }

  if (
    message.includes(
      "ORDER_RESERVATION_NOT_ACTIVE",
    )
  ) {
    return (
      "La reserva de ese pedido ya no está activa. No hice ningún cambio."
    );
  }

  if (
    message.includes(
      "ORDER_CANNOT_BE_EMPTY",
    )
  ) {
    return (
      "No puedo quitar la última línea porque el pedido quedaría vacío. "
      + "Podés cancelar el pedido completo."
    );
  }

  if (
    message.includes(
      "IDEMPOTENCY_CONFLICT",
    )
  ) {
    return (
      "Detecté una confirmación repetida con datos diferentes. "
      + "No ejecuté el cambio por seguridad."
    );
  }

  return (
    "No pude modificar el pedido. "
    + "No se aplicó ningún cambio parcial."
  );
}

async function saveWorkflow(
  phone: string,
  companyId: string,
  workflow: PendingMutation | null,
) {
  await updateConversationMetadata(
    phone,
    {
      order_mutation_workflow:
        workflow,
    },
    companyId,
  );
}


function semanticSearchText(
  reference:
    | InterpretedOrderCommand["currentProduct"]
    | InterpretedOrderCommand["replacementProduct"],
): string {
  if (!reference) {
    return "";
  }

  return [
    reference.name,
    reference.category,
    reference.sku,
    reference.color,
    reference.size
      ? `talle ${reference.size}`
      : null,
    reference.contextualReference,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function semanticToParsedRequest(
  command: InterpretedOrderCommand,
): ParsedMutationRequest | null {
  const currentReference =
    semanticSearchText(
      command.currentProduct,
    );

  const replacementReference =
    semanticSearchText(
      command.replacementProduct,
    );

  const confidence =
    command.confidence;

  if (
    confidence < 0.62
    && !command.requiresClarification
  ) {
    return null;
  }

  if (
    command.action
      === "add_item"
  ) {
    if (
      !command.quantity
      || !currentReference
    ) {
      return null;
    }

    return {
      kind:
        "add_item",

      quantity:
        command.quantity,

      searchText:
        currentReference,

      quantityBehavior:
        "increment",

      semanticConfidence:
        confidence,
    };
  }

  if (
    command.action
      === "increase_quantity"
  ) {
    if (
      !command.quantity
      || !currentReference
    ) {
      return null;
    }

    return {
      kind:
        "set_quantity",

      quantity:
        command.quantity,

      lineReference:
        currentReference,

      quantityBehavior:
        "increment",

      semanticConfidence:
        confidence,
    };
  }

  if (
    command.action
      === "set_quantity"
  ) {
    if (
      !command.quantity
      || !currentReference
    ) {
      return null;
    }

    return {
      kind:
        "set_quantity",

      quantity:
        command.quantity,

      lineReference:
        currentReference,

      quantityBehavior:
        "absolute",

      semanticConfidence:
        confidence,
    };
  }

  if (
    command.action
      === "decrease_quantity"
  ) {
    if (
      !command.quantity
      || !currentReference
    ) {
      return null;
    }

    return {
      kind:
        "set_quantity",

      quantity:
        command.quantity,

      lineReference:
        currentReference,

      quantityBehavior:
        "decrement",

      semanticConfidence:
        confidence,
    };
  }

  if (
    command.action
      === "remove_item"
  ) {
    if (!currentReference) {
      return null;
    }

    return {
      kind:
        "remove_item",

      lineReference:
        currentReference,

      semanticConfidence:
        confidence,
    };
  }

  if (
    command.action
      === "replace_variant"
  ) {
    if (
      !currentReference
      || !replacementReference
    ) {
      return null;
    }

    return {
      kind:
        "replace_variant",

      quantity:
        command.quantity,

      currentReference,

      replacementReference,

      semanticConfidence:
        confidence,
    };
  }

  return null;
}

async function prepareMutation(
  input: {
    companyId: string;
    phone: string;
    message: string;
    sourceMessageId: string;
  },
  request: ParsedMutationRequest,
): Promise<MutationHandlerResult> {
  const orders =
    await listCustomerOrdersByPhone(
      input.companyId,
      input.phone,
    ) as CustomerOrder[];

  const selectedOrder =
    selectTargetOrder(
      orders,
      input.message,
    );

  if (!selectedOrder.order) {
    if (
      selectedOrder.reason
      === "NO_MUTABLE_ORDER"
    ) {
      return {
        handled:
          true,

        text:
          "No tenés un pedido pendiente que pueda modificarse. "
          + "Los pedidos pagados, cancelados o ya preparados quedan protegidos.",
      };
    }

    return {
      handled:
        true,

      text: [
        "Tenés más de un pedido pendiente. Indicame cuál querés modificar:",
        "",
        describeCandidates(
          selectedOrder.candidates,
        ),
        "",
        "Podés responder con el número del pedido.",
      ].join("\n"),
    };
  }

  const order =
    selectedOrder.order;

  const orderId =
    String(
      order.id
      ?? "",
    );

  const version =
    Number(
      order.version
      ?? 0,
    );

  if (
    !orderId
    || !Number.isInteger(version)
    || version < 1
  ) {
    return {
      handled:
        true,

      text:
        "No pude obtener una versión válida del pedido. No hice ningún cambio.",
    };
  }

  let operations:
    OrderMutationOperation[] = [];

  let summary =
    "";

  if (
    request.kind
    === "add_item"
  ) {
    const resolved =
      await findCatalogVariant(
        input.companyId,
        request.searchText,
      );

    if (!resolved.item) {
      return {
        handled:
          true,

        text:
          resolved.candidates.length
            ? [
                "Encontré varias variantes posibles. Decime exactamente cuál:",
                "",
                describeVariantCandidates(
                  resolved.candidates,
                ),
              ].join("\n")
            : (
                "No encontré una variante exacta para agregar. "
                + "Indicame producto, color y talle."
              ),
      };
    }

    if (!resolved.item.variantId) {
      return {
        handled:
          true,

        text:
          "La variante seleccionada no tiene un identificador válido.",
      };
    }

    if (
      resolved.item.stock
      < request.quantity
    ) {
      return {
        handled:
          true,

        text:
          `${describeCatalogItem(resolved.item)}: `
          + `hay ${resolved.item.stock} disponibles y pediste ${request.quantity}.`,
      };
    }

    operations = [
      {
        type:
          "add_item",

        variant_id:
          resolved.item.variantId,

        quantity:
          request.quantity,
      },
    ];

    summary =
      `Agregar ${request.quantity} × `
      + `${describeCatalogItem(resolved.item)} `
      + `al pedido ${orderNumber(order)}.`;
  }

  if (
    request.kind
    === "set_quantity"
  ) {
    const resolved =
      findOrderItem(
        order,
        request.lineReference,
      );

    if (!resolved.item) {
      return {
        handled:
          true,

        text:
          resolved.candidates.length
            ? [
                "No pude identificar una única línea. Elegí una:",
                "",
                describeItemCandidates(
                  resolved.candidates,
                ),
              ].join("\n")
            : (
                "No encontré esa línea dentro del pedido pendiente."
              ),
      };
    }

    const itemId =
      String(
        resolved.item.id
        ?? "",
      );

    if (!itemId) {
      return {
        handled:
          true,

        text:
          "La línea seleccionada no tiene un identificador válido.",
      };
    }

    const currentQuantity =
      Number(
        resolved.item.quantity
        ?? 0,
      );

    if (
      !Number.isInteger(
        currentQuantity,
      )
      || currentQuantity <= 0
    ) {
      return {
        handled:
          true,

        text:
          "La cantidad actual de esa línea no es válida. No hice ningún cambio.",
      };
    }

    let finalQuantity =
      request.quantity;

    if (
      request.quantityBehavior
      === "increment"
    ) {
      finalQuantity =
        currentQuantity
        + request.quantity;
    }

    if (
      request.quantityBehavior
      === "decrement"
    ) {
      finalQuantity =
        currentQuantity
        - request.quantity;
    }

    if (
      !Number.isInteger(
        finalQuantity,
      )
    ) {
      return {
        handled:
          true,

        text:
          "No pude calcular una cantidad final válida. No hice ningún cambio.",
      };
    }

    if (finalQuantity < 0) {
      return {
        handled:
          true,

        text:
          `Actualmente hay ${currentQuantity} unidades de `
          + `${describeItem(resolved.item)} en el pedido. `
          + `No puedo quitar ${request.quantity}. `
          + "Decime cuántas querés dejar o pedime quitar la línea completa.",
      };
    }

    if (
      finalQuantity
      === currentQuantity
    ) {
      return {
        handled:
          true,

        text:
          `Esa línea ya tiene ${currentQuantity} unidades. `
          + "No hace falta modificar el pedido.",
      };
    }

    operations = [
      finalQuantity === 0
        ? {
            type:
              "remove_item",

            order_item_id:
              itemId,
          }
        : {
            type:
              "set_quantity",

            order_item_id:
              itemId,

            quantity:
              finalQuantity,
          },
    ];

    if (finalQuantity === 0) {
      summary =
        `Quitar ${describeItem(resolved.item)} `
        + `del pedido ${orderNumber(order)}.`;
    } else if (
      request.quantityBehavior
      === "increment"
    ) {
      summary =
        `Sumar ${request.quantity} unidades de `
        + `${describeItem(resolved.item)}: `
        + `pasar de ${currentQuantity} a ${finalQuantity} `
        + `en el pedido ${orderNumber(order)}.`;
    } else if (
      request.quantityBehavior
      === "decrement"
    ) {
      summary =
        `Quitar ${request.quantity} unidades de `
        + `${describeItem(resolved.item)}: `
        + `pasar de ${currentQuantity} a ${finalQuantity} `
        + `en el pedido ${orderNumber(order)}.`;
    } else {
      summary =
        `Dejar ${finalQuantity} × `
        + `${describeItem(resolved.item)} `
        + `en el pedido ${orderNumber(order)}.`;
    }
  }

  if (
    request.kind
    === "remove_item"
  ) {
    const resolved =
      findOrderItem(
        order,
        request.lineReference,
      );

    if (!resolved.item) {
      return {
        handled:
          true,

        text:
          resolved.candidates.length
            ? [
                "No pude identificar una única línea para quitar:",
                "",
                describeItemCandidates(
                  resolved.candidates,
                ),
              ].join("\n")
            : (
                "No encontré esa línea dentro del pedido."
              ),
      };
    }

    const itemId =
      String(
        resolved.item.id
        ?? "",
      );

    if (!itemId) {
      return {
        handled:
          true,

        text:
          "La línea seleccionada no tiene un identificador válido.",
      };
    }

    operations = [
      {
        type:
          "remove_item",

        order_item_id:
          itemId,
      },
    ];

    summary =
      `Quitar ${describeItem(resolved.item)} `
      + `del pedido ${orderNumber(order)}.`;
  }

  if (
    request.kind
    === "replace_variant"
  ) {
    const current =
      findOrderItem(
        order,
        request.currentReference,
      );

    if (!current.item) {
      return {
        handled:
          true,

        text:
          current.candidates.length
            ? [
                "No pude identificar una única línea para reemplazar:",
                "",
                describeItemCandidates(
                  current.candidates,
                ),
              ].join("\n")
            : (
                "No encontré en el pedido el producto que querés reemplazar."
              ),
      };
    }

    const replacement =
      await findCatalogVariant(
        input.companyId,
        request.replacementReference,
      );

    if (!replacement.item) {
      return {
        handled:
          true,

        text:
          replacement.candidates.length
            ? [
                "Encontré varias variantes de reemplazo. Elegí una:",
                "",
                describeVariantCandidates(
                  replacement.candidates,
                ),
              ].join("\n")
            : (
                "No encontré una variante exacta para el reemplazo."
              ),
      };
    }

    const itemId =
      String(
        current.item.id
        ?? "",
      );

    const replacementVariantId =
      replacement.item.variantId;

    const quantity =
      request.quantity
      ?? Number(
        current.item.quantity
        ?? 0,
      );

    if (
      !itemId
      || !replacementVariantId
      || !Number.isInteger(quantity)
      || quantity <= 0
    ) {
      return {
        handled:
          true,

        text:
          "Los datos del reemplazo no son válidos. No hice ningún cambio.",
      };
    }

    if (
      replacement.item.stock
      < quantity
    ) {
      return {
        handled:
          true,

        text:
          `${describeCatalogItem(replacement.item)}: `
          + `hay ${replacement.item.stock} disponibles `
          + `y el cambio necesita ${quantity}.`,
      };
    }

    operations = [
      {
        type:
          "replace_variant",

        order_item_id:
          itemId,

        new_variant_id:
          replacementVariantId,

        quantity,
      },
    ];

    summary =
      `Reemplazar ${quantity} × `
      + `${describeItem(current.item)} por `
      + `${describeCatalogItem(replacement.item)} `
      + `en el pedido ${orderNumber(order)}.`;
  }

  if (!operations.length) {
    return {
      handled:
        false,
    };
  }

  const now =
    new Date();

  const expiresAt =
    new Date(
      now.getTime()
      + MUTATION_EXPIRATION_MINUTES
        * 60
        * 1000,
    );

  const fingerprint =
    buildFingerprint({
      companyId:
        input.companyId,

      orderId,

      expectedVersion:
        version,

      operations,

      sourceMessageId:
        input.sourceMessageId,
    });

  const workflow:
    PendingMutation = {
    status:
      "awaiting_confirmation",

    kind:
      request.kind,

    companyId:
      input.companyId,

    phone:
      input.phone,

    orderId,

    orderNumber:
      orderNumber(order),

    expectedVersion:
      version,

    operations,

    summary,

    sourceMessage:
      input.message,

    sourceMessageId:
      input.sourceMessageId,

    fingerprint,

    createdAt:
      now.toISOString(),

    updatedAt:
      now.toISOString(),

    expiresAt:
      expiresAt.toISOString(),
  };

  await saveWorkflow(
    input.phone,
    input.companyId,
    workflow,
  );

  return {
    handled:
      true,

    text: [
      "Voy a realizar este cambio:",
      "",
      summary,
      "",
      `La confirmación vence en ${MUTATION_EXPIRATION_MINUTES} minutos.`,
      "¿Confirmás?",
    ].join("\n"),
  };
}

async function executePendingMutation(
  workflow: PendingMutation,
): Promise<MutationHandlerResult> {
  const executing:
    PendingMutation = {
    ...workflow,

    status:
      "executing",

    updatedAt:
      new Date()
        .toISOString(),
  };

  await saveWorkflow(
    workflow.phone,
    workflow.companyId,
    executing,
  );

  try {
    const result =
      await mutateOrder(
        workflow.companyId,
        workflow.orderId,
        {
          expectedVersion:
            workflow.expectedVersion,

          idempotencyKey:
            buildIdempotencyKey(
              workflow,
            ),

          operations:
            workflow.operations,

          source:
            "whatsapp",

          messageId:
            workflow.sourceMessageId,
        },
        {
          id:
            `whatsapp:${workflow.phone}`,

          name:
            "Agente de ventas WhatsApp",

          email:
            "robot@fulanitas.local",

          role:
            "sales_agent",
        },
      );

    const resultObject =
      asObject(result);

    const resultOrder =
      asObject(
        resultObject.order,
      );

    const refreshed =
      await getOrder(
        workflow.companyId,
        workflow.orderId,
      );

    const completed:
      PendingMutation = {
      ...workflow,

      status:
        "completed",

      resultOrderId:
        String(
          resultOrder.id
          ?? workflow.orderId,
        ),

      resultOrderNumber:
        String(
          resultOrder.number
          ?? workflow.orderNumber,
        ),

      updatedAt:
        new Date()
          .toISOString(),
    };

    await saveWorkflow(
      workflow.phone,
      workflow.companyId,
      completed,
    );

    const finalOrder =
      refreshed
        ? refreshed as CustomerOrder
        : null;

    return {
      handled:
        true,

      text:
        finalOrder
          ? [
              "Pedido actualizado correctamente ✅",
              describeCustomerOrder(
                finalOrder,
              ),
              "El stock reservado y el total fueron recalculados.",
            ].join("\n")
          : [
              "Pedido actualizado correctamente ✅",
              `Pedido: ${workflow.orderNumber}`,
              "El stock reservado y el total fueron recalculados.",
            ].join("\n"),
    };
  } catch (error) {
    const failed:
      PendingMutation = {
      ...workflow,

      status:
        "failed",

      errorCode:
        errorMessage(error)
          .slice(0, 500),

      updatedAt:
        new Date()
          .toISOString(),
    };

    await saveWorkflow(
      workflow.phone,
      workflow.companyId,
      failed,
    );

    console.error(
      "[WHATSAPP ORDER MUTATION ERROR]",
      {
    companyId: workflow.companyId,
    orderId: workflow.orderId,
    fingerprint: workflow.fingerprint
},
    );

    return {
      handled:
        true,

      text:
        customerMutationError(
          error,
        ),
    };
  }
}

export async function handleWhatsappOrderMutation(
  input: {
    phone: string;
    message: string;
    companyId: string;
    currentMessageId?: string;
    conversationHistory?: string;
  },
): Promise<MutationHandlerResult> {
  const conversation =
    await getConversationByPhone(
      input.phone,
      input.companyId,
    );

  const currentWorkflow =
    workflowFromMetadata(
      conversation?.metadata,
    );

  console.log(
    "[WHATSAPP ORDER MUTATION STATE]",
    {
    companyId: input.companyId,
    hasConversation: Boolean(conversation),
    hasMetadata: Boolean(conversation?.metadata),
    workflowStatus: currentWorkflow?.status
        ?? null,
    workflowOrderNumber: currentWorkflow?.orderNumber
        ?? null,
    workflowSourceMessageId: currentWorkflow?.sourceMessageId
        ?? null,
    currentMessageId: input.currentMessageId
        ?? null
},
  );

  const confirmation =
    confirmationIntent(
      input.message,
    );

  if (
    currentWorkflow
    && currentWorkflow.status
      === "awaiting_confirmation"
  ) {
    if (
      isExpired(
        currentWorkflow,
      )
    ) {
      await saveWorkflow(
        input.phone,
        input.companyId,
        {
          ...currentWorkflow,

          status:
            "expired",

          updatedAt:
            new Date()
              .toISOString(),
        },
      );

      if (
        confirmation
        !== "none"
      ) {
        return {
          handled:
            true,

          text:
            "La confirmación venció y no ejecuté el cambio. "
            + "Indicame nuevamente qué querés modificar.",
        };
      }
    } else if (
      confirmation
      === "cancel"
    ) {
      await saveWorkflow(
        input.phone,
        input.companyId,
        {
          ...currentWorkflow,

          status:
            "cancelled",

          updatedAt:
            new Date()
              .toISOString(),
        },
      );

      return {
        handled:
          true,

        text:
          "Listo. Cancelé el cambio y el pedido quedó exactamente igual.",
      };
    } else if (
      confirmation
      === "confirm"
    ) {
      return executePendingMutation(
        currentWorkflow,
      );
    } else if (
      looksLikeMutation(
        input.message,
      )
    ) {
      /**
       * Una solicitud nueva reemplaza la confirmación anterior.
       * No ejecutamos silenciosamente la operación previa.
       */
      await saveWorkflow(
        input.phone,
        input.companyId,
        {
          ...currentWorkflow,

          status:
            "cancelled",

          updatedAt:
            new Date()
              .toISOString(),

          errorCode:
            "SUPERSEDED_BY_NEW_REQUEST",
        },
      );
    } else {
      return {
        handled:
          true,

        text: [
          "Tengo este cambio pendiente de confirmación:",
          "",
          currentWorkflow.summary,
          "",
          "Respondé “sí” para aplicarlo o “no” para cancelarlo.",
        ].join("\n"),
      };
    }
  }

  /**
   * Si llegó nuevamente el mismo mensaje después de haber quedado
   * completado, no reconstruimos otra operación.
   */
  if (
    currentWorkflow
    && currentWorkflow.status
      === "completed"
    && input.currentMessageId
    && currentWorkflow.sourceMessageId
      === input.currentMessageId
  ) {
    return {
      handled:
        true,

      text:
        `Ese cambio ya fue aplicado al pedido ${currentWorkflow.orderNumber}.`,
    };
  }

  let semanticCommand:
    InterpretedOrderCommand | null = null;

  const semanticCandidate =
    Boolean(
      currentWorkflow
      || looksLikeMutation(
        input.message,
      )
      || /\b(pedido|reservado|reserva|sumale|agrega|agregame|agregale|quita|saca|dejame|cambia|cambialo|modifica|producto|talle|color|los mismos|ese|esos|mejor en|en vez de)\b/i
        .test(
          input.message,
        ),
    );

  if (!semanticCandidate) {
    return {
      handled:
        false,
    };
  }

  try {
    const semanticContext =
      await buildOrderInterpreterContext({
        companyId:
          input.companyId,

        phone:
          input.phone,

        message:
          input.message,

        conversationHistory:
          input.conversationHistory
          ?? "Sin historial reciente.",

        pendingWorkflow:
          currentWorkflow
            ? {
                status:
                  currentWorkflow.status,

                summary:
                  currentWorkflow.summary,

                orderNumber:
                  currentWorkflow.orderNumber,

                operations:
                  currentWorkflow.operations,
              }
            : null,
      });

    semanticCommand =
      await interpretOrderCommand(
        semanticContext,
      );
  } catch (error) {
    console.error(
      "[ORDER SEMANTIC FALLBACK]",
      {
    companyId: input.companyId
},
    );
  }

  /**
 * Una consulta perteneciente a otro dominio no puede ser
 * secuestrada por el workflow histórico de mutaciones.
 *
 * Un workflow completed/cancelled/failed/expired es historial,
 * no una acción pendiente.
 */
if (
  semanticCommand
  && semanticCommand.domain
    !== "order_modify"
  && !(
    currentWorkflow?.status
      === "awaiting_confirmation"
    && (
      semanticCommand.action
        === "confirm"
      || semanticCommand.action
        === "reject"
    )
  )
) {
  console.log(
    "[ORDER MUTATION DOMAIN BYPASS]",
    {
    companyId: input.companyId,
    workflowStatus: currentWorkflow?.status
        ?? null,
    domain: semanticCommand.domain,
    action: semanticCommand.action,
    requiresClarification: semanticCommand.requiresClarification
},
  );

  return {
    handled:
      false,
  };
}


const semanticMutationActions =
    new Set([
      "add_item",
      "increase_quantity",
      "set_quantity",
      "decrease_quantity",
      "remove_item",
      "replace_variant",
    ]);

  const isConcreteSemanticMutation =
    Boolean(
      semanticCommand
      && semanticMutationActions.has(
        semanticCommand.action,
      )
      && !semanticCommand.requiresClarification,
    );

  if (
    currentWorkflow
    && currentWorkflow.status
      === "awaiting_confirmation"
    && semanticCommand
    && semanticCommand.action
      !== "confirm"
    && semanticCommand.action
      !== "reject"
  ) {
    if (
      isConcreteSemanticMutation
    ) {
      await saveWorkflow(
        input.phone,
        input.companyId,
        {
          ...currentWorkflow,

          status:
            "cancelled",

          updatedAt:
            new Date()
              .toISOString(),

          errorCode:
            semanticCommand.correctsPendingAction
              ? "SUPERSEDED_BY_NATURAL_CORRECTION"
              : "SUPERSEDED_BY_NEW_REQUEST",
        },
      );

      console.log(
        "[ORDER MUTATION SUPERSEDED]",
        {
    companyId: input.companyId,
    previousOrderNumber: currentWorkflow.orderNumber,
    previousFingerprint: currentWorkflow.fingerprint,
    semanticAction: semanticCommand.action,
    correction: semanticCommand.correctsPendingAction,
    confidence: semanticCommand.confidence
},
      );
    } else if (
      semanticCommand.requiresClarification
    ) {
      return {
        handled:
          true,

        text: [
          semanticCommand.clarificationQuestion
            ?? "Necesito un dato más para corregir el cambio.",

          "",

          "El cambio anterior sigue pendiente y todavía no fue aplicado:",

          currentWorkflow.summary,

          "",

          "También podés responder “sí” para aplicarlo o “no” para cancelarlo.",
        ].join("\n"),
      };
    } else {
      return {
        handled:
          true,

        text: [
          "Todavía tengo este cambio pendiente:",

          "",

          currentWorkflow.summary,

          "",

          "Podés confirmarlo, cancelarlo o decirme naturalmente qué querés corregir.",
        ].join("\n"),
      };
    }
  }

  if (
    semanticCommand
    && semanticCommand.action
      === "confirm"
    && currentWorkflow
    && currentWorkflow.status
      === "awaiting_confirmation"
  ) {
    return executePendingMutation(
      currentWorkflow,
    );
  }

  if (
    semanticCommand
    && semanticCommand.action
      === "reject"
    && currentWorkflow
    && currentWorkflow.status
      === "awaiting_confirmation"
  ) {
    await saveWorkflow(
      input.phone,
      input.companyId,
      {
        ...currentWorkflow,

        status:
          "cancelled",

        updatedAt:
          new Date()
            .toISOString(),
      },
    );

    return {
      handled:
        true,

      text:
        "Listo. Cancelé ese cambio y el pedido quedó exactamente igual.",
    };
  }

  if (
    semanticCommand
    && semanticCommand.requiresClarification
  ) {
    return {
      handled:
        true,

      text:
        semanticCommand.clarificationQuestion
        ?? "Contame qué producto querés modificar, qué variante y cuántas unidades.",
    };
  }

  const semanticRequest =
    semanticCommand
      ? semanticToParsedRequest(
          semanticCommand,
        )
      : null;

  const fallbackLooksLikeMutation =
    looksLikeMutation(
      input.message,
    );

  const request =
    semanticRequest
    ?? (
      fallbackLooksLikeMutation
        ? parseMutationRequest(
            input.message,
          )
        : null
    );

  if (
    !request
    && semanticCandidate
    && !semanticCommand
  ) {
    return {
      handled:
        true,

      text: [
        "Entendí que querés modificar el pedido que ya tenés,",
        "pero no pude interpretar el cambio con seguridad.",
        "",
        "Decime qué producto querés agregar, quitar o cambiar",
        "y la cantidad. No voy a crear un pedido nuevo.",
      ].join("\n"),
    };
  }

  if (!request) {
    if (
      semanticCommand
      && semanticCommand.domain
        === "order_modify"
    ) {
      return {
        handled:
          true,

        text:
          semanticCommand.clarificationQuestion
          ?? "Claro. Decime qué producto querés modificar y cuántas unidades.",
      };
    }

    return {
      handled:
        false,
    };
  }

  const sourceMessageId =
    input.currentMessageId
    ?? `fallback-${hash(
      [
        input.companyId,
        input.phone,
        normalize(input.message),
      ].join("|"),
    ).slice(0, 40)}`;

  return prepareMutation(
    {
      companyId:
        input.companyId,

      phone:
        input.phone,

      message:
        input.message,

      sourceMessageId,
    },
    request,
  );
}
