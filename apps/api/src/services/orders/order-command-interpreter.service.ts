import {
  env,
} from "../../config/env.js";

import type {
  InterpretedOrderCommand,
  OrderCommandAction,
  OrderCommandDomain,
  OrderInterpreterContext,
  RelativeOrderReference,
  SemanticProductReference,
} from "./order-command.types.js";

const INTERPRETER_TIMEOUT_MS = 18_000;

const ORDER_INTERPRETER_TOOL = {
  name:
    "interpret_order_command",

  description:
    "Interpreta una instrucción comercial de WhatsApp y devuelve únicamente una intención estructurada. No ejecuta operaciones.",

  input_schema: {
    type:
      "object",

    additionalProperties:
      false,

    required: [
      "domain",
      "action",
      "orderReference",
      "currentProduct",
      "replacementProduct",
      "quantity",
      "quantityMode",
      "interpretation",
      "confidence",
      "requiresClarification",
      "clarificationReason",
      "clarificationQuestion",
      "usesConversationContext",
      "correctsPendingAction",
    ],

    properties: {
      domain: {
        type:
          "string",

        enum: [
          "order_query",
          "order_create",
          "order_modify",
          "order_cancel",
          "payment",
          "catalog",
          "conversation",
          "unknown",
        ],
      },

      action: {
        type:
          "string",

        enum: [
          "add_item",
          "increase_quantity",
          "set_quantity",
          "decrease_quantity",
          "remove_item",
          "replace_variant",
          "confirm",
          "reject",
          "correct_pending_action",
          "select_order",
          "request_clarification",
          "unknown",
        ],
      },

      orderReference: {
        anyOf: [
          {
            type:
              "null",
          },

          {
            type:
              "object",

            additionalProperties:
              false,

            required: [
              "number",
              "relative",
              "contextualReference",
            ],

            properties: {
              number: {
                type: [
                  "string",
                  "null",
                ],
              },

              relative: {
                anyOf: [
                  {
                    type:
                      "null",
                  },

                  {
                    type:
                      "string",

                    enum: [
                      "active",
                      "latest",
                      "today",
                      "yesterday",
                      "cancelled",
                      "pending_payment",
                    ],
                  },
                ],
              },

              contextualReference: {
                type: [
                  "string",
                  "null",
                ],
              },
            },
          },
        ],
      },

      currentProduct: {
        anyOf: [
          {
            type:
              "null",
          },

          {
            type:
              "object",

            additionalProperties:
              false,

            required: [
              "name",
              "category",
              "sku",
              "color",
              "size",
              "contextualReference",
            ],

            properties: {
              name: {
                type: [
                  "string",
                  "null",
                ],
              },

              category: {
                type: [
                  "string",
                  "null",
                ],
              },

              sku: {
                type: [
                  "string",
                  "null",
                ],
              },

              color: {
                type: [
                  "string",
                  "null",
                ],
              },

              size: {
                type: [
                  "string",
                  "null",
                ],
              },

              contextualReference: {
                type: [
                  "string",
                  "null",
                ],
              },
            },
          },
        ],
      },

      replacementProduct: {
        anyOf: [
          {
            type:
              "null",
          },

          {
            type:
              "object",

            additionalProperties:
              false,

            required: [
              "name",
              "category",
              "sku",
              "color",
              "size",
              "contextualReference",
            ],

            properties: {
              name: {
                type: [
                  "string",
                  "null",
                ],
              },

              category: {
                type: [
                  "string",
                  "null",
                ],
              },

              sku: {
                type: [
                  "string",
                  "null",
                ],
              },

              color: {
                type: [
                  "string",
                  "null",
                ],
              },

              size: {
                type: [
                  "string",
                  "null",
                ],
              },

              contextualReference: {
                type: [
                  "string",
                  "null",
                ],
              },
            },
          },
        ],
      },

      quantity: {
        anyOf: [
          {
            type:
              "null",
          },

          {
            type:
              "integer",

            minimum:
              1,

            maximum:
              100000,
          },
        ],
      },

      quantityMode: {
        type:
          "string",

        enum: [
          "absolute",
          "increment",
          "decrement",
          "all",
          "unspecified",
        ],
      },

      interpretation: {
        type:
          "string",

        minLength:
          1,

        maxLength:
          500,
      },

      confidence: {
        type:
          "number",

        minimum:
          0,

        maximum:
          1,
      },

      requiresClarification: {
        type:
          "boolean",
      },

      clarificationReason: {
        type: [
          "string",
          "null",
        ],
      },

      clarificationQuestion: {
        type: [
          "string",
          "null",
        ],
      },

      usesConversationContext: {
        type:
          "boolean",
      },

      correctsPendingAction: {
        type:
          "boolean",
      },
    },
  },
} as const;

