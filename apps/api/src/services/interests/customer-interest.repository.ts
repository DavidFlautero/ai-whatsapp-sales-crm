import {
  env,
} from "../../config/env.js";

import {
  isSupabaseConfigured,
  supabaseRequest,
} from "../db/supabase-rest.client.js";

import {
  upsertContact,
} from "../crm/crm.repository.js";

export type CustomerInterestEventType =
  | "product_mentioned"
  | "product_matched"
  | "product_shown"
  | "product_rejected"
  | "product_added"
  | "product_ordered"
  | "product_purchased"
  | "color_mentioned"
  | "size_mentioned"
  | "price_objection"
  | "stock_objection"
  | "purchase_intent";

export type CustomerInterestEvent = {
  id?: string;

  company_id?: string;
  contact_id?: string;
  contact_phone: string;

  event_type:
    CustomerInterestEventType;

  product_id?: string | null;
  variant_id?: string | null;

  sku?: string | null;
  product_name?: string | null;
  color_name?: string | null;
  size_value?: string | null;

  value?: string | null;
  reason?: string | null;
  quantity?: number | null;

  confidence?: number;
  source?: string;

  message_id?: string | null;
  order_id?: string | null;

  metadata?:
    Record<string, unknown>;

  occurred_at?: string;
  created_at?: string;
};

const memoryEvents:
  CustomerInterestEvent[] = [];

function cleanText(
  value:
    | string
    | null
    | undefined,
) {
  const result =
    value?.trim();

  return result
    ? result
    : null;
}

export async function recordCustomerInterestEvent(
  input: CustomerInterestEvent,
  companyId =
    env.DEFAULT_COMPANY_ID,
) {
  const phone =
    input.contact_phone
      .trim();

  if (!phone) {
    throw new Error(
      "CUSTOMER_INTEREST_PHONE_REQUIRED",
    );
  }

  const contact =
    await upsertContact(
      {
        phone,
      },
      companyId,
    );

  if (!contact.id) {
    throw new Error(
      "CUSTOMER_INTEREST_CONTACT_REQUIRED",
    );
  }

  const item:
    CustomerInterestEvent = {
      company_id:
        companyId,

      contact_id:
        contact.id,

      contact_phone:
        phone,

      event_type:
        input.event_type,

      product_id:
        cleanText(
          input.product_id,
        ),

      variant_id:
        cleanText(
          input.variant_id,
        ),

      sku:
        cleanText(
          input.sku,
        ),

      product_name:
        cleanText(
          input.product_name,
        ),

      color_name:
        cleanText(
          input.color_name,
        ),

      size_value:
        cleanText(
          input.size_value,
        ),

      value:
        cleanText(
          input.value,
        ),

      reason:
        cleanText(
          input.reason,
        ),

      quantity:
        input.quantity
        ?? null,

      confidence:
        Math.max(
          0,
          Math.min(
            100,
            input.confidence
            ?? 80,
          ),
        ),

      source:
        input.source
        ?? "message_analysis",

      message_id:
        cleanText(
          input.message_id,
        ),

      order_id:
        cleanText(
          input.order_id,
        ),

      metadata:
        input.metadata
        ?? {},

      occurred_at:
        input.occurred_at
        ?? new Date()
          .toISOString(),
    };

  if (
    !isSupabaseConfigured()
  ) {
    const duplicate =
      memoryEvents.find(
        (event) =>
          event.company_id
            === companyId
          && event.message_id
            === item.message_id
          && event.event_type
            === item.event_type
          && event.product_id
            === item.product_id
          && event.variant_id
            === item.variant_id
          && event.value
            === item.value,
      );

    if (duplicate) {
      return duplicate;
    }

    const stored = {
      ...item,

      id:
        crypto.randomUUID(),

      created_at:
        new Date()
          .toISOString(),
    };

    memoryEvents.unshift(
      stored,
    );

    return stored;
  }

  const rows =
    await supabaseRequest<
      CustomerInterestEvent[]
    >({
      table:
        "commerce_customer_interest_events",

      method:
        "POST",

      prefer:
        "resolution=ignore-duplicates,return=representation",

      body: [
        item,
      ],
    });

  return rows[0]
    ?? null;
}

export async function recordCustomerInterestEvents(
  events:
    CustomerInterestEvent[],
  companyId =
    env.DEFAULT_COMPANY_ID,
) {
  const stored = [];

  for (
    const event
    of events
  ) {
    stored.push(
      await recordCustomerInterestEvent(
        event,
        companyId,
      ),
    );
  }

  return stored.filter(
    Boolean,
  );
}

export async function listCustomerInterestEvents(
  phone?: string,
  companyId =
    env.DEFAULT_COMPANY_ID,
  limit = 150,
) {
  const safeLimit =
    Math.max(
      1,
      Math.min(
        limit,
        500,
      ),
    );

  if (
    !isSupabaseConfigured()
  ) {
    return memoryEvents
      .filter(
        (event) =>
          event.company_id
            === companyId,
      )
      .filter(
        (event) =>
          phone
            ? event.contact_phone
              === phone
            : true,
      )
      .slice(
        0,
        safeLimit,
      );
  }

  const phoneFilter =
    phone
      ? `&contact_phone=eq.${encodeURIComponent(phone)}`
      : "";

  return supabaseRequest<
    CustomerInterestEvent[]
  >({
    table:
      "commerce_customer_interest_events",

    query:
      `?company_id=eq.${encodeURIComponent(companyId)}`
      + phoneFilter
      + "&select=*"
      + "&order=occurred_at.desc"
      + `&limit=${safeLimit}`,
  });
}

export async function listRecentlyShownProductIds(
  phone: string,
  companyId =
    env.DEFAULT_COMPANY_ID,
  hours = 24,
) {
  const events =
    await listCustomerInterestEvents(
      phone,
      companyId,
      200,
    );

  const cutoff =
    Date.now()
    - hours
      * 60
      * 60
      * 1000;

  return new Set(
    events
      .filter(
        (event) =>
          event.event_type
            === "product_shown",
      )
      .filter(
        (event) => {
          const time =
            new Date(
              event.occurred_at
              ?? event.created_at
              ?? 0,
            ).getTime();

          return (
            Number.isFinite(time)
            && time >= cutoff
          );
        },
      )
      .map(
        (event) =>
          event.product_id
          ?? "",
      )
      .filter(Boolean),
  );
}
