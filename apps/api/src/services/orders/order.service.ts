import {
  supabaseRequest,
  supabaseRpc,
} from "../db/supabase-rest.client.js";

export type CommerceActor = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type CreateOrderInput = {
  customer: Record<string, unknown>;
  lines: Array<Record<string, unknown>>;
  options?: Record<string, unknown>;
};

export type RecordPaymentInput = {
  amount: number;
  method: string;
  reference?: string | null;
};

export type FulfillmentInput = {
  action: string;
  payload?: Record<string, unknown>;
};

function companyFilter(
  companyId: string,
) {
  return encodeURIComponent(companyId);
}

export async function listOrders(
  companyId: string,
) {
  const encodedCompanyId =
    companyFilter(companyId);

  const [
    orders,
    customers,
    reservations,
    items,
  ] =
    await Promise.all([
      supabaseRequest<
        Array<Record<string, unknown>>
      >({
        table:
          "commerce_orders",

        query:
          `?company_id=eq.${encodedCompanyId}`
          + "&select=*"
          + "&order=created_at.desc"
          + "&limit=200",
      }),

      supabaseRequest<
        Array<Record<string, unknown>>
      >({
        table:
          "commerce_customers",

        query:
          `?company_id=eq.${encodedCompanyId}`
          + "&select=id,name,business_name,whatsapp,email,city",
      }),

      supabaseRequest<
        Array<Record<string, unknown>>
      >({
        table:
          "commerce_reservations",

        query:
          `?company_id=eq.${encodedCompanyId}`
          + "&select=id,order_id,status,expires_at,created_at"
          + "&order=created_at.desc",
      }),

      supabaseRequest<
        Array<Record<string, unknown>>
      >({
        table:
          "commerce_order_items",

        query:
          `?company_id=eq.${encodedCompanyId}`
          + "&select=id,order_id,sku_snapshot,product_name_snapshot,color_name_snapshot,size_snapshot,quantity,unit_price,subtotal"
          + "&order=created_at.asc",
      }),
    ]);

  const customersById =
    new Map(
      customers.map(
        (customer) => [
          String(
            customer.id
            ?? "",
          ),
          customer,
        ],
      ),
    );

  const reservationsByOrder =
    new Map<string, Record<string, unknown>>();

  for (
    const reservation
    of reservations
  ) {
    const orderId =
      String(
        reservation.order_id
        ?? "",
      );

    if (
      orderId
      && !reservationsByOrder
        .has(orderId)
    ) {
      reservationsByOrder.set(
        orderId,
        reservation,
      );
    }
  }

  const itemsByOrder =
    new Map<
      string,
      Array<Record<string, unknown>>
    >();

  for (const item of items) {
    const orderId =
      String(
        item.order_id
        ?? "",
      );

    const current =
      itemsByOrder.get(orderId)
      ?? [];

    current.push(item);

    itemsByOrder.set(
      orderId,
      current,
    );
  }

  return orders.map(
    (order) => {
      const orderId =
        String(
          order.id
          ?? "",
        );

      const customerId =
        String(
          order.customer_id
          ?? "",
        );

      const orderItems =
        itemsByOrder.get(
          orderId,
        )
        ?? [];

      return {
        ...order,

        customer:
          customersById.get(
            customerId,
          )
          ?? null,

        reservation:
          reservationsByOrder.get(
            orderId,
          )
          ?? null,

        items:
          orderItems,

        item_count:
          orderItems.reduce(
            (
              total,
              item,
            ) =>
              total
              + Number(
                item.quantity
                ?? 0,
              ),
            0,
          ),
      };
    },
  );
}

