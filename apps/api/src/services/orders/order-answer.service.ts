import type {
  CustomerOrder,
} from "./order-reference.service.js";

function money(
  value: unknown,
  currency: unknown,
): string {
  const amount =
    Number(value ?? 0);

  const currencyCode =
    typeof currency === "string"
      ? currency
      : "COP";

  return new Intl.NumberFormat(
    "es-CO",
    {
      style:
        "currency",

      currency:
        currencyCode,

      maximumFractionDigits:
        0,
    },
  ).format(
    amount,
  );
}

function statusLabel(
  order: CustomerOrder,
): string {
  if (
    order.commercial_status
    === "cancelled"
  ) {
    return "cancelado";
  }

  if (
    order.payment_status
    === "paid"
  ) {
    return "pagado";
  }

  if (
    order.payment_status
    === "partial"
  ) {
    return "con pago parcial";
  }

  if (
    order.payment_status
    === "unpaid"
  ) {
    return "pendiente de pago";
  }

  return "activo";
}

export function describeOrderItems(
  order: CustomerOrder,
): string {
  const items =
    Array.isArray(order.items)
      ? order.items
      : [];

  if (!items.length) {
    return "sin productos registrados";
  }

  return items
    .map(
      (item) => {
        const quantity =
          Number(
            item.quantity
            ?? 0,
          );

        const description = [
          item.product_name_snapshot,
          item.color_name_snapshot,
          item.size_snapshot
            ? `talle ${String(
                item.size_snapshot,
              )}`
            : null,
        ]
          .filter(Boolean)
          .join(" ");

        return `${quantity} × ${description}`;
      },
    )
    .join(", ");
}

export function describeCustomerOrder(
  order: CustomerOrder,
): string {
  return [
    String(
      order.number
      ?? "Pedido sin número",
    ),

    `(${statusLabel(order)})`,

    describeOrderItems(order),

    `Total ${money(
      order.total,
      order.currency,
    )}`,
  ].join(" · ");
}

export function buildOrderHistoryAnswer(
  orders: CustomerOrder[],
): string {
  if (!orders.length) {
    return "No tenés pedidos registrados.";
  }

  const active =
    orders.filter(
      (order) =>
        order.commercial_status
        !== "cancelled",
    );

  const cancelled =
    orders.filter(
      (order) =>
        order.commercial_status
        === "cancelled",
    );

  const sections:
    string[] = [];

  if (active.length) {
    sections.push(
      "Pedidos activos:",
      ...active
        .slice(0, 5)
        .map(
          (order) =>
            `• ${describeCustomerOrder(order)}`,
        ),
    );
  }

  if (cancelled.length) {
    if (sections.length) {
      sections.push("");
    }

    sections.push(
      "Historial cancelado:",
      ...cancelled
        .slice(0, 3)
        .map(
          (order) =>
            `• ${describeCustomerOrder(order)}`,
        ),
    );
  }

  return sections.join("\n");
}
