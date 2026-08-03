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
  return supabaseRequest<Array<Record<string, unknown>>>({
    table: "commerce_orders",
    query:
      `?company_id=eq.${companyFilter(companyId)}`
      + "&select=*"
      + "&order=created_at.desc"
      + "&limit=200",
  });
}

export async function getOrder(
  companyId: string,
  orderId: string,
) {
  const orders =
    await supabaseRequest<Array<Record<string, unknown>>>({
      table: "commerce_orders",
      query:
        `?company_id=eq.${companyFilter(companyId)}`
        + `&id=eq.${encodeURIComponent(orderId)}`
        + "&select=*"
        + "&limit=1",
    });

  const order =
    orders[0];

  if (!order) {
    return null;
  }

  const items =
    await supabaseRequest<Array<Record<string, unknown>>>({
      table: "commerce_order_items",
      query:
        `?company_id=eq.${companyFilter(companyId)}`
        + `&order_id=eq.${encodeURIComponent(orderId)}`
        + "&select=*"
        + "&order=created_at.asc",
    });

  return {
    ...order,
    items,
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
