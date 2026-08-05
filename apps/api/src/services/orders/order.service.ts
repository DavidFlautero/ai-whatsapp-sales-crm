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
