create extension if not exists "pgcrypto";

create table if not exists crm_contacts (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  name text,
  company text,
  status text default 'lead',
  temperature text default 'warm',
  ai_score int default 50,
  total_sales numeric default 0,
  last_message text,
  last_seen_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  contact_phone text not null references crm_contacts(phone) on delete cascade,
  status text default 'open',
  last_message text,
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  contact_phone text not null,
  direction text not null check (direction in ('inbound','outbound')),
  channel text default 'whatsapp',
  body text not null,
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists ai_prompts (
  id uuid primary key default gen_random_uuid(),
  type text unique not null,
  title text not null,
  prompt text not null,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sales_events (
  id uuid primary key default gen_random_uuid(),
  contact_phone text,
  type text not null,
  message text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

insert into ai_prompts(type,title,prompt)
values
('sales','Sales Agent','Eres un vendedor humano, cálido y directo. Vendes por WhatsApp con naturalidad. Detectas intención de compra, preguntas lo justo y llevas al cliente a catálogo, stock o pedido.'),
('followup','Followup Agent','Recontacta clientes con tono humano, corto y sin presión. Usa historial, producto de interés y una llamada a la acción clara.'),
('recovery','Recovery Agent','Recupera clientes inactivos con mensajes personalizados, novedades y ofertas relevantes.')
on conflict(type) do nothing;

create index if not exists idx_contacts_phone on crm_contacts(phone);
create index if not exists idx_conversations_phone on conversations(contact_phone);
create index if not exists idx_messages_phone on messages(contact_phone);
create index if not exists idx_messages_conversation on messages(conversation_id);
create index if not exists idx_sales_events_phone on sales_events(contact_phone);
