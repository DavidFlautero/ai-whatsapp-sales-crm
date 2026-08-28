import {
  supabaseRequest,
  supabaseRpc,
} from "../db/supabase-rest.client.js";

import type {
  CommerceActor,
} from "../orders/order.service.js";

export type AdminPaymentSubmission = {
  id: string;
  company_id: string;
  customer_id?: string | null;
  order_id?: string | null;
  payment_account_id?: string | null;
  payment_id?: string | null;

  source?: string | null;

  message_id?: string | null;
  whatsapp_message_id?: string | null;
  customer_phone?: string | null;

  media_type?: string | null;
  media_mime_type?: string | null;

  declared_amount?: number | string | null;
  detected_amount?: number | string | null;
  detected_date?: string | null;
  detected_institution?: string | null;
  detected_reference?: string | null;
  detected_holder?: string | null;
  extraction_confidence?: number | string | null;

  status: string;

  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;

  created_at: string;
  updated_at?: string | null;

  customer?: {
    id: string;
    name?: string | null;
    business_name?: string | null;
    whatsapp?: string | null;
  } | null;

  order?: {
    id: string;
    number?: string | null;
    total?: number | string | null;
    paid_amount?: number | string | null;
    payment_status?: string | null;
    currency?: string | null;

    items?: Array<{
      id: string;
      quantity: number;
      unit_price: number;
      final_unit_price: number;
      subtotal: number;

      product?: {
        id: string;
        name?: string | null;
      } | null;

      variant?: {
        id: string;
        sku?: string | null;
        color_name?: string | null;
        size?: string | null;
      } | null;
    }>;
  } | null;
};

