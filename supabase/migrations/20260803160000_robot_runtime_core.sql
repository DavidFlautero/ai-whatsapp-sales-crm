begin;

create extension if not exists pgcrypto;

create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  phone text not null,
  name text,
  business_name text,

  status text not null default 'lead'
    check (
      status in (
        'lead',
        'customer',
        'inactive',
        'blocked'
      )
    ),

  temperature text not null default 'warm'
    check (
      temperature in (
        'cold',
        'warm',
        'hot'
      )
    ),

  ai_score integer not null default 50
    check (
      ai_score between 0 and 100
    ),

  total_sales numeric(14,2) not null default 0
    check (
      total_sales >= 0
    ),

  last_message text,
  last_seen_at timestamptz not null default now(),

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  constraint crm_contacts_company_phone_key
    unique (
      company_id,
      phone
    )
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  contact_id uuid not null
    references public.crm_contacts(id)
    on delete cascade,

  contact_phone text not null,

  channel text not null default 'whatsapp'
    check (
      channel in (
        'whatsapp',
        'web',
        'instagram',
        'facebook',
        'manual'
      )
    ),

  external_conversation_id text,

  status text not null default 'open'
    check (
      status in (
        'open',
        'pending',
        'closed',
        'archived'
      )
    ),

  assigned_to text,

  last_message text,
  last_message_at timestamptz not null default now(),

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,

  constraint conversations_company_contact_channel_key
    unique (
      company_id,
      contact_id,
      channel
    )
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  conversation_id uuid not null
    references public.conversations(id)
    on delete cascade,

  contact_id uuid not null
    references public.crm_contacts(id)
    on delete cascade,

  contact_phone text not null,

  external_message_id text,

  direction text not null
    check (
      direction in (
        'inbound',
        'outbound'
      )
    ),

  channel text not null default 'whatsapp',

  message_type text not null default 'text'
    check (
      message_type in (
        'text',
        'image',
        'audio',
        'video',
        'document',
        'location',
        'interactive',
        'unknown'
      )
    ),

  body text,

  media jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,

  delivery_status text not null default 'received'
    check (
      delivery_status in (
        'received',
        'queued',
        'sent',
        'delivered',
        'read',
        'failed'
      )
    ),

  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index uq_messages_company_external_id
on public.messages (
  company_id,
  external_message_id
)
where external_message_id is not null;

create table public.ai_prompts (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  type text not null,
  title text not null,
  prompt text not null,

  version integer not null default 1
    check (
      version > 0
    ),

  active boolean not null default true,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ai_prompts_company_type_key
    unique (
      company_id,
      type
    )
);

create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  type text not null default 'catalog',
  title text not null,
  content text not null,

  tags text[] not null default '{}',

  source text not null default 'manual',

  version integer not null default 1
    check (
      version > 0
    ),

  active boolean not null default true,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.customer_memories (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  contact_id uuid not null
    references public.crm_contacts(id)
    on delete cascade,

  contact_phone text not null,

  key text not null,
  value text not null,

  confidence integer not null default 70
    check (
      confidence between 0 and 100
    ),

  source text not null default 'ai',

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint customer_memories_company_contact_key
    unique (
      company_id,
      contact_id,
      key
    )
);

drop trigger if exists trg_crm_contacts_updated_at
on public.crm_contacts;

create trigger trg_crm_contacts_updated_at
before update on public.crm_contacts
for each row
execute function public.commerce_touch_updated_at();

drop trigger if exists trg_conversations_updated_at
on public.conversations;

create trigger trg_conversations_updated_at
before update on public.conversations
for each row
execute function public.commerce_touch_updated_at();

drop trigger if exists trg_ai_prompts_updated_at
on public.ai_prompts;

create trigger trg_ai_prompts_updated_at
before update on public.ai_prompts
for each row
execute function public.commerce_touch_updated_at();

drop trigger if exists trg_knowledge_items_updated_at
on public.knowledge_items;

create trigger trg_knowledge_items_updated_at
before update on public.knowledge_items
for each row
execute function public.commerce_touch_updated_at();

drop trigger if exists trg_customer_memories_updated_at
on public.customer_memories;

create trigger trg_customer_memories_updated_at
before update on public.customer_memories
for each row
execute function public.commerce_touch_updated_at();

alter table public.crm_contacts
  enable row level security;

alter table public.conversations
  enable row level security;

alter table public.messages
  enable row level security;

alter table public.ai_prompts
  enable row level security;

alter table public.knowledge_items
  enable row level security;

alter table public.customer_memories
  enable row level security;

revoke all on table public.crm_contacts
from anon, authenticated;

revoke all on table public.conversations
from anon, authenticated;

revoke all on table public.messages
from anon, authenticated;

revoke all on table public.ai_prompts
from anon, authenticated;

revoke all on table public.knowledge_items
from anon, authenticated;

revoke all on table public.customer_memories
from anon, authenticated;

grant all on table public.crm_contacts
to service_role;

grant all on table public.conversations
to service_role;

grant all on table public.messages
to service_role;

grant all on table public.ai_prompts
to service_role;

grant all on table public.knowledge_items
to service_role;

grant all on table public.customer_memories
to service_role;

create index idx_crm_contacts_company_last_seen
on public.crm_contacts (
  company_id,
  last_seen_at desc
);

create index idx_conversations_company_last_message
on public.conversations (
  company_id,
  last_message_at desc
);

create index idx_messages_company_conversation
on public.messages (
  company_id,
  conversation_id,
  occurred_at desc
);

create index idx_messages_company_phone
on public.messages (
  company_id,
  contact_phone,
  occurred_at desc
);

create index idx_ai_prompts_company_type
on public.ai_prompts (
  company_id,
  type
);

create index idx_knowledge_items_company_active
on public.knowledge_items (
  company_id,
  active,
  updated_at desc
);

create index idx_customer_memories_company_contact
on public.customer_memories (
  company_id,
  contact_id,
  updated_at desc
);

insert into public.ai_prompts (
  company_id,
  type,
  title,
  prompt,
  active
)
values
(
  'fulanitas',
  'sales',
  'Sales Agent',
  'Eres un vendedor humano, cálido y directo. Vendes por WhatsApp con naturalidad. Detectas intención de compra, preguntas lo justo y llevas al cliente hacia catálogo, stock o pedido sin inventar precio ni disponibilidad.',
  true
),
(
  'fulanitas',
  'followup',
  'Followup Agent',
  'Recontacta clientes con tono humano, corto y sin presión. Usa historial, producto de interés y una llamada a la acción clara.',
  true
),
(
  'fulanitas',
  'recovery',
  'Recovery Agent',
  'Recupera clientes inactivos con mensajes personalizados, novedades relevantes y una propuesta concreta.',
  true
)
on conflict (
  company_id,
  type
)
do nothing;


insert into public.knowledge_items (
  company_id,
  type,
  title,
  content,
  tags,
  source,
  active
)
values (
  'fulanitas',
  'business',
  'Información general de Fulanitas',
  'Fulanitas comercializa prendas de moda y ropa mayorista. Antes de confirmar precio, color, talle o disponibilidad, el agente debe consultar el catálogo y el stock real. Nunca debe inventar existencias.',
  array[
    'fulanitas',
    'ropa',
    'mayorista',
    'catalogo'
  ],
  'system_seed',
  true
);


insert into public.commerce_schema_migrations (
  version,
  description
)
values (
  '20260803160000',
  'Robot runtime core multi-company'
)
on conflict (
  version
)
do nothing;

commit;