export async function getOrder(
  companyId: string,
  orderId: string,
) {
  const encodedCompanyId =
    companyFilter(companyId);

  const encodedOrderId =
    encodeURIComponent(orderId);

  const orders =
    await supabaseRequest<
      Array<Record<string, unknown>>
    >({
      table:
        "commerce_orders",

      query:
        `?company_id=eq.${encodedCompanyId}`
        + `&id=eq.${encodedOrderId}`
        + "&select=*"
        + "&limit=1",
    });

  const order =
    orders[0];

  if (!order) {
    return null;
  }

  const customerId =
    String(
      order.customer_id
      ?? "",
    );

  const [
    items,
    customers,
    reservations,
    payments,
    events,
    fulfillments,
    shipments,
    packages,
  ] =
    await Promise.all([
      supabaseRequest<
        Array<Record<string, unknown>>
      >({
        table:
          "commerce_order_items",

        query:
          `?company_id=eq.${encodedCompanyId}`
          + `&order_id=eq.${encodedOrderId}`
          + "&select=*"
          + "&order=created_at.asc",
      }),

      customerId
        ? supabaseRequest<
            Array<Record<string, unknown>>
          >({
            table:
              "commerce_customers",

            query:
              `?company_id=eq.${encodedCompanyId}`
              + `&id=eq.${encodeURIComponent(customerId)}`
              + "&select=*"
              + "&limit=1",
          })
        : Promise.resolve([]),

      supabaseRequest<
        Array<Record<string, unknown>>
      >({
        table:
          "commerce_reservations",

        query:
          `?company_id=eq.${encodedCompanyId}`
          + `&order_id=eq.${encodedOrderId}`
          + "&select=*"
          + "&order=created_at.desc"
          + "&limit=1",
      }),

      supabaseRequest<
        Array<Record<string, unknown>>
      >({
        table:
          "commerce_payments",

        query:
          `?company_id=eq.${encodedCompanyId}`
          + `&order_id=eq.${encodedOrderId}`
          + "&select=*"
          + "&order=created_at.desc",
      }),

      supabaseRequest<
        Array<Record<string, unknown>>
      >({
        table:
          "commerce_order_events",

        query:
          `?company_id=eq.${encodedCompanyId}`
          + `&order_id=eq.${encodedOrderId}`
          + "&select=*"
          + "&order=created_at.desc",
      }),

      supabaseRequest<
        Array<Record<string, unknown>>
      >({
        table:
          "commerce_fulfillments",

        query:
          `?company_id=eq.${encodedCompanyId}`
          + `&order_id=eq.${encodedOrderId}`
          + "&select=*"
          + "&limit=1",
      }),

      supabaseRequest<
        Array<Record<string, unknown>>
      >({
        table:
          "commerce_shipments",

        query:
          `?company_id=eq.${encodedCompanyId}`
          + `&order_id=eq.${encodedOrderId}`
          + "&select=*"
          + "&limit=1",
      }),

      supabaseRequest<
        Array<Record<string, unknown>>
      >({
        table:
          "commerce_packages",

        query:
          `?company_id=eq.${encodedCompanyId}`
          + `&order_id=eq.${encodedOrderId}`
          + "&select=*"
          + "&order=package_number.asc",
      }),
    ]);

  return {
    ...order,

    customer:
      customers[0]
      ?? null,

    reservation:
      reservations[0]
      ?? null,

    fulfillment:
      fulfillments[0]
      ?? null,

    shipment:
      shipments[0]
      ?? null,

    items,
    payments,
    events,
    packages,

    item_count:
      items.reduce(
        (
          total,
          item,
        ) =>
          total
          + Number(
            item.quantity
            ?? 0,
          ),
        0,
      ),
  };
}

export async function createOrder(
  companyId: string,
  input: CreateOrderInput,
  actor: CommerceActor,
) {
  return supabaseRpc<Record<string, unknown>>(
    "commerce_create_order",
    {
      p_company_id:
        companyId,

      p_customer:
        input.customer,

      p_lines:
        input.lines,

      p_options:
        input.options ?? {},

      p_actor: {
        id:
          actor.id,

        name:
          actor.name,

        email:
          actor.email,

        role:
          actor.role,
      },
    },
  );
}

export async function recordPayment(
  companyId: string,
  orderId: string,
  input: RecordPaymentInput,
  actor: CommerceActor,
) {
  const existing =
    await getOrder(
      companyId,
      orderId,
    );

  if (!existing) {
    return null;
  }

  return supabaseRpc<Record<string, unknown>>(
    "commerce_record_payment",
    {
      p_order_id:
        orderId,

      p_amount:
        input.amount,

      p_method:
        input.method,

      p_reference:
        input.reference ?? null,

      p_actor: {
        id:
          actor.id,

        name:
          actor.name,

        email:
          actor.email,

        role:
          actor.role,
      },
    },
  );
}

export async function transitionFulfillment(
  companyId: string,
  orderId: string,
  input: FulfillmentInput,
  actor: CommerceActor,
) {
  const existing =
    await getOrder(
      companyId,
      orderId,
    );

  if (!existing) {
    return null;
  }

  return supabaseRpc<Record<string, unknown>>(
    "commerce_transition_fulfillment",
    {
      p_order_id:
        orderId,

      p_action:
        input.action,

      p_payload:
        input.payload ?? {},

      p_actor: {
        id:
          actor.id,

        name:
          actor.name,

        email:
          actor.email,

        role:
          actor.role,
      },
    },
  );
}

export async function listCustomerOrdersByPhone(
  companyId: string,
  phone: string,
): Promise<
  Array<
    Record<string, unknown>
    & {
      customer:
        Record<string, unknown>;

      items:
        Array<
          Record<string, unknown>
        >;
    }
  >