export async function listPaymentSubmissions(
  companyId: string,
  status = "pending_review",
): Promise<AdminPaymentSubmission[]> {
  const encodedCompanyId =
    encodeURIComponent(companyId);

  const encodedStatus =
    encodeURIComponent(status);

  const submissions =
    await supabaseRequest<AdminPaymentSubmission[]>({
      table:
        "commerce_payment_submissions",

      query:
        `?company_id=eq.${encodedCompanyId}`
        + `&status=eq.${encodedStatus}`
        + "&select=*"
        + "&order=created_at.desc"
        + "&limit=200",
    });

  if (submissions.length === 0) {
    return submissions;
  }

  const customerIds = [
    ...new Set(
      submissions
        .map((submission) => submission.customer_id)
        .filter(
          (value): value is string =>
            typeof value === "string"
            && value.length > 0,
        ),
    ),
  ];

  const orderIds = [
    ...new Set(
      submissions
        .map((submission) => submission.order_id)
        .filter(
          (value): value is string =>
            typeof value === "string"
            && value.length > 0,
        ),
    ),
  ];

  type CustomerRow = {
    id: string;
    name?: string | null;
    business_name?: string | null;
    whatsapp?: string | null;
  };

  type OrderRow = {
    id: string;
    number?: string | null;
    total?: number | string | null;
    paid_amount?: number | string | null;
    payment_status?: string | null;
    currency?: string | null;
  };

  const [customers, orders] =
    await Promise.all([
      customerIds.length
        ? supabaseRequest<CustomerRow[]>({
            table:
              "commerce_customers",

            query:
              `?company_id=eq.${encodedCompanyId}`
              + `&id=in.(${customerIds
                .map((id) => encodeURIComponent(id))
                .join(",")})`
              + "&select=id,name,business_name,whatsapp",
          })
        : Promise.resolve([]),

      orderIds.length
        ? supabaseRequest<OrderRow[]>({
            table:
              "commerce_orders",

            query:
              `?company_id=eq.${encodedCompanyId}`
              + `&id=in.(${orderIds
                .map((id) => encodeURIComponent(id))
                .join(",")})`
              + "&select=id,number,total,paid_amount,payment_status,currency",
          })
        : Promise.resolve([]),
    ]);

  type OrderItemRow = {
    id: string;
    order_id: string;
    product_id?: string | null;
    variant_id?: string | null;
    quantity?: number | string | null;
    unit_price?: number | string | null;
    final_unit_price?: number | string | null;
    subtotal?: number | string | null;
  };

  type ProductRow = {
    id: string;
    name?: string | null;
  };

  type VariantRow = {
    id: string;
    sku?: string | null;
    color_name?: string | null;
    size?: string | null;
  };

  const orderItems =
    orderIds.length
      ? await supabaseRequest<OrderItemRow[]>({
          table:
            "commerce_order_items",

          query:
            `?company_id=eq.${encodedCompanyId}`
            + `&order_id=in.(${orderIds
              .map((id) => encodeURIComponent(id))
              .join(",")})`
            + "&select=*",
        })
      : [];

  const productIds = [
    ...new Set(
      orderItems
        .map(
          (item) =>
            item.product_id,
        )
        .filter(
          (value): value is string =>
            typeof value === "string"
            && value.length > 0,
        ),
    ),
  ];

  const variantIds = [
    ...new Set(
      orderItems
        .map(
          (item) =>
            item.variant_id,
        )
        .filter(
          (value): value is string =>
            typeof value === "string"
            && value.length > 0,
        ),
    ),
  ];

  const [products, variants] =
    await Promise.all([
      productIds.length
        ? supabaseRequest<ProductRow[]>({
            table:
              "commerce_products",

            query:
              `?company_id=eq.${encodedCompanyId}`
              + `&id=in.(${productIds
                .map((id) => encodeURIComponent(id))
                .join(",")})`
              + "&select=id,name",
          })
        : Promise.resolve([]),

      variantIds.length
        ? supabaseRequest<VariantRow[]>({
            table:
              "commerce_product_variants",

            query:
              `?company_id=eq.${encodedCompanyId}`
              + `&id=in.(${variantIds
                .map((id) => encodeURIComponent(id))
                .join(",")})`
              + "&select=id,sku,color_name,size",
          })
        : Promise.resolve([]),
    ]);

  const productsById =
    new Map(
      products.map(
        (product) => [
          product.id,
          product,
        ],
      ),
    );

  const variantsById =
    new Map(
      variants.map(
        (variant) => [
          variant.id,
          variant,
        ],
      ),
    );

  const itemsByOrderId =
    new Map<
      string,
      NonNullable<
        AdminPaymentSubmission["order"]
      >["items"]
    >();

  for (
    const item
    of orderItems
  ) {
    const current =
      itemsByOrderId.get(
        item.order_id,
      )
      ?? [];

    const quantity =
      Number(
        item.quantity
        ?? 0,
      );

    const unitPrice =
      Number(
        item.unit_price
        ?? 0,
      );

    const finalUnitPrice =
      Number(
        item.final_unit_price
        ?? unitPrice,
      );

    const subtotal =
      Number(
        item.subtotal
        ?? (
          quantity
          * finalUnitPrice
        ),
      );

    current.push({
      id:
        item.id,

      quantity:
        Number.isFinite(quantity)
          ? quantity
          : 0,

      unit_price:
        Number.isFinite(unitPrice)
          ? unitPrice
          : 0,

      final_unit_price:
        Number.isFinite(finalUnitPrice)
          ? finalUnitPrice
          : 0,

      subtotal:
        Number.isFinite(subtotal)
          ? subtotal
          : 0,

      product:
        item.product_id
          ? productsById.get(
              item.product_id,
            ) ?? null
          : null,

      variant:
        item.variant_id
          ? variantsById.get(
              item.variant_id,
            ) ?? null
          : null,
    });

    itemsByOrderId.set(
      item.order_id,
      current,
    );
  }

  const customersById =
    new Map(
      customers.map(
        (customer) => [
          customer.id,
          customer,
        ],
      ),
    );

  const ordersById =
    new Map(
      orders.map(
        (order) => [
          order.id,
          order,
        ],
      ),
    );

  return submissions.map(
    (submission) => ({
      ...submission,

      customer:
        submission.customer_id
          ? customersById.get(
              submission.customer_id,
            ) ?? null
          : null,

      order:
        submission.order_id
          ? (() => {
              const order =
                ordersById.get(
                  submission.order_id,
                );

              if (!order) {
                return null;
              }

              return {
                ...order,

                items:
                  itemsByOrderId.get(
                    submission.order_id,
                  )
                  ?? [],
              };
            })()
          : null,
    }),
  );
}

export async function approvePaymentSubmission(
  companyId: string,
  submissionId: string,
  amount: number,
  actor: CommerceActor,
) {
  return supabaseRpc<Record<string, unknown>>(
    "commerce_approve_payment_submission_bundle",
    {
      p_company_id:
        companyId,

      p_submission_id:
        submissionId,

      p_amount:
        amount,

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

export async function rejectPaymentSubmission(
  companyId: string,
  submissionId: string,
  reason: string,
  actor: CommerceActor,
) {
  return supabaseRpc<Record<string, unknown>>(
    "commerce_reject_payment_submission_bundle",
    {
      p_company_id:
        companyId,

      p_submission_id:
        submissionId,

      p_reason:
        reason,

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
