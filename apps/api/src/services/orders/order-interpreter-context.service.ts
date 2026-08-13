import {
  listProducts,
} from "../catalog/catalog.repository.js";

import {
  searchNinoxCatalog,
} from "../ninox/ninox-catalog-search.service.js";

import {
  listCustomerOrdersByPhone,
} from "./order.service.js";

import type {
  OrderInterpreterContext,
} from "./order-command.types.js";

function objectValue(
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

function arrayValue(
  value: unknown,
): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      item,
    ): item is Record<string, unknown> =>
      Boolean(
        item
        && typeof item === "object"
        && !Array.isArray(item),
      ),
  );
}

function optionalString(
  value: unknown,
): string | undefined {
  return typeof value === "string"
    && value.trim()
      ? value.trim()
      : undefined;
}

function safeNumber(
  value: unknown,
  fallback = 0,
): number {
  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

export async function buildOrderInterpreterContext(
  input: {
    companyId: string;
    phone: string;
    message: string;
    conversationHistory: string;

    pendingWorkflow?: {
      status?: string;
      summary?: string;
      orderNumber?: string;
      operations?: unknown[];
    } | null;
  },
): Promise<OrderInterpreterContext> {
  const [
    rawOrders,
    catalog,
    ninoxCatalog,
  ] =
    await Promise.all([
      listCustomerOrdersByPhone(
        input.companyId,
        input.phone,
      ),

      listProducts(
        input.companyId,
      ),

      searchNinoxCatalog({
        query:
          input.message,

        limit:
          30,
      })
        .catch(
          (error: unknown) => {
            console.error(
              "[NINOX CONTEXT SEARCH ERROR]",
              {
                companyId:
                  input.companyId,

                message:
                  input.message,

                error:
                  error instanceof Error
                    ? error.message
                    : String(error),
              },
            );

            return [];
          },
        ),
    ]);

  const activeOrders =
    rawOrders
      .map(
        (rawOrder) => {
          const order =
            objectValue(
              rawOrder,
            );

          const items =
            arrayValue(
              order.items,
            );

          return {
            id:
              String(
                order.id
                ?? "",
              ),

            number:
              String(
                order.number
                ?? "",
              ),

            version:
              safeNumber(
                order.version,
              ),

            commercialStatus:
              String(
                order.commercial_status
                ?? "",
              ),

            paymentStatus:
              String(
                order.payment_status
                ?? "",
              ),

            fulfillmentStatus:
              String(
                order.fulfillment_status
                ?? "",
              ),

            reservationStatus:
              String(
                order.reservation_status
                ?? "",
              ),

            items:
              items.map(
                (item) => ({
                  id:
                    String(
                      item.id
                        ?? "",
                    ),

                  productName:
                    optionalString(
                      item.product_name_snapshot
                      ?? item.product_name
                      ?? item.name,
                    ),

                  sku:
                    optionalString(
                      item.sku_snapshot
                      ?? item.sku,
                    ),

                  color:
                    optionalString(
                      item.color_name_snapshot
                      ?? item.color_name
                      ?? item.color,
                    ),

                  size:
                    optionalString(
                      item.size_snapshot
                      ?? item.size,
                    ),

                  quantity:
                    safeNumber(
                      item.quantity,
                    ),
                }),
              ),
          };
        },
      )
      .filter(
        (order) =>
          Boolean(
            order.id
            && order.number
            && order.commercialStatus
              !== "cancelled",
          ),
      );

  return {
    companyId:
      input.companyId,

    phone:
      input.phone,

    message:
      input.message,

    conversationHistory:
      input.conversationHistory,

    pendingWorkflow:
      input.pendingWorkflow
      ?? null,

    activeOrders,

    catalog: [
      ...ninoxCatalog.map(
        (item) => ({
          productId:
            item.technicalKey,

          variantId:
            undefined,

          sku:
            item.code,

          name:
            item.name,

          category:
            "Ninox",

          color:
            item.color
            ?? undefined,

          size:
            item.size
            ?? undefined,

          stock:
            safeNumber(
              item.available,
            ),

          price:
            safeNumber(
              item.price,
            ),

          currency:
            "ARS",
        }),
      ),

      ...catalog.map(
        (item) => ({
          productId:
            item.productId,

          variantId:
            item.variantId,

          sku:
            item.sku,

          name:
            item.name,

          category:
            item.category,

          color:
            item.color,

          size:
            item.size,

          stock:
            safeNumber(
              item.stock,
            ),

          price:
            safeNumber(
              item.price,
            ),

          currency:
            item.currency,
        }),
      ),
    ],
  };
}
