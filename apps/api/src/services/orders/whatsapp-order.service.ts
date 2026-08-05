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
  getContactByPhone,
} from "../crm/crm.repository.js";

import {
  createOrder,
} from "./order.service.js";

import {
  extractOrderIntent,
  type OrderIntent,
} from "./order-intent.service.js";

type DraftLine = {
  variantId: string;
  productId: string;
  sku: string;
  name: string;
  color?: string;
  size?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  stock: number;
};

type OrderDraft = {
  status:
    | "awaiting_confirmation"
    | "creating"
    | "completed"
    | "cancelled";

  fingerprint: string;
  currency: string;
  total: number;
  lines: DraftLine[];

  createdAt: string;
  updatedAt: string;

  orderId?: string;
  orderNumber?: string;
};

type WorkflowMetadata = {
  order_workflow?: OrderDraft | null;
};

type WorkflowResult = {
  handled: boolean;
  text?: string;
};

function normalize(
  value?: string | null,
): string {
  return String(value ?? "")
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

function money(
  value: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat(
      "es-AR",
      {
        style:
          "currency",

        currency:
          currency || "ARS",

        maximumFractionDigits:
          2,
      },
    ).format(value);
  } catch {
    return `${currency || "ARS"} ${value.toFixed(2)}`;
  }
}

function objectValue(
  value: unknown,
): Record<string, unknown> {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
}

function workflowFromMetadata(
  metadata?: Record<string, unknown>,
): OrderDraft | null {
  const value =
    metadata?.order_workflow;

  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    return null;
  }

  return value as OrderDraft;
}

function createFingerprint(
  lines: DraftLine[],
): string {
  return lines
    .map(
      (line) =>
        `${line.variantId}:${line.quantity}`,
    )
    .sort()
    .join("|");
}

