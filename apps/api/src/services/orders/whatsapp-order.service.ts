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
  listCustomerOrdersByPhone,
  transitionFulfillment,
} from "./order.service.js";

import {
  extractOrderIntent,
  type OrderIntent,
} from "./order-intent.service.js";

import {
  getDefaultPaymentAccount,
  paymentAccountReply,
} from "../payments/payment-submission.service.js";

import {
  ensureCommerceVariantFromNinox,
  ensureCommerceVariantFromNinoxExact,
} from "../ninox/ninox-commerce-bridge.service.js";

import {
  getNinoxCommercialProduct,
  type CustomerSaleMode,
  type NinoxCommercialVariant,
} from "../ninox/ninox-commercial-catalog.service.js";

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
  saleMode: CustomerSaleMode;

  status:
    | "awaiting_confirmation"
    | "collecting_shipping"
    | "awaiting_final_confirmation"
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

  shipping?: {
    step:
      | "recipient_name"
      | "province"
      | "city"
      | "address"
      | "postal_code"
      | "notes"
      | "completed";

    recipientName?: string;
    recipientPhone?: string;
    province?: string;
    city?: string;
    address?: string;
    postalCode?: string;
    notes?: string;
  };
};

type PendingOrderAction =
  | {
      type:
        "select_cancel";

      orderIds:
        string[];

      createdAt:
        string;
    }
  | {
      type:
        "confirm_cancel";

      orderId:
        string;

      orderNumber?:
        string;

      createdAt:
        string;
    };