type AnthropicToolUseBlock = {
  type?: string;
  name?: string;
  input?: unknown;
};

async function callStructuredInterpreter(
  prompt: string,
): Promise<unknown> {
  const apiKey =
    process.env.ANTHROPIC_API_KEY
      ?.trim();

  if (!apiKey) {
    throw new Error(
      "ORDER_INTERPRETER_API_KEY_MISSING",
    );
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        controller.abort();
      },
      INTERPRETER_TIMEOUT_MS,
    );

  try {
    const response =
      await fetch(
        "https://api.anthropic.com/v1/messages",
        {
          method:
            "POST",

          signal:
            controller.signal,

          headers: {
            "x-api-key":
              apiKey,

            "anthropic-version":
              "2023-06-01",

            "content-type":
              "application/json",
          },

          body:
            JSON.stringify({
              model:
                process.env.ANTHROPIC_ORDER_MODEL
                ?? env.ANTHROPIC_MODEL,

              max_tokens:
                1200,

              system: [
                "Sos un clasificador transaccional.",
                "No respondas al cliente.",
                "No produzcas texto libre.",
                "Usá obligatoriamente la herramienta interpret_order_command.",
                "No inventes pedidos, productos, variantes, cantidades ni stock.",
              ].join(" "),

              tools: [
                ORDER_INTERPRETER_TOOL,
              ],

              tool_choice: {
                type:
                  "tool",

                name:
                  ORDER_INTERPRETER_TOOL.name,
              },

              messages: [
                {
                  role:
                    "user",

                  content:
                    prompt,
                },
              ],
            }),
        },
      );

    const data =
      await response.json() as {
        content?: AnthropicToolUseBlock[];
        error?: unknown;
        stop_reason?: string;
      };

    if (!response.ok) {
      console.error(
        "[ORDER INTERPRETER API ERROR]",
        {
          status:
            response.status,

          error:
            data.error
            ?? data,
        },
      );

      throw new Error(
        `ORDER_INTERPRETER_API_${response.status}`,
      );
    }

    const toolUse =
      data.content?.find(
        (item) =>
          item.type === "tool_use"
          && item.name
            === ORDER_INTERPRETER_TOOL.name,
      );

    if (!toolUse) {
      console.error(
        "[ORDER INTERPRETER TOOL MISSING]",
        {
          stopReason:
            data.stop_reason
            ?? null,

          contentTypes:
            data.content?.map(
              (item) =>
                item.type
                ?? "unknown",
            )
            ?? [],
        },
      );

      throw new Error(
        "ORDER_INTERPRETER_TOOL_USE_MISSING",
      );
    }

    return toolUse.input;
  } finally {
    clearTimeout(
      timeout,
    );
  }
}


const VALID_DOMAINS =
  new Set<OrderCommandDomain>([
    "order_query",
    "order_create",
    "order_modify",
    "order_cancel",
    "payment",
    "catalog",
    "conversation",
    "unknown",
  ]);

const VALID_ACTIONS =
  new Set<OrderCommandAction>([
    "add_item",
    "increase_quantity",
    "set_quantity",
    "decrease_quantity",
    "remove_item",
    "replace_variant",
    "confirm",
    "reject",
    "correct_pending_action",
    "select_order",
    "request_clarification",
    "unknown",
  ]);

const VALID_RELATIVE_REFERENCES =
  new Set<RelativeOrderReference>([
    "active",
    "latest",
    "today",
    "yesterday",
    "cancelled",
    "pending_payment",
  ]);

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value),
  );
}