> {
  const encodedCompanyId =
    encodeURIComponent(companyId);

  const encodedPhone =
    encodeURIComponent(phone);

  const customers =
    await supabaseRequest<
      Array<Record<string, unknown>>
    >({
      table:
        "commerce_customers",

      query:
        `?company_id=eq.${encodedCompanyId}`
        + `&whatsapp=eq.${encodedPhone}`
        + "&select=id,name,business_name,whatsapp"
        + "&limit=1",
    });

  const customer =
    customers[0];

  const customerId =
    typeof customer?.id === "string"
      ? customer.id
      : null;

  if (!customerId) {
    return [];
  }

  const orders =
    await supabaseRequest<
      Array<Record<string, unknown>>
    >({
      table:
        "commerce_orders",

      query:
        `?company_id=eq.${encodedCompanyId}`
        + `&customer_id=eq.${encodeURIComponent(customerId)}`
        + "&select=*"
        + "&order=created_at.desc"
        + "&limit=100",
    });

  if (!orders.length) {
    return [];
  }

  const orderIds =
    orders
      .map(
        (order) =>
          typeof order.id === "string"
            ? order.id
            : null,
      )
      .filter(
        (value):
          value is string =>
            Boolean(value),
      );

  const items =
    orderIds.length
      ? await supabaseRequest<
          Array<Record<string, unknown>>
        >({
          table:
            "commerce_order_items",

          query:
            `?company_id=eq.${encodedCompanyId}`
            + `&order_id=in.(${orderIds
              .map(
                (id) =>
                  encodeURIComponent(id),
              )
              .join(",")})`
            + "&select=*"
            + "&order=created_at.asc",
        })
      : [];

  const itemsByOrder =
    new Map<
      string,
      Array<Record<string, unknown>>
    >();

  for (const item of items) {
    const orderId =
      typeof item.order_id === "string"
        ? item.order_id
        : "";

    const current =
      itemsByOrder.get(orderId)
      ?? [];

    current.push(item);

    itemsByOrder.set(
      orderId,
      current,
    );
  }

  return orders.map(
    (order) => {
      const orderId =
        typeof order.id === "string"
          ? order.id
          : "";

      return {
        ...order,

        customer,

        items:
          itemsByOrder.get(orderId)
          ?? [],
      };
    },
  );
}

