import {
  z,
} from "zod";

import {
  env,
} from "../../config/env.js";

const orderLineSchema =
  z.object({
    product:
      z.string()
        .trim()
        .min(1),

    color:
      z.string()
        .trim()
        .nullable()
        .optional(),

    size:
      z.string()
        .trim()
        .nullable()
        .optional(),

    quantity:
      z.coerce
        .number()
        .int()
        .positive(),
  });

const orderIntentSchema =
  z.object({
    intent:
      z.enum([
        "none",
        "build_order_draft",
        "confirm_order",
        "cancel_order",
        "payment_question",
      ]),

    lines:
      z.array(
        orderLineSchema,
      )
        .default([]),
  });

export type OrderIntent =
  z.infer<
    typeof orderIntentSchema
  >;

function extractJson(
  value: string,
): unknown {
  const fenced =
    value.match(
      /```(?:json)?\s*([\s\S]*?)```/i,
    );

  const candidate =
    fenced?.[1]
    ?? value.match(
      /\{[\s\S]*\}/,
    )?.[0];

  if (!candidate) {
    throw new Error(
      "ORDER_INTENT_JSON_NOT_FOUND",
    );
  }

  return JSON.parse(
    candidate,
  );
}

export async function extractOrderIntent(
  input: {
    message: string;
    conversationHistory: string;
  },
): Promise<OrderIntent> {
  if (!env.ANTHROPIC_API_KEY) {
    return {
      intent:
        "none",

      lines:
        [],
    };
  }

  const prompt = `
Analiza el mensaje de un cliente mayorista.

Devuelve EXCLUSIVAMENTE JSON válido, sin explicaciones.

Formato:
{
  "intent": "none | build_order_draft | confirm_order | cancel_order | payment_question",
  "lines": [
    {
      "product": "nombre del producto",
      "color": "color o null",
      "size": "talle o null",
      "quantity": 1
    }
  ]
}

Reglas:
- build_order_draft: el cliente indica productos y cantidades.
- confirm_order: confirma claramente un pedido ya resumido.
- cancel_order: cancela o rechaza el pedido.
- payment_question: pregunta cómo pagar o pide datos de pago.
- none: conversación general, precio, stock, fotos o consulta sin cantidades suficientes.
- Nunca inventes producto, talle, color ni cantidad.
- Usa el contexto para resolver expresiones como "las 3 del talle 40".
- Si una cantidad no está clara, no crees esa línea.

Historial:
${input.conversationHistory}

Mensaje actual:
${input.message}
`.trim();

  const response =
    await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method:
          "POST",

        headers: {
          "x-api-key":
            env.ANTHROPIC_API_KEY,

          "anthropic-version":
            "2023-06-01",

          "content-type":
            "application/json",
        },

        body:
          JSON.stringify({
            model:
              env.ANTHROPIC_MODEL,

            max_tokens:
              700,

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
    await response.json();

  if (!response.ok) {
    console.error(
      "[ORDER INTENT CLAUDE ERROR]",
      data,
    );

    return {
      intent:
        "none",

      lines:
        [],
    };
  }

  const text =
    data.content
      ?.find(
        (
          item:
            Record<string, unknown>,
        ) =>
          item.type
          === "text",
      )
      ?.text;

  if (
    typeof text
    !== "string"
  ) {
    return {
      intent:
        "none",

      lines:
        [],
    };
  }

  try {
    return orderIntentSchema.parse(
      extractJson(text),
    );
  } catch (error) {
    console.error(
      "[ORDER INTENT PARSE ERROR]",
      {
        error,
        text,
      },
    );

    return {
      intent:
        "none",

      lines:
        [],
    };
  }
}