function optionalString(
  value: unknown,
  maximumLength = 240,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const clean =
    value.trim();

  if (!clean) {
    return undefined;
  }

  return clean.slice(
    0,
    maximumLength,
  );
}

function optionalPositiveInteger(
  value: unknown,
): number | undefined {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (
    !Number.isInteger(number)
    || number <= 0
    || number > 100_000
  ) {
    return undefined;
  }

  return number;
}

function boundedConfidence(
  value: unknown,
): number {
  const number =
    typeof value === "number"
      ? value
      : Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      1,
      number,
    ),
  );
}

function productReference(
  value: unknown,
): SemanticProductReference | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  const result:
    SemanticProductReference = {
    name:
      optionalString(
        value.name,
        120,
      ),

    category:
      optionalString(
        value.category,
        100,
      ),

    sku:
      optionalString(
        value.sku,
        100,
      ),

    color:
      optionalString(
        value.color,
        80,
      ),

    size:
      optionalString(
        value.size,
        40,
      ),

    contextualReference:
      optionalString(
        value.contextualReference,
        160,
      ),
  };

  return Object.values(result)
    .some(Boolean)
      ? result
      : undefined;
}

function stripJsonFence(
  value: string,
): string {
  const trimmed =
    value.trim();

  if (
    trimmed.startsWith("```")
  ) {
    return trimmed
      .replace(
        /^```(?:json)?\s*/i,
        "",
      )
      .replace(
        /\s*```$/,
        "",
      )
      .trim();
  }

  return trimmed;
}

function extractJsonObject(
  value: string,
): string {
  const clean =
    stripJsonFence(value);

  if (
    clean.startsWith("{")
    && clean.endsWith("}")
  ) {
    return clean;
  }

  const start =
    clean.indexOf("{");

  const end =
    clean.lastIndexOf("}");

  if (
    start >= 0
    && end > start
  ) {
    return clean.slice(
      start,
      end + 1,
    );
  }

  throw new Error(
    "ORDER_INTERPRETER_JSON_NOT_FOUND",
  );
}

