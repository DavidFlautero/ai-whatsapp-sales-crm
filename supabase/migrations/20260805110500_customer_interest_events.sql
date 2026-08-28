begin;

create table if not exists
public.commerce_customer_interest_events (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  contact_id uuid not null
    references public.crm_contacts(id)
    on delete cascade,

  contact_phone text not null,

  event_type text not null
    check (
      event_type in (
        'product_mentioned',
        'product_matched',
        'product_shown',
        'product_rejected',
        'product_added',
        'product_ordered',
        'product_purchased',
        'color_mentioned',
        'size_mentioned',
        'price_objection',
        'stock_objection',
        'purchase_intent'
      )
    ),

  product_id uuid
    references public.commerce_products(id)
    on delete set null,

  variant_id uuid
    references public.commerce_product_variants(id)
    on delete set null,

  sku text,
  product_name text,
  color_name text,
  size_value text,

  value text,
  reason text,

  quantity integer
    check (
      quantity is null
      or quantity > 0
    ),

  confidence integer not null default 80
    check (
      confidence between 0 and 100
    ),

  source text not null default 'message_analysis',

  message_id uuid
    references public.messages(id)
    on delete set null,

  order_id uuid
    references public.commerce_orders(id)
    on delete set null,

  metadata jsonb not null default '{}'::jsonb,

  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists
commerce_customer_interest_events_contact_idx
on public.commerce_customer_interest_events (
  company_id,
  contact_phone,
  occurred_at desc
);

create index if not exists
commerce_customer_interest_events_product_idx
on public.commerce_customer_interest_events (
  company_id,
  product_id,
  event_type,
  occurred_at desc
);

create index if not exists
commerce_customer_interest_events_order_idx
on public.commerce_customer_interest_events (
  company_id,
  order_id
);

create unique index if not exists
commerce_customer_interest_events_message_event_unique
on public.commerce_customer_interest_events (
  company_id,
  message_id,
  event_type,
  coalesce(product_id::text, ''),
  coalesce(variant_id::text, ''),
  coalesce(value, '')
)
where message_id is not null;

alter table
public.commerce_customer_interest_events
enable row level security;

revoke all
on table public.commerce_customer_interest_events
from public;

grant all
on table public.commerce_customer_interest_events
to service_role;

commit;