type WorkflowMetadata = {
  sale_mode?: CustomerSaleMode | null;
  order_workflow?: OrderDraft | null;
  pending_order_action?: PendingOrderAction | null;
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

function cleanShippingValue(
  value:
    string,
  prefixes:
    string[],
) {
  let result =
    value.trim();

  for (
    const prefix
    of prefixes
  ) {
    result =
      result.replace(
        new RegExp(
          `^${prefix}\\s*[:\\-]?\\s*`,
          "i",
        ),
        "",
      );
  }

  return result.trim();
}



function looksLikeShippingInterruption(
  value:
    string,
) {
  const raw =
    value.trim();

  const normalized =
    normalize(
      raw,
    );

  if (!normalized) {
    return false;
  }

  /*
   * Pregunta explícita.
   */
  if (
    raw.includes("?")
    || raw.includes("¿")
  ) {
    return true;
  }

  /*
   * Intenciones que no deben terminar
   * guardadas como nombre/provincia/dirección.
   */
  return (
    /^(como|que|cual|cuando|donde|quien|por que|porque)\b/
      .test(
        normalized,
      )
    || /^(quiero|quiero ver|ver|mostrar|mostrame|pasame|dame)\b/
      .test(
        normalized,
      )
    || /\b(cancelar|cancela|cancelame|anular|anula)\b/
      .test(
        normalized,
      )
    || /\b(pagar|pago|pagos|comprobante|comprobantes)\b/
      .test(
        normalized,
      )
    || /\b(pedido|pedidos|catalogo|stock|precio|precios)\b/
      .test(
        normalized,
      )
  );
}


function validRecipientName(
  value:
    string,
) {
  const clean =
    value.trim();

  if (
    clean.length < 2
    || clean.length > 100
    || looksLikeShippingInterruption(
      clean,
    )
  ) {
    return false;
  }

  /*
   * Un nombre tiene que contener letras.
   * Evita guardar códigos, importes o preguntas.
   */
  return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/u
    .test(
      clean,
    );
}


function validPlace(
  value:
    string,
) {
  const clean =
    value.trim();

  if (
    clean.length < 2
    || clean.length > 120
    || looksLikeShippingInterruption(
      clean,
    )
  ) {
    return false;
  }

  return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/u
    .test(
      clean,
    );
}


function validAddress(
  value:
    string,
) {
  const clean =
    value.trim();

  if (
    clean.length < 4
    || clean.length > 200
    || looksLikeShippingInterruption(
      clean,
    )
  ) {
    return false;
  }

  return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/u
    .test(
      clean,
    );
}


function validPostalCode(
  value:
    string,
) {
  const clean =
    value.trim();

  if (
    clean.length < 3
    || clean.length > 12
    || looksLikeShippingInterruption(
      clean,
    )
  ) {
    return false;
  }

  /*
   * Compatible con CP numérico y formatos
   * alfanuméricos comunes.
   */
  return /^[A-Za-z0-9 -]+$/
    .test(
      clean,
    );
}


function shippingSummary(
  workflow:
    OrderDraft,
) {
  const shipping =
    workflow.shipping;

  return [
    "Resumen del pedido:",
    "",
    ...workflow.lines.map(
      (line) =>
        `• ${line.quantity} × ${line.name}`
        + `${line.color ? ` - ${line.color}` : ""}`
        + `${line.size ? ` - talle ${line.size}` : ""}`
        + ` = ${money(line.subtotal, workflow.currency)}`,
    ),
    "",
    `Total: ${money(workflow.total, workflow.currency)}`,
    "",
    `Recibe: ${shipping?.recipientName ?? "-"}`,
    `Teléfono: ${shipping?.recipientPhone ?? "-"}`,
    `Provincia: ${shipping?.province ?? "-"}`,
    `Localidad: ${shipping?.city ?? "-"}`,
    `Dirección: ${shipping?.address ?? "-"}`,
    `Código postal: ${shipping?.postalCode ?? "-"}`,
    `Referencias: ${shipping?.notes || "Sin referencias"}`,
    "",
    "¿Confirmás que estos datos están correctos?",
  ].join("\n");
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

function saleModeFromMetadata(
  metadata?: Record<string, unknown>,
): CustomerSaleMode | null {
  const value =
    metadata?.sale_mode;

  return value === "retail"
    || value === "wholesale"
      ? value
      : null;
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

function pendingActionFromMetadata(
  metadata?: Record<string, unknown>,
): PendingOrderAction | null {
  const value =
    metadata?.pending_order_action;

  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    return null;
  }

  return value as PendingOrderAction;
}

function localDateKey(
  value:
    unknown,
): string | null {
  const date =
    value instanceof Date
      ? value
      : (
          typeof value
          === "string"
            ? new Date(value)
            : null
        );

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
        part.type
        === "year",
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type
        === "month",
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type
        === "day",
    )?.value;

  return (
    year
    && month
    && day
      ? `${year}-${month}-${day}`
      : null
  );
}

function orderMatchesReference(
  order: Record<string, unknown>,
  message: string,
): boolean {
  const normalizedMessage =
    normalize(message);

  const orderNumber =
    normalize(
      typeof order.number === "string"
        ? order.number
        : "",
    );

  if (
    orderNumber
    && normalizedMessage.includes(
      orderNumber,
    )
  ) {
    return true;
  }

  const createdDate =
    localDateKey(
      order.created_at,
    );

  const now =
    new Date();

  const today =
    localDateKey(
      now,
    );

  const yesterdayDate =
    localDateKey(
      new Date(
        now.getTime()
        - 24
          * 60
          * 60
          * 1000,
      ),
    );

  if (
    /\bhoy\b/
      .test(normalizedMessage)
    && createdDate
      === today
  ) {
    return true;
  }

  if (
    /\bayer\b/
      .test(normalizedMessage)
    && createdDate
      === yesterdayDate
  ) {
    return true;
  }

  const items =
    Array.isArray(order.items)
      ? order.items as Array<Record<string, unknown>>
      : [];

  return items.some(
    (item) => {
      const itemText =
        normalize(
          [
            item.product_name_snapshot,
            item.color_name_snapshot,
            item.size_snapshot,
            item.sku_snapshot,
          ]
            .filter(Boolean)
            .join(" "),
        );

      return (
        itemText
        && normalizedMessage
          .split(" ")
          .some(
            (word) =>
              word.length >= 4
              && itemText.includes(
                word,
              ),
          )
      );
    },
  );
}

function describeRealOrder(
  order: Record<string, unknown>,
): string {
  const items =
    Array.isArray(order.items)
      ? order.items as Array<Record<string, unknown>>
      : [];

  const itemSummary =
    items
      .slice(0, 3)
      .map(
        (item) =>
          [
            item.product_name_snapshot,
            item.color_name_snapshot,
            item.size_snapshot
              ? `talle ${item.size_snapshot}`
              : null,
          ]
            .filter(Boolean)
            .join(" "),
      )
      .join(", ");

  const number =
    typeof order.number === "string"
      ? order.number
      : String(order.id ?? "");

  const total =
    Number(order.total ?? 0);

  const currency =
    typeof order.currency === "string"
      ? order.currency
      : "ARS";

  return (
    `${number}`
    + (
      itemSummary
        ? `: ${itemSummary}`
        : ""
    )
    + `, ${money(total, currency)}`
  );
}

function createFingerprint(
  lines: DraftLine[],
): string {
  return lines
    .map(
      (line) =>
        `${line.variantId}:${line.quantity}:${line.unitPrice}`,
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

function commercialVariantMatches(
  variant: NinoxCommercialVariant,
  input: {
    color?: string | null;
    size?: string | null;
  },
) {
  const colorMatches =
    input.color
      ? normalize(
          variant.color,
        ).includes(
          normalize(
            input.color,
          ),
        )
      : true;

  const sizeMatches =
    input.size
      ? normalize(
          variant.size,
        )
        === normalize(
          input.size,
        )
      : true;

  return (
    colorMatches
    && sizeMatches
  );
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
  saleMode: CustomerSaleMode,
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
    const externalCode =
      requested.product
        .trim()
        .toUpperCase();

    /*
     * El checkout ya entrega el SKU exacto de la variante.
     * Se valida contra catálogo y stock actuales antes de
     * recurrir a la resolución semántica o comercial.
     */
    const exactCatalogItem =
      catalog.find(
        (item) =>
          Boolean(
            item.variantId,
          )
          && item.sku
            .trim()
            .toUpperCase()
            === externalCode,
      );

    if (
      exactCatalogItem
        ?.variantId
    ) {
      if (
        exactCatalogItem.stock
        < requested.quantity
      ) {
        errors.push(
          `${exactCatalogItem.name}: hay `
          + `${exactCatalogItem.stock} disponibles`
          + ` y pediste ${requested.quantity}.`,
        );

        continue;
      }

      lines.push({
        variantId:
          exactCatalogItem.variantId,

        productId:
          exactCatalogItem.productId,

        sku:
          exactCatalogItem.sku,

        name:
          exactCatalogItem.name,

        color:
          exactCatalogItem.color,

        size:
          exactCatalogItem.size,

        quantity:
          requested.quantity,

        unitPrice:
          exactCatalogItem.price,

        subtotal:
          exactCatalogItem.price
          * requested.quantity,

        stock:
          exactCatalogItem.stock,
      });

      continue;
    }

    const commercial =
      await getNinoxCommercialProduct({
        companyId,
        externalCode,
        mode:
          saleMode,
      })
        .catch(
          (error: unknown) => {
            console.error(
              "[NINOX COMMERCIAL PRODUCT ERROR]",
              {
                companyId,
                externalCode,
                saleMode,
                error,
              },
            );

            return null;
          },
        );

    if (
      commercial
      && saleMode === "retail"
    ) {
      const matching =
        commercial.variants
          .filter(
            (variant) =>
              commercialVariantMatches(
                variant,
                {
                  color:
                    requested.color,
                  size:
                    requested.size,
                },
              ),
          );

      if (!requested.size) {
        errors.push(
          `${commercial.name}: decime el talle para la compra minorista.`,
        );

        continue;
      }

      if (matching.length !== 1) {
        errors.push(
          `No pude identificar una variante única de ${commercial.name}`
          + (
            requested.color
              ? ` color ${requested.color}`
              : ""
          )
          + ` talle ${requested.size}.`,
        );

        continue;
      }

      const variant =
        matching[0]!;

      if (
        variant.available
        < requested.quantity
      ) {
        errors.push(
          `${commercial.name}`
          + (
            variant.color
              ? ` color ${variant.color}`
              : ""
          )
          + (
            variant.size
              ? ` talle ${variant.size}`
              : ""
          )
          + `: hay ${variant.available} disponibles`
          + ` y pediste ${requested.quantity}.`,
        );

        continue;
      }

      const bridged =
        await ensureCommerceVariantFromNinoxExact({
          companyId,
          variant,
        });

      const available =
        Number(
          bridged.stockSync
            ?.available
          ?? variant.available,
        );

      if (
        available
        < requested.quantity
      ) {
        errors.push(
          `${commercial.name}: el stock disponible cambió y quedan ${available}.`,
        );

        continue;
      }

      lines.push({
        variantId:
          bridged.catalogItem.variantId!,

        productId:
          bridged.catalogItem.productId,

        sku:
          bridged.catalogItem.sku,

        name:
          commercial.name,

        color:
          variant.color
          ?? undefined,

        size:
          variant.size
          ?? undefined,

        quantity:
          requested.quantity,

        unitPrice:
          variant.unitPrice,

        subtotal:
          variant.unitPrice
          * requested.quantity,

        stock:
          available,
      });

      continue;
    }

    if (
      commercial
      && saleMode === "wholesale"
    ) {
      if (!requested.color) {
        errors.push(
          `${commercial.name}: para mayorista decime qué color querés.`,
        );

        continue;
      }

      const curve =
        commercial.wholesaleCurve;

      if (!curve) {
        errors.push(
          `${commercial.name}: no tiene una curva mayorista configurada.`,
        );

        continue;
      }

      const curveColor =
        curve.byColor.find(
          (entry) =>
            normalize(
              entry.color,
            ).includes(
              normalize(
                requested.color,
              ),
            ),
        );

      if (!curveColor) {
        errors.push(
          `${commercial.name}: no encontré el color ${requested.color}.`,
        );

        continue;
      }

      const curveQuantity =
        requested.quantity;

      if (
        curveColor.curvesAvailable
        < curveQuantity
      ) {
        errors.push(
          `${commercial.name} color ${curveColor.color ?? requested.color}`
          + `: hay ${curveColor.curvesAvailable} curvas disponibles`
          + ` y pediste ${curveQuantity}.`,
        );

        continue;
      }

      for (
        const size
        of curve.sizes
      ) {
        const variant =
          commercial.variants.find(
            (entry) =>
              normalize(
                entry.color,
              )
              === normalize(
                curveColor.color,
              )
              && normalize(
                entry.size,
              )
              === normalize(
                size,
              ),
          );

        if (!variant) {
          errors.push(
            `${commercial.name}: falta la variante`
            + ` ${curveColor.color ?? requested.color}`
            + ` talle ${size} para completar la curva.`,
          );

          continue;
        }

        const quantity =
          curveQuantity
          * curve.unitsPerSize;

        const bridged =
          await ensureCommerceVariantFromNinoxExact({
            companyId,
            variant,
          });

        const available =
          Number(
            bridged.stockSync
              ?.available
            ?? variant.available,
          );

        if (
          available
          < quantity
        ) {
          errors.push(
            `${commercial.name}`
            + ` ${curveColor.color ?? requested.color}`
            + ` talle ${size}: quedan ${available}`
            + ` y se necesitan ${quantity}.`,
          );

          continue;
        }

        lines.push({
          variantId:
            bridged.catalogItem.variantId!,

          productId:
            bridged.catalogItem.productId,

          sku:
            bridged.catalogItem.sku,

          name:
            commercial.name,

          color:
            variant.color
            ?? undefined,

          size:
            variant.size
            ?? undefined,

          quantity,

          unitPrice:
            variant.unitPrice,

          subtotal:
            variant.unitPrice
            * quantity,

          stock:
            available,
        });
      }

      continue;
    }

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

    let selected =
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
      const bridged =
        await ensureCommerceVariantFromNinox({
          companyId,

          query: [
            requested.product,
            requested.color,
            requested.size,
          ]
            .filter(Boolean)
            .join(" "),
        })
          .catch(
            (error: unknown) => {
              console.error(
                "[NINOX COMMERCE BRIDGE ERROR]",
                {
                  companyId,
                  product:
                    requested.product,
                  color:
                    requested.color
                    ?? null,
                  size:
                    requested.size
                    ?? null,
                  error,
                },
              );

              return null;
            },
          );

      if (
        bridged?.catalogItem
          .variantId
      ) {
        selected =
          {
            ...bridged.catalogItem,

            stock:
              Number(
                bridged.stockSync
                  ?.available
                ?? bridged.ninoxItem
                  .available
                ?? 0,
              ),
          };

        console.log(
          "[NINOX COMMERCE BRIDGE RESOLVED]",
          {
            companyId,

            product:
              requested.product,

            sku:
              selected.sku,

            variantId:
              selected.variantId,

            stock:
              selected.stock,
          },
        );
      }
    }

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

  const normalizedCheckoutMessage =
    normalize(
      input.message,
    );

  const checkoutSaleMode:
    CustomerSaleMode | null =
    /^pedido mayorista\b/
      .test(
        normalizedCheckoutMessage,
      )
      ? "wholesale"
      : /^pedido minorista\b/
          .test(
            normalizedCheckoutMessage,
          )
        ? "retail"
        : null;

  const saleMode =
    checkoutSaleMode
    ?? currentWorkflow?.saleMode
    ?? saleModeFromMetadata(
      conversation?.metadata,
    );

  const pendingOrderAction =
    pendingActionFromMetadata(
      conversation?.metadata,
    );

  const normalizedForConfirmation =
    normalize(
      input.message,
    );

  const deterministicConfirmation =
    Boolean(
      currentWorkflow
      && (
        currentWorkflow.status
          === "awaiting_confirmation"
        || currentWorkflow.status
          === "awaiting_final_confirmation"
      )
      && /^(si|confirmo|confirmar|dale|ok|okay|correcto|de acuerdo|esta bien|perfecto)$/
        .test(
          normalizedForConfirmation,
        ),
    );

  const deterministicCancellation =
    Boolean(
      currentWorkflow
      && (
        currentWorkflow.status
          === "awaiting_confirmation"
        || currentWorkflow.status
          === "awaiting_final_confirmation"
      )
      && /^(no|cancelar|cancelo|rechazo|dejalo|dejalo asi)$/
        .test(
          normalizedForConfirmation,
        ),
    );

  const intent:
    OrderIntent =
    deterministicConfirmation
      ? {
          intent:
            "confirm_order",

          lines:
            [],
        }
      : deterministicCancellation
        ? {
            intent:
              "cancel_order",

            lines:
              [],
          }
        : await extractOrderIntent({
            message:
              input.message,

            conversationHistory:
              input.conversationHistory,
          });

  console.log(
    "[ORDER INTENT]",
    {
    companyId: input.companyId,
    intent: intent.intent,
    lineCount: intent.lines.length,
    currentStatus: currentWorkflow?.status
        ?? null
},
  );

  const normalizedMessage =
    normalize(
      input.message,
    );

  const genericPurchaseStart =
    !saleMode
    && !currentWorkflow
    && intent.intent === "none"
    && /\b(quiero comprar|quiero hacer una compra|hacer una compra|hacer un pedido|quiero hacer un pedido|quiero pedir|comprar)\b/
      .test(
        normalizedMessage,
      );

  if (genericPurchaseStart) {
    return {
      handled:
        true,

      text:
        [
          "Perfecto.",
          "",
          "¿La compra es mayorista o minorista?",
          "",
          "• Mayorista: se vende por curva completa.",
          "• Minorista: podés elegir unidades por talle.",
        ].join("\n"),
    };
  }


  const explicitSaleMode:
    CustomerSaleMode | null =
    /\b(mayorista|mayor|por mayor)\b/
      .test(normalizedMessage)
      ? "wholesale"
      : /\b(minorista|minor|por menor)\b/
          .test(normalizedMessage)
        ? "retail"
        : null;

  if (
    explicitSaleMode
    && !currentWorkflow
  ) {
    await updateConversationMetadata(
      input.phone,
      {
        sale_mode:
          explicitSaleMode,
      },
      input.companyId,
    );

    return {
      handled:
        true,

      text:
        explicitSaleMode === "wholesale"
          ? "Perfecto, compra mayorista. Decime qué artículo y color querés."
          : "Perfecto, compra minorista. Decime qué artículo, color y talle querés.",
    };
  }


  const cancelDraftDuringShipping =
    Boolean(
      currentWorkflow?.status
        === "collecting_shipping"
      && /^(?:che )?(?:cancela|cancelar|cancelalo|cancelame|cancelo|anula|anular|anulalo|dejalo|dejalo asi|olvidalo|mejor no|no quiero seguir)(?: (?:ese|el|este) pedido)?$/
        .test(
          normalizedMessage,
        ),
    );

  if (cancelDraftDuringShipping) {
    await updateConversationMetadata(
      input.phone,
      {
        order_workflow: {
          ...currentWorkflow!,

          status:
            "cancelled",

          updatedAt:
            new Date()
              .toISOString(),
        },

        pending_order_action:
          null,
      },
      input.companyId,
    );

    console.log(
      "[ORDER DRAFT CANCELLED DURING SHIPPING]",
      {
    companyId: input.companyId,
    previousStatus: currentWorkflow?.status
},
    );

    return {
      handled:
        true,

      text:
        "Listo, cancelé el pedido que estábamos armando. No se registró ninguna orden.",
    };
  }

  if (
    currentWorkflow?.status
      === "collecting_shipping"
    && currentWorkflow.shipping
  ) {
    const shipping = {
      ...currentWorkflow.shipping,
    };

    const raw =
      input.message.trim();

    switch (
      shipping.step
    ) {
      case "recipient_name": {
        const value =
          cleanShippingValue(
            raw,
            [
              "mi nombre es",
              "nombre",
              "recibe",
            ],
          );

        if (!value) {
          return {
            handled:
              true,

            text:
              "Decime el nombre de la persona que recibe el pedido.",
          };
        }

        if (
          !validRecipientName(
            value,
          )
        ) {
          /*
           * Puede ser una pregunta o una orden
           * intercalada. No contaminamos shipping.
           * El agente normal puede procesarla.
           */
          return {
            handled:
              false,
          };
        }

        shipping.recipientName =
          value;

        shipping.recipientPhone =
          input.phone;

        shipping.step =
          "province";

        break;
      }

      case "province": {
        const value =
          cleanShippingValue(
            raw,
            [
              "provincia",
            ],
          );

        if (!value) {
          return {
            handled:
              true,

            text:
              "¿En qué provincia se entrega?",
          };
        }

        if (
          !validPlace(
            value,
          )
        ) {
          return {
            handled:
              false,
          };
        }

        shipping.province =
          value;

        shipping.step =
          "city";

        break;
      }

      case "city": {
        const value =
          cleanShippingValue(
            raw,
            [
              "localidad",
              "ciudad",
            ],
          );

        if (!value) {
          return {
            handled:
              true,

            text:
              "¿Cuál es la localidad o ciudad?",
          };
        }

        if (
          !validPlace(
            value,
          )
        ) {
          return {
            handled:
              false,
          };
        }

        shipping.city =
          value;

        shipping.step =
          "address";

        break;
      }

      case "address": {
        const value =
          cleanShippingValue(
            raw,
            [
              "direccion",
              "dirección",
              "calle",
            ],
          );

        if (!value) {
          return {
            handled:
              true,

            text:
              "Pasame la dirección completa de entrega.",
          };
        }

        if (
          !validAddress(
            value,
          )
        ) {
          return {
            handled:
              false,
          };
        }

        shipping.address =
          value;

        shipping.step =
          "postal_code";

        break;
      }

      case "postal_code": {
        const value =
          cleanShippingValue(
            raw,
            [
              "codigo postal",
              "código postal",
              "cp",
            ],
          );

        if (!value) {
          return {
            handled:
              true,

            text:
              "¿Cuál es el código postal?",
          };
        }

        if (
          !validPostalCode(
            value,
          )
        ) {
          return {
            handled:
              false,
          };
        }

        shipping.postalCode =
          value;

        shipping.step =
          "notes";

        break;
      }

      case "notes": {
        const normalizedNotes =
          normalize(
            raw,
          );

        shipping.notes =
          (
            normalizedNotes
              === "sin referencias"
            || normalizedNotes
              === "ninguna"
            || normalizedNotes
              === "no"
          )
            ? ""
            : cleanShippingValue(
                raw,
                [
                  "referencias",
                  "referencia",
                  "notas",
                ],
              );

        shipping.step =
          "completed";

        const ready:
          OrderDraft = {
          ...currentWorkflow,

          status:
            "awaiting_final_confirmation",

          shipping,

          updatedAt:
            new Date()
              .toISOString(),
        };

        await updateConversationMetadata(
          input.phone,
          {
            order_workflow:
              ready,
          },
          input.companyId,
        );

        return {
          handled:
            true,

          text:
            shippingSummary(
              ready,
            ),
        };
      }

      default:
        break;
    }

    const updated:
      OrderDraft = {
      ...currentWorkflow,

      shipping,

      updatedAt:
        new Date()
          .toISOString(),
    };

    await updateConversationMetadata(
      input.phone,
      {
        order_workflow:
          updated,
      },
      input.companyId,
    );

    const nextQuestion =
      shipping.step
        === "province"
        ? "¿En qué provincia se entrega?"
        : shipping.step
          === "city"
          ? "¿Cuál es la localidad o ciudad?"
          : shipping.step
            === "address"
          ? "Pasame la dirección completa de entrega."
          : shipping.step
            === "postal_code"
          ? "¿Cuál es el código postal?"
          : "¿Tenés alguna referencia para la entrega? Si no, decime “sin referencias”.";

    return {
      handled:
        true,

      text:
        nextQuestion,
    };
  }

  if (
    pendingOrderAction
    ?.type
    === "select_cancel"
  ) {
    const orders =
      await listCustomerOrdersByPhone(
        input.companyId,
        input.phone,
      );

    const candidates =
      orders.filter(
        (order) => {
          const orderId =
            typeof order.id
            === "string"
              ? order.id
              : "";

          return (
            pendingOrderAction
              .orderIds
              .includes(
                orderId,
              )
          );
        },
      );

    const matching =
      candidates.filter(
        (order) =>
          orderMatchesReference(
            order,
            input.message,
          ),
      );

    if (
      matching.length
      === 1
    ) {
      const selected =
        matching[0];

      const orderId =
        typeof selected.id
        === "string"
          ? selected.id
          : null;

      const orderNumber =
        typeof selected.number
        === "string"
          ? selected.number
          : undefined;

      if (!orderId) {
        return {
          handled:
            true,

          text:
            "No pude identificar ese pedido correctamente.",
        };
      }

      await updateConversationMetadata(
        input.phone,
        {
          pending_order_action: {
            type:
              "confirm_cancel",

            orderId,

            orderNumber,

            createdAt:
              new Date()
                .toISOString(),
          },
        },
        input.companyId,
      );

      return {
        handled:
          true,

        text: [
          "Encontré este pedido:",
          describeRealOrder(
            selected,
          ),
          "",
          "¿Confirmás que querés cancelarlo?",
        ].join("\n"),
      };
    }

    return {
      handled:
        true,

      text: [
        "No pude distinguir cuál de los pedidos querés cancelar.",
        "",
        ...candidates
          .slice(0, 5)
          .map(
            (order) =>
              `• ${describeRealOrder(order)}`,
          ),
        "",
        "Decime el número exacto del pedido o uno de los productos que tenía.",
      ].join("\n"),
    };
  }

if (
    pendingOrderAction
    ?.type
    === "confirm_cancel"
  ) {
    if (
      /^(si|confirmo|si cancelalo|confirmo cancelar|cancelalo|cancelar pedido|si quiero cancelarlo)$/
        .test(
          normalizedMessage,
        )
    ) {
      const result =
        await transitionFulfillment(
          input.companyId,
          pendingOrderAction.orderId,
          {
            action:
              "cancel",

            payload: {
              note:
                "Cancelado por solicitud del cliente desde WhatsApp.",
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

      await updateConversationMetadata(
        input.phone,
        {
          pending_order_action:
            null,
        },
        input.companyId,
      );

      if (!result) {
        return {
          handled:
            true,

          text:
            "No encontré el pedido para cancelarlo. Lo revisa una persona del equipo.",
        };
      }

      return {
        handled:
          true,

        text:
          `Listo, cancelé el pedido ${
            pendingOrderAction.orderNumber
            ?? pendingOrderAction.orderId
          }. También liberé el stock reservado.`,
      };
    }

    if (
      /\b(no|dejalo|mantener|no cancelar)\b/
        .test(
          normalizedMessage,
        )
    ) {
      await updateConversationMetadata(
        input.phone,
        {
          pending_order_action:
            null,
        },
        input.companyId,
      );

      return {
        handled:
          true,

        text:
          "Perfecto, dejo el pedido activo.",
      };
    }
  }

  if (
    intent.intent
    === "cancel_order"
  ) {
    const orders =
      await listCustomerOrdersByPhone(
        input.companyId,
        input.phone,
      );

    const cancellable =
      orders.filter(
        (order) =>
          order.commercial_status
            !== "cancelled"
          && order.payment_status
            !== "paid"
          && order.payment_status
            !== "partial"
          && order.fulfillment_status
            !== "shipped"
          && order.fulfillment_status
            !== "delivered",
      );

    const matching =
      cancellable.filter(
        (order) =>
          orderMatchesReference(
            order,
            input.message,
          ),
      );

    const selected =
      matching.length === 1
        ? matching[0]
        : (
            cancellable.length === 1
              ? cancellable[0]
              : null
          );

    if (selected) {
      const orderId =
        typeof selected.id === "string"
          ? selected.id
          : null;

      const orderNumber =
        typeof selected.number === "string"
          ? selected.number
          : undefined;

      if (!orderId) {
        return {
          handled:
            true,

          text:
            "Encontré el pedido, pero no pude identificarlo correctamente.",
        };
      }

      await updateConversationMetadata(
        input.phone,
        {
          pending_order_action: {
            type:
              "confirm_cancel",

            orderId,

            orderNumber,

            createdAt:
              new Date()
                .toISOString(),
          },
        },
        input.companyId,
      );

      return {
        handled:
          true,

        text: [
          `Encontré este pedido:`,
          describeRealOrder(
            selected,
          ),
          "",
          "¿Confirmás que querés cancelarlo?",
        ].join("\n"),
      };
    }

    if (cancellable.length > 1) {
      await updateConversationMetadata(
        input.phone,
        {
          pending_order_action: {
            type:
              "select_cancel",

            orderIds:
              cancellable
                .map(
                  (order) =>
                    typeof order.id
                    === "string"
                      ? order.id
                      : "",
                )
                .filter(Boolean),

            createdAt:
              new Date()
                .toISOString(),
          },
        },
        input.companyId,
      );

      return {
        handled:
          true,

        text: [
          "Tenés varios pedidos que se pueden cancelar:",
          "",
          ...cancellable
            .slice(0, 5)
            .map(
              (order) =>
                `• ${describeRealOrder(order)}`,
            ),
          "",
          "Decime el número, si es el de hoy o ayer, o qué producto tenía.",
        ].join("\n"),
      };
    }

    if (
      currentWorkflow
      ?.status
      === "awaiting_confirmation"
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
          "Listo, cancelé el borrador. No se reservó ni descontó stock.",
      };
    }

    return {
      handled:
        true,

      text:
        "No encontré pedidos pendientes que se puedan cancelar.",
    };
  }

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

    if (!saleMode) {
      return {
        handled:
          true,

        text:
          [
            "Antes de armar el pedido:",
            "",
            "¿La compra es mayorista o minorista?",
            "",
            "• Mayorista: se vende por curva completa.",
            "• Minorista: podés elegir unidades por talle.",
          ].join("\n"),
      };
    }

    const resolved =
      await resolveDraftLines(
        intent,
        input.companyId,
        saleMode,
      );

    if (
      currentWorkflow?.status
        === "awaiting_final_confirmation"
      && currentWorkflow.shipping?.step
        === "completed"
    ) {
      if (resolved.errors.length) {
        return {
          handled:
            true,

          text: [
            "No pude agregar eso al pedido:",
            "",
            ...resolved.errors.map(
              (error) =>
                `• ${error}`,
            ),
            "",
            "El pedido anterior sigue intacto.",
          ].join("\n"),
        };
      }

      if (!resolved.lines.length) {
        return {
          handled:
            true,

          text:
            "No pude identificar qué producto querés agregar. Decime el producto y la cantidad.",
        };
      }

      const mergedLines:
        DraftLine[] =
        currentWorkflow.lines.map(
          (line) => ({
            ...line,
          }),
        );

      for (
        const incoming
        of resolved.lines
      ) {
        const existing =
          mergedLines.find(
            (line) =>
              line.variantId
              === incoming.variantId,
          );

        if (existing) {
          const newQuantity =
            existing.quantity
            + incoming.quantity;

          if (
            newQuantity
            > incoming.stock
          ) {
            return {
              handled:
                true,

              text:
                `${incoming.name}: hay ${incoming.stock} disponibles en total y el pedido quedaría en ${newQuantity}.`,
            };
          }

          existing.quantity =
            newQuantity;

          existing.stock =
            incoming.stock;

          existing.unitPrice =
            incoming.unitPrice;

          existing.subtotal =
            existing.unitPrice
            * existing.quantity;
        } else {
          mergedLines.push({
            ...incoming,
          });
        }
      }

      const updated:
        OrderDraft = {
        ...currentWorkflow,

        lines:
          mergedLines,

        total:
          mergedLines.reduce(
            (
              sum,
              line,
            ) =>
              sum
              + line.subtotal,
            0,
          ),

        fingerprint:
          createFingerprint(
            mergedLines,
          ),

        updatedAt:
          new Date()
            .toISOString(),
      };

      await updateConversationMetadata(
        input.phone,
        {
          order_workflow:
            updated,
        },
        input.companyId,
      );

      console.log(
        "[ORDER DRAFT UPDATED BEFORE FINAL CONFIRMATION]",
        {
    companyId: input.companyId,
    lineCount: updated.lines.length,
    total: updated.total,
    fingerprint: updated.fingerprint
},
      );

      return {
        handled:
          true,

        text: [
          "Listo, lo agregué al pedido.",
          "",
          shippingSummary(
            updated,
          ),
        ].join("\n"),
      };
    }

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
      saleMode,

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
    companyId: input.companyId,
    fingerprint: draft.fingerprint,
    lineCount: draft.lines.length,
    total: draft.total
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
    === "payment_question"
  ) {
    const account =
      await getDefaultPaymentAccount({
        companyId:
          input.companyId,

        currency:
          currentWorkflow?.currency
          ?? "ARS",
      });

    if (!account) {
      return {
        handled:
          true,

        text: [
          "En este momento no hay una cuenta de cobro activa configurada.",
          "",
          "Administración deberá enviarte los datos de pago manualmente.",
        ].join("\n"),
      };
    }

    const now =
      new Date();

    const expiresAt =
      new Date(
        now.getTime()
        + 24 * 60 * 60 * 1000,
      );

    await updateConversationMetadata(
      input.phone,
      {
        payment_workflow: {
          status:
            "awaiting_receipt",

          paymentAccountId:
            account.id,

          orderId:
            currentWorkflow?.orderId
            ?? null,

          orderNumber:
            currentWorkflow?.orderNumber
            ?? null,

          createdAt:
            now.toISOString(),

          expiresAt:
            expiresAt.toISOString(),

          updatedAt:
            now.toISOString(),
        },
      },
      input.companyId,
    );

    console.log(
      "[PAYMENT ACCOUNT SENT]",
      {
    companyId: input.companyId,
    paymentAccountId: account.id,
    orderId: currentWorkflow?.orderId
        ?? null,
    expiresAt: expiresAt.toISOString()
},
    );

    return {
      handled:
        true,

      text:
        paymentAccountReply(
          account,
        ),
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
      === "awaiting_confirmation"
    ) {
      const collecting:
        OrderDraft = {
        ...currentWorkflow,

        status:
          "collecting_shipping",

        shipping: {
          step:
            "recipient_name",

          recipientPhone:
            input.phone,
        },

        updatedAt:
          new Date()
            .toISOString(),
      };

      await updateConversationMetadata(
        input.phone,
        {
          order_workflow:
            collecting,
        },
        input.companyId,
      );

      return {
        handled:
          true,

        text: [
          "Perfecto. Antes de registrar el pedido necesito los datos de envío.",
          "",
          "¿Cuál es el nombre de la persona que recibe?",
        ].join("\n"),
      };
    }

    if (
      currentWorkflow.status
      !== "awaiting_final_confirmation"
    ) {
      return {
        handled:
          true,

        text:
          "Ese borrador ya no está disponible. Armemos el pedido nuevamente.",
      };
    }

    if (
      !currentWorkflow.shipping
      || currentWorkflow.shipping.step
      !== "completed"
    ) {
      return {
        handled:
          true,

        text:
          "Todavía faltan datos de envío antes de confirmar el pedido.",
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
                currentWorkflow.shipping
                  ?.recipientName
                ?? contact?.name
                ?? "Cliente de WhatsApp",

              business_name:
                contact?.business_name
                ?? null,

              whatsapp:
                currentWorkflow.shipping
                  ?.recipientPhone
                ?? input.phone,

              province:
                currentWorkflow.shipping
                  ?.province
                ?? null,

              city:
                currentWorkflow.shipping
                  ?.city
                ?? null,

              address:
                currentWorkflow.shipping
                  ?.address
                ?? null,

              customer_type:
                currentWorkflow.saleMode === "retail"
                  ? "retail"
                  : "wholesaler",

              notes:
                currentWorkflow.shipping
                  ?.notes
                || null,

              metadata: {
                crm_contact_id:
                  contact?.id
                  ?? null,

                source:
                  "whatsapp",

                postal_code:
                  currentWorkflow.shipping
                    ?.postalCode
                  ?? null,
              },
            },

            lines:
              currentWorkflow.lines.map(
                (line) => ({
                  variant_id:
                    line.variantId,

                  quantity:
                    line.quantity,

                  unit_price:
                    line.unitPrice,

                  discount_percent:
                    0,
                }),
              ),

            options: {
              source:
                "whatsapp",

              reserve_stock:
                true,

              shipping_method:
                "delivery",

              shipping_address:
                [
                  currentWorkflow.shipping
                    ?.address,

                  currentWorkflow.shipping
                    ?.city,

                  currentWorkflow.shipping
                    ?.province,

                  currentWorkflow.shipping
                    ?.postalCode
                    ? `CP ${currentWorkflow.shipping.postalCode}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(", "),

              notes:
                currentWorkflow.shipping
                  ?.notes
                || "Pedido confirmado por WhatsApp.",
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

      const paymentAccount =
        await getDefaultPaymentAccount({
          companyId:
            input.companyId,

          currency:
            completed.currency,
        });

      const paymentCreatedAt =
        new Date();

      const paymentExpiresAt =
        new Date(
          paymentCreatedAt.getTime()
          + 24 * 60 * 60 * 1000,
        );

      await updateConversationMetadata(
        input.phone,
        {
          order_workflow:
            completed,

          payment_workflow:
            paymentAccount
              ? {
                  status:
                    "awaiting_receipt",

                  paymentAccountId:
                    paymentAccount.id,

                  orderId,

                  orderNumber:
                    orderNumber
                    ?? null,

                  createdAt:
                    paymentCreatedAt
                      .toISOString(),

                  expiresAt:
                    paymentExpiresAt
                      .toISOString(),

                  updatedAt:
                    paymentCreatedAt
                      .toISOString(),
                }
              : null,
        },
        input.companyId,
      );

      console.log(
        "[WHATSAPP ORDER CREATED]",
        {
    companyId: input.companyId,
    orderId,
    orderNumber,
    total: completed.total,
    paymentAccountId: paymentAccount?.id
        ?? null
},
      );

      const orderReply =
        [
          "Pedido registrado correctamente ✅",
          `Número: ${orderNumber ?? orderId}`,
          `Total: ${money(completed.total, completed.currency)}`,
          "Estado: pendiente de pago.",
          "El stock quedó reservado para este pedido.",
        ].join("\n");

      return {
        handled:
          true,

        text:
          paymentAccount
            ? [
                orderReply,
                "",
                paymentAccountReply(
                  paymentAccount,
                ),
              ].join("\n")
            : [
                orderReply,
                "",
                "No hay una cuenta de cobro activa configurada en este momento.",
                "Administración deberá enviarte los datos de pago manualmente.",
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
    companyId: input.companyId
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