function parseCommand(
  raw: unknown,
): InterpretedOrderCommand {
  let parsed:
    unknown =
      raw;

  if (typeof raw === "string") {
    try {
      parsed =
        JSON.parse(
          extractJsonObject(raw),
        );
    } catch {
      throw new Error(
        "ORDER_INTERPRETER_INVALID_JSON",
      );
    }
  }

  if (!isObject(parsed)) {
    throw new Error(
      "ORDER_INTERPRETER_INVALID_OBJECT",
    );
  }

  const rawDomain =
    optionalString(
      parsed.domain,
      40,
    ) as OrderCommandDomain | undefined;

  const rawAction =
    optionalString(
      parsed.action,
      50,
    ) as OrderCommandAction | undefined;

  const domain =
    rawDomain
    && VALID_DOMAINS.has(rawDomain)
      ? rawDomain
      : "unknown";

  const action =
    rawAction
    && VALID_ACTIONS.has(rawAction)
      ? rawAction
      : "unknown";

  const rawOrderReference =
    isObject(
      parsed.orderReference,
    )
      ? parsed.orderReference
      : {};

  const rawRelative =
    optionalString(
      rawOrderReference.relative,
      40,
    ) as RelativeOrderReference | undefined;

  const orderReference = {
    number:
      optionalString(
        rawOrderReference.number,
        100,
      ),

    relative:
      rawRelative
      && VALID_RELATIVE_REFERENCES.has(
        rawRelative,
      )
        ? rawRelative
        : undefined,

    contextualReference:
      optionalString(
        rawOrderReference.contextualReference,
        160,
      ),
  };

  const quantityMode =
    parsed.quantityMode === "absolute"
    || parsed.quantityMode === "increment"
    || parsed.quantityMode === "decrement"
    || parsed.quantityMode === "all"
    || parsed.quantityMode === "unspecified"
      ? parsed.quantityMode
      : "unspecified";

  const result:
    InterpretedOrderCommand = {
    domain,
    action,

    orderReference:
      Object.values(
        orderReference,
      ).some(Boolean)
        ? orderReference
        : undefined,

    currentProduct:
      productReference(
        parsed.currentProduct,
      ),

    replacementProduct:
      productReference(
        parsed.replacementProduct,
      ),

    quantity:
      optionalPositiveInteger(
        parsed.quantity,
      ),

    quantityMode,

    interpretation:
      optionalString(
        parsed.interpretation,
        500,
      )
      ?? "No se obtuvo una interpretación explicativa.",

    confidence:
      boundedConfidence(
        parsed.confidence,
      ),

    requiresClarification:
      parsed.requiresClarification
        === true,

    clarificationReason:
      optionalString(
        parsed.clarificationReason,
        300,
      ),

    clarificationQuestion:
      optionalString(
        parsed.clarificationQuestion,
        300,
      ),

    usesConversationContext:
      parsed.usesConversationContext
        === true,

    correctsPendingAction:
      parsed.correctsPendingAction
        === true,
  };

  if (
    result.action
      === "replace_variant"
    && (
      !result.currentProduct
      || !result.replacementProduct
    )
  ) {
    result.requiresClarification =
      true;

    result.confidence =
      Math.min(
        result.confidence,
        0.49,
      );

    result.clarificationQuestion ??=
      "¿Qué producto del pedido querés cambiar y por cuál variante?";
  }

  if (
    [
      "add_item",
      "increase_quantity",
      "set_quantity",
      "decrease_quantity",
    ].includes(
      result.action,
    )
    && !result.quantity
  ) {
    result.requiresClarification =
      true;

    result.confidence =
      Math.min(
        result.confidence,
        0.59,
      );

    result.clarificationQuestion ??=
      "¿Cuántas unidades querés?";
  }

  if (
    [
      "add_item",
      "increase_quantity",
      "set_quantity",
      "decrease_quantity",
      "remove_item",
      "replace_variant",
    ].includes(
      result.action,
    )
    && !result.currentProduct
    && !result.usesConversationContext
  ) {
    result.requiresClarification =
      true;

    result.confidence =
      Math.min(
        result.confidence,
        0.54,
      );

    result.clarificationQuestion ??=
      "¿Qué producto, color y talle querés modificar?";
  }

  return result;
}

function compactContext(
  context: OrderInterpreterContext,
) {
  return {
    pendingWorkflow:
      context.pendingWorkflow
        ? {
            status:
              context.pendingWorkflow.status
              ?? null,

            summary:
              context.pendingWorkflow.summary
              ?? null,

            orderNumber:
              context.pendingWorkflow.orderNumber
              ?? null,
          }
        : null,

    activeOrders:
      context.activeOrders
        .slice(0, 8)
        .map(
          (order) => ({
            number:
              order.number,

            status: {
              commercial:
                order.commercialStatus,

              payment:
                order.paymentStatus,

              fulfillment:
                order.fulfillmentStatus,

              reservation:
                order.reservationStatus,
            },

            items:
              order.items
                .slice(0, 30)
                .map(
                  (item) => ({
                    name:
                      item.productName
                      ?? null,

                    sku:
                      item.sku
                      ?? null,

                    color:
                      item.color
                      ?? null,

                    size:
                      item.size
                      ?? null,

                    quantity:
                      item.quantity,
                  }),
                ),
          }),
        ),

    catalog:
      context.catalog
        .slice(0, 80)
        .map(
          (item) => ({
            sku:
              item.sku,

            name:
              item.name,

            category:
              item.category
              ?? null,

            color:
              item.color
              ?? null,

            size:
              item.size
              ?? null,

            stock:
              item.stock,

            price:
              item.price,

            currency:
              item.currency,
          }),
        ),
  };
}