function describeDraft(
  draft: OrderDraft,
): string {
  const lines =
    draft.lines
      .map(
        (line) => {
          const details = [
            line.color,
            line.size
              ? `talle ${line.size}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            `• ${line.name}`
            + (
              details
                ? ` (${details})`
                : ""
            )
            + `: ${line.quantity} × `
            + `${money(line.unitPrice, draft.currency)}`
            + ` = ${money(line.subtotal, draft.currency)}`
          );
        },
      )
      .join("\n");

  return [
    "Te preparo este pedido:",
    "",
    lines,
    "",
    `Total: ${money(draft.total, draft.currency)}`,
    "",
    "¿Confirmás el pedido?",
  ].join("\n");
}

async function resolveDraftLines(
  intent:
    Extract<
      OrderIntent,
      {
        intent:
          "build_order_draft";
      }
    >
    | OrderIntent,
  companyId: string,
): Promise<{
  lines: DraftLine[];
  errors: string[];
}> {
  const catalog =
    await listProducts(
      companyId,
    );

  const lines:
    DraftLine[] = [];

  const errors:
    string[] = [];

  for (
    const requested
    of intent.lines
  ) {
    const query = [
      requested.product,
      requested.color,
      requested.size,
    ]
      .filter(Boolean)
      .join(" ");

    const searched =
      await searchProducts(
        query,
        companyId,
      );

    const candidates =
      searched
        .filter(
          (item) =>
            Boolean(
              item.variantId,
            ),
        )
        .filter(
          (item) =>
            requested.size
              ? normalize(
                  item.size,
                )
                === normalize(
                  requested.size,
                )
              : true,
        )
        .filter(
          (item) =>
            requested.color
              ? normalize(
                  item.color,
                ).includes(
                  normalize(
                    requested.color,
                  ),
                )
              : true,
        );

    const selected =
      candidates[0]
      ?? catalog.find(
        (item) =>
          Boolean(item.variantId)
          && (
            requested.size
              ? normalize(item.size)
                === normalize(requested.size)
              : true
          )
          && (
            requested.color
              ? normalize(item.color)
                .includes(
                  normalize(requested.color),
                )
              : true
          )
          && normalize(item.name)
            .includes(
              normalize(requested.product),
            ),
      );

    if (
      !selected
      || !selected.variantId
    ) {
      errors.push(
        `No encontré una variante exacta para `
        + `${requested.product}`
        + (
          requested.color
            ? ` color ${requested.color}`
            : ""
        )
        + (
          requested.size
            ? ` talle ${requested.size}`
            : ""
        )
        + ".",
      );

      continue;
    }

    if (
      selected.stock
      < requested.quantity
    ) {
      errors.push(
        `${selected.name}`
        + (
          selected.size
            ? ` talle ${selected.size}`
            : ""
        )
        + `: hay ${selected.stock} disponibles`
        + ` y pediste ${requested.quantity}.`,
      );

      continue;
    }

    const existing =
      lines.find(
        (line) =>
          line.variantId
          === selected.variantId,
      );

    if (existing) {
      existing.quantity +=
        requested.quantity;

      existing.subtotal =
        existing.quantity
        * existing.unitPrice;

      if (
        existing.quantity
        > existing.stock
      ) {
        errors.push(
          `${existing.name}`
          + (
            existing.size
              ? ` talle ${existing.size}`
              : ""
          )
          + `: el total solicitado supera el stock disponible.`,
        );
      }

      continue;
    }

    lines.push({
      variantId:
        selected.variantId,

      productId:
        selected.productId,

      sku:
        selected.sku,

      name:
        selected.name,

      color:
        selected.color,

      size:
        selected.size,

      quantity:
        requested.quantity,

      unitPrice:
        selected.price,

      subtotal:
        selected.price
        * requested.quantity,

      stock:
        selected.stock,
    });
  }

  return {
    lines,
    errors,
  };
}

export async function handleWhatsappOrder(
  input: {
    phone: string;
    message: string;
    conversationHistory: string;
    companyId: string;
  },
): Promise<WorkflowResult> {
  const conversation =
    await getConversationByPhone(
      input.phone,
      input.companyId,
    );

  const currentWorkflow =
    workflowFromMetadata(
      conversation?.metadata,
    );

  const intent =
    await extractOrderIntent({
      message:
        input.message,

      conversationHistory:
        input.conversationHistory,
    });

  console.log(
    "[ORDER INTENT]",
    {
      companyId:
        input.companyId,

      phone:
        input.phone,

      intent:
        intent.intent,

      lineCount:
        intent.lines.length,

      currentStatus:
        currentWorkflow?.status
        ?? null,
    },
  );

  if (
    intent.intent
    === "build_order_draft"
  ) {
    if (!intent.lines.length) {
      return {
        handled:
          false,
      };
    }

    const resolved =
      await resolveDraftLines(
        intent,
        input.companyId,
      );

    if (resolved.errors.length) {
      return {
        handled:
          true,

        text: [
          "Antes de confirmar necesito corregir esto:",
          "",
          ...resolved.errors.map(
            (error) =>
              `• ${error}`,
          ),
        ].join("\n"),
      };
    }

    if (!resolved.lines.length) {
      return {
        handled:
          false,
      };
    }

    const currency =
      (
        await listProducts(
          input.companyId,
        )
      )
        .find(
          (item) =>
            item.variantId
            === resolved.lines[0]
              ?.variantId,
        )
        ?.currency
      ?? "ARS";

    const now =
      new Date()
        .toISOString();

    const draft:
      OrderDraft = {
      status:
        "awaiting_confirmation",

      fingerprint:
        createFingerprint(
          resolved.lines,
        ),

      currency,

      total:
        resolved.lines.reduce(
          (
            total,
            line,
          ) =>
            total
            + line.subtotal,
          0,
        ),

      lines:
        resolved.lines,

      createdAt:
        now,

      updatedAt:
        now,
    };

    await updateConversationMetadata(
      input.phone,
      {
        order_workflow:
          draft,
      },
      input.companyId,
    );

    console.log(
      "[ORDER DRAFT SAVED]",
      {
        companyId:
          input.companyId,

        phone:
          input.phone,

        fingerprint:
          draft.fingerprint,

        lineCount:
          draft.lines.length,

        total:
          draft.total,
      },
    );

    return {
      handled:
        true,

      text:
        describeDraft(
          draft,
        ),
    };
  }

  if (
    intent.intent
    === "cancel_order"
    && currentWorkflow
  ) {
    await updateConversationMetadata(
      input.phone,
      {
        order_workflow: {
          ...currentWorkflow,

          status:
            "cancelled",

          updatedAt:
            new Date()
              .toISOString(),
        },
      },
      input.companyId,
    );

    return {
      handled:
        true,

      text:
        "Listo, cancelé el borrador del pedido. No se reservó ni descontó stock.",
    };
  }

  if (
    intent.intent
    === "confirm_order"
  ) {
    if (!currentWorkflow) {
      return {
        handled:
          true,

        text:
          "Todavía no tengo un pedido preparado para confirmar. Decime producto, talle, color y cantidad.",
      };
    }

    if (
      currentWorkflow.status
      === "completed"
      && currentWorkflow.orderId
    ) {
      return {
        handled:
          true,

        text: [
          "Ese pedido ya quedó registrado.",
          `Pedido: ${currentWorkflow.orderNumber ?? currentWorkflow.orderId}`,
          `Total: ${money(currentWorkflow.total, currentWorkflow.currency)}`,
          "Estado: pendiente de pago.",
        ].join("\n"),
      };
    }

    if (
      currentWorkflow.status
      === "creating"
    ) {
      return {
        handled:
          true,

        text:
          "Estoy terminando de registrar el pedido. No hace falta que lo confirmes otra vez.",
      };
    }

    if (
      currentWorkflow.status
      !== "awaiting_confirmation"
    ) {
      return {
        handled:
          true,

        text:
          "Ese borrador ya no está disponible. Armemos el pedido nuevamente.",
      };
    }

    await updateConversationMetadata(
      input.phone,
      {
        order_workflow: {
          ...currentWorkflow,

          status:
            "creating",

          updatedAt:
            new Date()
              .toISOString(),
        },
      },
      input.companyId,
    );

    try {
      const contact =
        await getContactByPhone(
          input.phone,
          input.companyId,
        );

      const created =
        await createOrder(
          input.companyId,
          {
            customer: {
              name:
                contact?.name
                ?? "Cliente de WhatsApp",

              business_name:
                contact?.business_name
                ?? null,

              whatsapp:
                input.phone,

              customer_type:
                "wholesaler",

              metadata: {
                crm_contact_id:
                  contact?.id
                  ?? null,

                source:
                  "whatsapp",
              },
            },

            lines:
              currentWorkflow.lines.map(
                (line) => ({
                  variant_id:
                    line.variantId,

                  quantity:
                    line.quantity,

                  discount_percent:
                    0,
                }),
              ),

            options: {
              source:
                "whatsapp",

              reserve_stock:
                true,

              notes:
                "Pedido confirmado automáticamente por WhatsApp.",
            },
          },
          {
            id:
              `whatsapp:${input.phone}`,

            name:
              "Agente de ventas WhatsApp",

            email:
              "robot@fulanitas.local",

            role:
              "sales_agent",
          },
        );

      const order =
        objectValue(
          created,
        );

      const orderId =
        typeof order.id
        === "string"
          ? order.id
          : null;

      const orderNumber =
        typeof order.number
        === "string"
          ? order.number
          : null;

      const total =
        Number(
          order.total
          ?? currentWorkflow.total,
        );

      const currency =
        typeof order.currency
        === "string"
          ? order.currency
          : currentWorkflow.currency;

      if (!orderId) {
        throw new Error(
          "ORDER_ID_NOT_RETURNED",
        );
      }

      const completed:
        OrderDraft = {
        ...currentWorkflow,

        status:
          "completed",

        orderId,

        orderNumber:
          orderNumber
          ?? undefined,

        total:
          Number.isFinite(total)
            ? total
            : currentWorkflow.total,

        currency,

        updatedAt:
          new Date()
            .toISOString(),
      };

      await updateConversationMetadata(
        input.phone,
        {
          order_workflow:
            completed,
        },
        input.companyId,
      );

      console.log(
        "[WHATSAPP ORDER CREATED]",
        {
          companyId:
            input.companyId,

          phone:
            input.phone,

          orderId,

          orderNumber,

          total:
            completed.total,
        },
      );

      return {
        handled:
          true,

        text: [
          "Pedido registrado correctamente ✅",
          `Número: ${orderNumber ?? orderId}`,
          `Total: ${money(completed.total, completed.currency)}`,
          "Estado: pendiente de pago.",
          "El stock quedó reservado para este pedido.",
        ].join("\n"),
      };
    } catch (error) {
      await updateConversationMetadata(
        input.phone,
        {
          order_workflow: {
            ...currentWorkflow,

            status:
              "awaiting_confirmation",

            updatedAt:
              new Date()
                .toISOString(),
          },
        },
        input.companyId,
      );

      console.error(
        "[WHATSAPP ORDER CREATE ERROR]",
        {
          companyId:
            input.companyId,

          phone:
            input.phone,

          error,
        },
      );

      return {
        handled:
          true,

        text:
          "No pude registrar el pedido porque cambió el stock o hubo un problema técnico. No se generó ningún pedido duplicado.",
      };
    }
  }

  return {
    handled:
      false,
  };
}