export async function buildCustomerOrderHistoryContext(
  companyId: string,
  phone: string,
  customerMessage = "",
) {
  const orders =
    await listCustomerOrdersByPhone(
      companyId,
      phone,
    );

  if (!orders.length) {
    return [
      "CONSULTA DE PEDIDOS:",
      "El cliente no tiene pedidos registrados.",
    ].join("\n");
  }

  const normalizedMessage =
    customerMessage
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .toLowerCase();

  /*
   * Sólo mostramos historial completo cuando
   * el cliente lo pide expresamente.
   */
  const wantsHistory =
    /\b(historial|anteriores|anterior|viejos|viejo|pasados|pasado|compras anteriores|compras pasadas|pedidos cancelados|pedidos pagados|que compre|que compre antes)\b/i
      .test(
        normalizedMessage,
      );

  /*
   * "Qué pedidos tengo", "mis pedidos",
   * "qué pedidos están pendientes", etc.
   *
   * Activo = todavía requiere una acción comercial/pago.
   */
  const activeOrders =
    orders.filter(
      (order) => {
        const commercialStatus =
          String(
            order.commercial_status
            ?? "",
          );

        const paymentStatus =
          String(
            order.payment_status
            ?? "",
          );

        return (
          commercialStatus
            !== "cancelled"
          && (
            paymentStatus
              === "unpaid"
            || paymentStatus
              === "partial"
          )
        );
      },
    );

  const selectedOrders =
    wantsHistory
      ? orders
      : activeOrders;

  if (
    !wantsHistory
    && selectedOrders.length === 0
  ) {
    return [
      "CONSULTA DE PEDIDOS ACTIVOS:",
      "El cliente no tiene pedidos activos ni pendientes de pago.",
      "No mencionar pedidos pagados ni cancelados salvo que el cliente pida expresamente su historial.",
    ].join("\n");
  }

  const formatted =
    selectedOrders
      .slice(0, 20)
      .map(
        (order) => {
          const items =
            Array.isArray(
              order.items,
            )
              ? order.items
              : [];

          const itemDescription =
            items.length
              ? items
                  .map(
                    (item) => {
                      const quantity =
                        Number(
                          item.quantity
                          ?? 0,
                        );

                      const details = [
                        item.product_name_snapshot,

                        item.color_name_snapshot,

                        item.size_snapshot
                          ? `talle ${item.size_snapshot}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" ");

                      return `${quantity} × ${details}`;
                    },
                  )
                  .join(", ")
              : "Sin detalle de productos";

          const paymentStatus =
            String(
              order.payment_status
              ?? "desconocido",
            );

          const commercialStatus =
            String(
              order.commercial_status
              ?? "desconocido",
            );

          const amount =
            Number(
              order.total
              ?? 0,
            );

          const paid =
            Number(
              order.paid_amount
              ?? 0,
            );

          const remaining =
            Math.max(
              0,
              amount
              - paid,
            );

          return [
            `Pedido ${String(order.number ?? order.id ?? "")}`,
            `productos: ${itemDescription}`,
            `total: ${String(order.currency ?? "ARS")} ${amount}`,
            `saldo pendiente: ${String(order.currency ?? "ARS")} ${remaining}`,
            `pago: ${paymentStatus}`,
            `estado comercial: ${commercialStatus}`,
          ].join(" · ");
        },
      )
      .join("\n");

  return [
    wantsHistory
      ? "HISTORIAL DE PEDIDOS SOLICITADO POR EL CLIENTE:"
      : "PEDIDOS ACTIVOS DEL CLIENTE:",

    formatted,

    "",

    wantsHistory
      ? "El cliente pidió expresamente historial, por lo que puedes mencionar pedidos pagados o cancelados."
      : "IMPORTANTE: ante preguntas como 'qué pedidos tengo' o 'mis pedidos', responder SOLAMENTE con esta lista activa. No agregar pedidos pagados, cancelados, reembolsados ni históricos.",
  ].join("\n");
}


export type OrderMutationOperation =
  | {
      type: "add_item";
      variant_id: string;
      quantity: number;
      unit_price?: number;
    }
  | {
      type: "set_quantity";
      order_item_id: string;
      quantity: number;
    }
  | {
      type: "remove_item";
      order_item_id: string;
    }
  | {
      type: "replace_variant";
      order_item_id: string;
      new_variant_id: string;
      quantity?: number;
    };

export type MutateOrderInput = {
  expectedVersion?: number | null;
  idempotencyKey: string;
  operations: OrderMutationOperation[];
  source:
    | "whatsapp"
    | "panel"
    | "api"
    | "system";
  messageId?: string | null;
};

export async function mutateOrder(
  companyId: string,
  orderId: string,
  input: MutateOrderInput,
  actor: CommerceActor,
) {
  if (!companyId.trim()) {
    throw new Error(
      "companyId es obligatorio",
    );
  }

  if (!orderId.trim()) {
    throw new Error(
      "orderId es obligatorio",
    );
  }

  if (
    input.idempotencyKey.trim().length
    < 8
  ) {
    throw new Error(
      "La clave de idempotencia es inválida",
    );
  }

  if (
    !Array.isArray(
      input.operations,
    )
    || input.operations.length === 0
  ) {
    throw new Error(
      "La mutación necesita al menos una operación",
    );
  }

  if (
    input.operations.length > 50
  ) {
    throw new Error(
      "La mutación supera el máximo de 50 operaciones",
    );
  }

  for (
    const operation
    of input.operations
  ) {
    if (
      operation.type
      === "add_item"
    ) {
      if (
        !operation.variant_id
        || !Number.isInteger(
          operation.quantity,
        )
        || operation.quantity <= 0
        || (
          operation.unit_price !== undefined
          && (
            !Number.isFinite(
              operation.unit_price,
            )
            || operation.unit_price < 0
          )
        )
      ) {
        throw new Error(
          "Operación add_item inválida",
        );
      }
    }

    if (
      operation.type
      === "set_quantity"
    ) {
      if (
        !operation.order_item_id
        || !Number.isInteger(
          operation.quantity,
        )
        || operation.quantity < 0
      ) {
        throw new Error(
          "Operación set_quantity inválida",
        );
      }
    }

    if (
      operation.type
      === "remove_item"
      && !operation.order_item_id
    ) {
      throw new Error(
        "Operación remove_item inválida",
      );
    }

    if (
      operation.type
      === "replace_variant"
    ) {
      if (
        !operation.order_item_id
        || !operation.new_variant_id
        || (
          operation.quantity
          !== undefined
          && (
            !Number.isInteger(
              operation.quantity,
            )
            || operation.quantity <= 0
          )
        )
      ) {
        throw new Error(
          "Operación replace_variant inválida",
        );
      }
    }
  }

  return supabaseRpc<
    Record<string, unknown>
  >(
    "commerce_mutate_order",
    {
      p_company_id:
        companyId,

      p_order_id:
        orderId,

      p_expected_version:
        input.expectedVersion
        ?? null,

      p_idempotency_key:
        input.idempotencyKey,

      p_operations:
        input.operations,

      p_source:
        input.source,

      p_message_id:
        input.messageId
        ?? null,

      p_actor: {
        id:
          actor.id,

        name:
          actor.name,

        email:
          actor.email,

        role:
          actor.role,
      },
    },
  );
}