function buildInterpreterPrompt(
  context: OrderInterpreterContext,
): string {
  const compact =
    compactContext(context);

  return `
Sos un intérprete semántico especializado en conversaciones comerciales de WhatsApp.

Tu única tarea es interpretar lo que quiso decir el cliente y devolver UN objeto JSON válido.

NO ejecutás pedidos.
NO elegís UUID.
NO inventás SKU, producto, color, talle, pedido, precio ni stock.
NO redactás la respuesta al cliente.
NO agregás texto antes ni después del JSON.

El cliente puede hablar informalmente, enviar audios mal transcritos, corregirse, omitir productos ya mencionados o usar referencias como “ese”, “los mismos”, “tres más”, “cambialos” y “mejor en 40”.

Interpretá “sí”, “dale”, “hacelo” y “confirmo” como confirmación solamente cuando exista una acción pendiente.
Interpretá “no”, “dejalo” y “mejor no” como rechazo solamente cuando exista una acción pendiente.
“No, mejor en 40” es una corrección, no un rechazo.

Acciones:
add_item
increase_quantity
set_quantity
decrease_quantity
remove_item
replace_variant
confirm
reject
correct_pending_action
select_order
request_clarification
unknown

Dominios:
order_query
order_create
order_modify
order_cancel
payment
catalog
conversation
unknown

quantityMode:
absolute
increment
decrement
all
unspecified

Respondé únicamente con JSON usando estas propiedades:
domain
action
orderReference
currentProduct
replacementProduct
quantity
quantityMode
interpretation
confidence
requiresClarification
clarificationReason
clarificationQuestion
usesConversationContext
correctsPendingAction

Reglas:
1. confidence entre 0 y 1.
2. No inventes productos ni variantes.
3. “tres más” es increase_quantity.
4. “dejame tres” es set_quantity.
5. “sacame tres” es decrease_quantity.
6. “sacame el talle 40” sin cantidad es remove_item.
7. “cambialos por 40” es replace_variant y usa contexto.
8. “quiero agregar productos” requiere aclarar producto y cantidad.
9. Si existe una acción pendiente y el cliente corrige cantidad, talle, color o producto:
   - devolvé la acción concreta que representa el nuevo cambio;
   - por ejemplo set_quantity, replace_variant, add_item o remove_item;
   - establecé correctsPendingAction=true;
   - NO uses correct_pending_action como acción final si ya podés determinar la operación concreta.
10. “No, mejor dos” no es rechazo si después de “no” aparece una corrección.
11. “No, mejor talle 40” es una corrección de variante, no una cancelación.
12. No confundas rechazar un cambio con cancelar todo el pedido.
13. Frases como “tenés”, “hay”, “busco”, “estoy buscando”, “cuánto sale”, “qué precio tiene” o “qué talles hay” son consultas de catálogo:
    - domain=catalog;
    - action=request_clarification sólo si falta identificar producto, color o talle;
    - si el producto está identificado y el contexto contiene precio y stock, requiresClarification=false.
14. No uses add_item sólo porque el cliente diga “busco” o mencione un producto.
15. Usá add_item únicamente cuando exista intención explícita de compra o agregado, por ejemplo:
    - “quiero 2”;
    - “agregame 3”;
    - “sumá uno”;
    - “armame un pedido con”.
16. Si una variante tiene stock 0 en una consulta de catálogo:
    - informá la variante correctamente;
    - no inventes disponibilidad;
    - no preguntes cantidad salvo que exista intención explícita de compra.
17. Si el contexto contiene price y currency, nunca afirmes que falta información de precio.

MENSAJE ACTUAL:
${context.message}

HISTORIAL RECIENTE:
${context.conversationHistory.slice(-6000)}

CONTEXTO:
${JSON.stringify(compact)}
`.trim();
}

export async function interpretOrderCommand(
  context: OrderInterpreterContext,
): Promise<InterpretedOrderCommand> {
  const startedAt =
    Date.now();

  try {
    const structuredInput =
      await callStructuredInterpreter(
        buildInterpreterPrompt(
          context,
        ),
      );

    const command =
      parseCommand(
        structuredInput,
      );

    console.log(
      "[ORDER SEMANTIC INTERPRETER]",
      {
    companyId: context.companyId,
    domain: command.domain,
    action: command.action,
    confidence: command.confidence,
    requiresClarification: command.requiresClarification,
    elapsedMs: Date.now()
        - startedAt
},
    );

    return command;
  } catch (error) {
    console.error(
      "[ORDER SEMANTIC INTERPRETER ERROR]",
      {
    companyId: context.companyId,
    elapsedMs: Date.now()
        - startedAt
},
    );

    throw error;
  }
}
